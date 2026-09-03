import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import type { AuthUser } from "@/lib/rbac";
import { leadScopeWhere } from "@/lib/scope";
import { HttpError } from "@/lib/session";
import { istRange, startOfIstDay } from "@/lib/time";
import { earliestOpenFollowup } from "@/modules/followups/sync";
import { requireLeadAccess, serializeLead } from "@/modules/leads/service";

export const FOLLOWUP_BUCKETS = [
  "today",
  "overdue",
  "tomorrow",
  "upcoming",
  "missed",
  "none",
] as const;

export type FollowupBucket = (typeof FOLLOWUP_BUCKETS)[number];

function notFinal() {
  return { status: { isFinal: false }, deletedAt: null };
}

export async function countFollowupBuckets(actor: AuthUser) {
  const scope = await leadScopeWhere(actor);
  const today = istRange("today");
  const overdue = istRange("overdue");
  const tomorrow = istRange("tomorrow");
  const upcoming = istRange("upcoming");
  const now = new Date();
  const todayStart = startOfIstDay();

  const [todayCount, overdueCount, tomorrowCount, upcomingCount, noneCount, missedCount] =
    await Promise.all([
      prisma.lead.count({
        where: { AND: [scope, notFinal(), { nextFollowupAt: { gte: today.gte, lt: today.lt } }] },
      }),
      prisma.lead.count({
        where: { AND: [scope, notFinal(), { nextFollowupAt: { lt: overdue.lt } }] },
      }),
      prisma.lead.count({
        where: {
          AND: [scope, notFinal(), { nextFollowupAt: { gte: tomorrow.gte, lt: tomorrow.lt } }],
        },
      }),
      prisma.lead.count({
        where: { AND: [scope, notFinal(), { nextFollowupAt: { gte: upcoming.gte } }] },
      }),
      prisma.lead.count({
        where: { AND: [scope, notFinal(), { nextFollowupAt: null }] },
      }),
      prisma.followUp.count({
        where: {
          completedAt: null,
          dueAt: { lt: todayStart },
          lead: { AND: [scope, notFinal()] },
        },
      }),
    ]);

  const completedToday = await prisma.followUp.count({
    where: {
      completedAt: { gte: todayStart, lt: now },
      lead: { AND: [scope] },
    },
  });
  const dueTodayTotal = todayCount + completedToday;
  const completionPct = dueTodayTotal === 0 ? 100 : Math.round((completedToday / dueTodayTotal) * 100);

  return {
    today: todayCount,
    overdue: overdueCount,
    tomorrow: tomorrowCount,
    upcoming: upcomingCount,
    missed: missedCount,
    none: noneCount,
    completedToday,
    completionPct,
  };
}

export async function listFollowupBucket(actor: AuthUser, bucket: FollowupBucket) {
  const scope = await leadScopeWhere(actor);
  const include = {
    client: { select: { id: true, name: true } },
    campaign: { select: { id: true, name: true } },
    status: true,
    assignedUser: { select: { id: true, name: true } },
    source: true,
  };

  if (bucket === "missed") {
    const rows = await prisma.followUp.findMany({
      where: {
        completedAt: null,
        dueAt: { lt: startOfIstDay() },
        lead: { AND: [scope, notFinal()] },
      },
      include: { lead: { include } },
      orderBy: { dueAt: "asc" },
      take: 100,
    });
    return rows.map((row) => ({
      followUpId: row.id,
      dueAt: row.dueAt,
      action: row.action,
      lead: serializeLead(row.lead as unknown as Record<string, unknown>),
    }));
  }

  const range =
    bucket === "today"
      ? istRange("today")
      : bucket === "overdue"
        ? istRange("overdue")
        : bucket === "tomorrow"
          ? istRange("tomorrow")
          : bucket === "upcoming"
            ? istRange("upcoming")
            : null;

  const where =
    bucket === "none"
      ? { AND: [scope, notFinal(), { nextFollowupAt: null }] }
      : range && "gte" in range && "lt" in range
        ? { AND: [scope, notFinal(), { nextFollowupAt: { gte: range.gte, lt: range.lt } }] }
        : range && "lt" in range && !("gte" in range)
          ? { AND: [scope, notFinal(), { nextFollowupAt: { lt: range.lt } }] }
          : { AND: [scope, notFinal(), { nextFollowupAt: { gte: range!.gte } }] };

  const leads = await prisma.lead.findMany({
    where,
    include,
    orderBy: { nextFollowupAt: "asc" },
    take: 100,
  });

  const opens = await prisma.followUp.findMany({
    where: {
      completedAt: null,
      leadId: { in: leads.map((lead) => lead.id) },
    },
    orderBy: { dueAt: "asc" },
  });
  const opensByLead = new Map<string, typeof opens>();
  for (const row of opens) {
    const list = opensByLead.get(row.leadId) ?? [];
    list.push(row);
    opensByLead.set(row.leadId, list);
  }

  return leads.map((lead) => {
    const rows = opensByLead.get(lead.id) ?? [];
    const due = lead.nextFollowupAt?.getTime();
    const match =
      (due != null ? rows.find((row) => row.dueAt.getTime() === due) : undefined) ?? rows[0];
    return {
      followUpId: match?.id ?? null,
      dueAt: lead.nextFollowupAt,
      action: lead.nextAction,
      lead: serializeLead(lead as unknown as Record<string, unknown>),
    };
  });
}

