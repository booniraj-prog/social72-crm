import { prisma } from "@/lib/db";
import type { AuthUser } from "@/lib/rbac";
import { leadScopeWhere } from "@/lib/scope";
import { istRange } from "@/lib/time";
import { alertChannelsForUser } from "@/lib/notify";

export async function notify(input: {
  userId: string;
  type: string;
  title: string;
  body?: string;
  leadId?: string;
  entityType?: string;
  entityId?: string;
}) {
  const existing = await prisma.notification.findFirst({
    where: {
      userId: input.userId,
      type: input.type,
      leadId: input.leadId ?? null,
      readAt: null,
      createdAt: { gte: new Date(Date.now() - 12 * 60 * 60 * 1000) },
    },
  });
  if (existing) return existing;
  const channels = await alertChannelsForUser(input.userId).catch(() => ({
    emailTo: null,
    phoneTo: null,
    emailQueued: false,
    smsQueued: false,
  }));
  try {
    return await prisma.notification.create({ data: { ...input, ...channels } });
  } catch {
    return prisma.notification.create({ data: input });
  }
}

export async function applyScore(leadId: string, eventKey: string, userId?: string) {
  const rule = await prisma.scoringRule.findUnique({ where: { eventKey } });
  if (!rule?.isActive) return;
  const once = !["responded", "not_reachable"].includes(eventKey);
  if (once) {
    const prior = await prisma.leadScoreEvent.findFirst({
      where: { leadId, ruleId: rule.id },
    });
    if (prior) return;
  }
  await prisma.$transaction(async (tx) => {
    await tx.leadScoreEvent.create({
      data: {
        leadId,
        ruleId: rule.id,
        points: rule.points,
        reason: rule.description,
        createdBy: userId,
      },
    });
    await tx.lead.update({
      where: { id: leadId },
      data: { leadScore: { increment: rule.points } },
    });
  });
}

async function leadersFor(userId: string | null) {
  if (!userId) {
    return prisma.user.findMany({
      where: { isActive: true, role: { key: { in: ["bpo_leader", "crm_manager"] } } },
      select: { id: true },
      take: 8,
    });
  }
  const teams = await prisma.team.findMany({
    where: { members: { some: { userId } } },
    select: { leaderId: true },
  });
  const ids = [...new Set(teams.map((t) => t.leaderId).filter(Boolean))] as string[];
  if (ids.length === 0) {
    return prisma.user.findMany({
      where: { isActive: true, role: { key: "bpo_leader" } },
      select: { id: true },
      take: 5,
    });
  }
  return ids.map((id) => ({ id }));
}

export async function runOpsTick(actor: AuthUser) {
  const scope = await leadScopeWhere(actor);
  const now = new Date();
  const inactiveSince = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const overdue = istRange("overdue");

  const [unassigned, uncalled, inactive, followups] = await Promise.all([
    prisma.lead.findMany({
      where: {
        AND: [
          scope,
          { assignedUserId: null, slaAssignDueAt: { lt: now }, slaAssignBreached: false, status: { isFinal: false } },
        ],
      },
      take: 40,
      select: { id: true, fullName: true, assignedUserId: true },
    }),
    prisma.lead.findMany({
      where: {
        AND: [
          scope,
          {
            assignedUserId: { not: null },
            firstContactAt: null,
            slaFirstCallDueAt: { lt: now },
            slaFirstCallBreached: false,
            status: { isFinal: false },
          },
        ],
      },
      take: 40,
      select: { id: true, fullName: true, assignedUserId: true },
    }),
    prisma.lead.findMany({
      where: {
        AND: [
          scope,
          { status: { isFinal: false }, lastActivityAt: { lt: inactiveSince } },
        ],
      },
      take: 40,
      select: { id: true, fullName: true, assignedUserId: true },
    }),
    prisma.lead.findMany({
      where: {
        AND: [scope, { status: { isFinal: false }, nextFollowupAt: { lt: overdue.lt } }],
      },
      take: 40,
      select: { id: true, fullName: true, assignedUserId: true, nextFollowupAt: true },
    }),
  ]);

  for (const lead of unassigned) {
    await prisma.lead.update({ where: { id: lead.id }, data: { slaAssignBreached: true } });
    for (const user of await leadersFor(null)) {
      await notify({
        userId: user.id,
        type: "sla_assign",
        title: "Assignment SLA breached",
        body: lead.fullName,
        leadId: lead.id,
      });
    }
  }
  for (const lead of uncalled) {
    await prisma.lead.update({ where: { id: lead.id }, data: { slaFirstCallBreached: true } });
    if (lead.assignedUserId) {
      await notify({
        userId: lead.assignedUserId,
        type: "sla_first_call",
        title: "First-call SLA breached",
        body: lead.fullName,
        leadId: lead.id,
      });
    }
    for (const user of await leadersFor(lead.assignedUserId)) {
      await notify({
        userId: user.id,
        type: "sla_first_call_escalation",
        title: "Escalate: first call overdue",
        body: lead.fullName,
        leadId: lead.id,
      });
    }
  }
  for (const lead of inactive) {
    const targets = lead.assignedUserId
      ? [{ id: lead.assignedUserId }, ...(await leadersFor(lead.assignedUserId))]
      : await leadersFor(null);
    for (const user of targets) {
      await notify({
        userId: user.id,
        type: "inactive",
        title: "Lead inactive 7+ days",
        body: lead.fullName,
        leadId: lead.id,
      });
    }
  }
  for (const lead of followups) {
    if (lead.assignedUserId) {
      await notify({
        userId: lead.assignedUserId,
        type: "followup_overdue",
        title: "Follow-up overdue",
        body: lead.fullName,
        leadId: lead.id,
      });
    }
  }

  const { runPlatformTick } = await import("@/modules/platform/service");
  await runPlatformTick();

  return {
    assignBreaches: unassigned.length,
    firstCallBreaches: uncalled.length,
    inactive: inactive.length,
    overdueFollowups: followups.length,
  };
}

export async function listNotifications(userId: string) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { lead: { select: { id: true, fullName: true } } },
  });
}

export async function markNotificationsRead(userId: string) {
  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function unreadCount(userId: string) {
  return prisma.notification.count({ where: { userId, readAt: null } });
}