export async function completeFollowup(actor: AuthUser, followUpId: string) {
  const followUp = await prisma.followUp.findUnique({
    where: { id: followUpId },
    include: { lead: { select: { id: true, nextFollowupAt: true } } },
  });
  if (!followUp) throw new HttpError(404, "Follow-up not found", "NOT_FOUND");
  await requireLeadAccess(actor, followUp.leadId);
  if (followUp.completedAt) return followUp;

  const updated = await prisma.$transaction(async (tx) => {
    const done = await tx.followUp.update({
      where: { id: followUpId },
      data: { completedAt: new Date(), completedBy: actor.id },
    });
    const nextOpen = await earliestOpenFollowup(tx, followUp.leadId);
    const leadRow = await tx.lead.findUnique({
      where: { id: followUp.leadId },
      select: { nextFollowupAt: true, nextAction: true },
    });
    const completedDue = followUp.dueAt.getTime();
    const leadDue = leadRow?.nextFollowupAt?.getTime();
    const keepLeadDate = !nextOpen && leadDue != null && leadDue !== completedDue;

    await tx.lead.update({
      where: { id: followUp.leadId },
      data: {
        nextFollowupAt: nextOpen?.dueAt ?? (keepLeadDate ? leadRow!.nextFollowupAt : null),
        nextAction: nextOpen?.action ?? (keepLeadDate ? leadRow!.nextAction : null),
        lastActivityAt: new Date(),
      },
    });
    await tx.activity.create({
      data: {
        leadId: followUp.leadId,
        userId: actor.id,
        type: "followup",
        title: "Follow-up completed",
        refTable: "follow_ups",
        refId: followUpId,
      },
    });
    return done;
  });

  await writeAudit({
    userId: actor.id,
    action: "lead.followup_completed",
    entityType: "lead",
    entityId: followUp.leadId,
    newValue: { followUpId },
  });
  return updated;
}

export async function completeCurrentFollowup(actor: AuthUser, leadId: string) {
  await requireLeadAccess(actor, leadId);
  const open = await prisma.followUp.findFirst({
    where: { leadId, completedAt: null },
    orderBy: { dueAt: "asc" },
  });
  if (open) return completeFollowup(actor, open.id);

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { nextFollowupAt: true, nextAction: true, assignedUserId: true },
  });
  if (!lead?.nextFollowupAt) throw new HttpError(400, "No open follow-up to complete", "NO_FOLLOWUP");

  const created = await prisma.followUp.create({
    data: {
      leadId,
      userId: lead.assignedUserId ?? actor.id,
      dueAt: lead.nextFollowupAt,
      action: lead.nextAction,
    },
  });
  return completeFollowup(actor, created.id);
}

