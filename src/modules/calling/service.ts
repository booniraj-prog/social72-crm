import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import type { AuthUser } from "@/lib/rbac";
import { leadScopeWhere } from "@/lib/scope";
import { HttpError } from "@/lib/session";
import { startOfIstDay, addIstDays } from "@/lib/time";
import { replaceOpenFollowup } from "@/modules/followups/sync";
import { requireLeadAccess, serializeLead, claimLead } from "@/modules/leads/service";
import { excludePausedLeads, pausedLeadIds } from "@/lib/lead-active";
import { applyScore } from "@/modules/ops/service";
import { requiredId } from "@/lib/ids";

const CONNECTED_KEYS = new Set([
  "CONNECTED",
  "INTERESTED",
  "NOT_INTERESTED",
  "CALL_BACK",
  "FOLLOW_UP_REQUIRED",
  "SITE_VISIT_AGREED",
  "PROPERTY_SHARED",
  "BOOKING_TAKEN",
  "REGISTRATION_STARTED",
  "CAMPUS_VISIT_AGREED",
  "PARENT_CONNECTED",
  "COUNSELLING_AGREED",
  "APPLICATION_STARTED",
  "CLOSED_WON",
  "CLOSED_LOST",
  "BUDGET_ISSUE",
  "COMPETITOR",
  "LANGUAGE_ISSUE",
]);

const DISPOSITION_STATUS: Record<string, string> = {
  CONNECTED: "CONNECTED",
  INTERESTED: "INTERESTED",
  NOT_INTERESTED: "NOT_INTERESTED",
  CALL_BACK: "FOLLOW_UP",
  FOLLOW_UP_REQUIRED: "FOLLOW_UP",
  SITE_VISIT_AGREED: "SITE_VISIT",
  PROPERTY_SHARED: "PROPERTY_SHARED",
  BOOKING_TAKEN: "BOOKING",
  REGISTRATION_STARTED: "REGISTRATION",
  CAMPUS_VISIT_AGREED: "CAMPUS_VISIT",
  PARENT_CONNECTED: "PARENT_CONNECTED",
  COUNSELLING_AGREED: "COUNSELLING",
  APPLICATION_STARTED: "APPLICATION",
  CLOSED_WON: "CLOSED_WON",
  CLOSED_LOST: "CLOSED_LOST",
    INVALID_NUMBER: "INVALID",
    WRONG_NUMBER: "WRONG_NUMBER",
    NOT_ANSWERED: "CALL_ATTEMPTED",
    BUSY: "NOT_AVAILABLE",
    SWITCHED_OFF: "NOT_AVAILABLE",
};

export const logCallSchema = z.object({
  dispositionId: requiredId("a call outcome"),
  notes: z.string().trim().max(4000).optional().or(z.literal("")),
  durationSec: z.coerce.number().int().min(0).max(7200).optional().or(z.literal("")),
  nextFollowupAt: z.string().optional().or(z.literal("")),
  nextAction: z.string().trim().max(200).optional().or(z.literal("")),
});

export async function listDispositions() {
  return prisma.disposition.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
}

export async function listCallingQueue(actor: AuthUser, clientId?: string) {
  const scope = await leadScopeWhere(actor);
  const clientFilter = clientId ? { clientId } : {};
  const paused = await pausedLeadIds();
  const leads = await prisma.lead.findMany({
    where: {
      AND: [scope, { status: { isFinal: false } }, clientFilter, excludePausedLeads(paused), { client: { isActive: true } }, { campaign: { isActive: true } }, { duplicateOfId: null }],
    },
    include: {
      client: { select: { id: true, name: true } },
      campaign: { select: { id: true, name: true } },
      status: true,
      assignedUser: { select: { id: true, name: true } },
      source: true,
    },
    orderBy: [{ leadScore: "desc" }, { nextFollowupAt: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }],
    take: 80,
  });
  return leads.map((lead) => serializeLead(lead as unknown as Record<string, unknown>));
}

export async function callingTodayStats(actor: AuthUser, clientId?: string) {
  const scope = await leadScopeWhere(actor);
  const start = startOfIstDay();
  const end = addIstDays(start, 1);
  const clientFilter = clientId ? { clientId } : {};
  const queueWhere = { AND: [scope, { status: { isFinal: false } }, clientFilter, excludePausedLeads(await pausedLeadIds()), { client: { isActive: true } }, { campaign: { isActive: true } }, { duplicateOfId: null }] };
  const [queue, contacted, interested, followup, converted] = await Promise.all([
    prisma.lead.count({ where: queueWhere }),
    prisma.callLog.count({
      where: { startedAt: { gte: start, lt: end }, lead: { AND: [scope, clientFilter] } },
    }),
    prisma.lead.count({
      where: { AND: [scope, clientFilter, { status: { key: "INTERESTED" } }] },
    }),
    prisma.lead.count({
      where: { AND: [scope, clientFilter, { status: { isFinal: false }, nextFollowupAt: { not: null } }] },
    }),
    prisma.lead.count({
      where: { AND: [scope, clientFilter, { status: { key: { in: ["CLOSED_WON", "ADMISSION_CONFIRMED", "BOOKING"] } } }] },
    }),
  ]);
  return { queue, contacted, interested, followup, converted };
}

export async function logCall(actor: AuthUser, leadId: string, input: z.infer<typeof logCallSchema>) {
  const data = logCallSchema.parse(input);
  await claimLead(actor, leadId);
  const existing = await requireLeadAccess(actor, leadId);
  const disposition = await prisma.disposition.findUnique({ where: { id: data.dispositionId } });
  if (!disposition?.isActive) throw new HttpError(400, "Invalid disposition", "INVALID_DISPOSITION");

  const connected = CONNECTED_KEYS.has(disposition.key);
  const durationSec = typeof data.durationSec === "number" ? data.durationSec : null;
  const parsedFollowup = data.nextFollowupAt ? new Date(data.nextFollowupAt) : null;
  const nextFollowupAt =
    parsedFollowup && !Number.isNaN(parsedFollowup.getTime()) ? parsedFollowup : null;
  const nextAction = data.nextAction ? data.nextAction : null;
  const targetStatusKey = DISPOSITION_STATUS[disposition.key];
  const targetStatus = targetStatusKey
    ? await prisma.leadStatus.findUnique({ where: { key: targetStatusKey } })
    : null;
  const closing = Boolean(targetStatus?.isFinal);
  const resolvedFollowup = nextFollowupAt ?? existing.nextFollowupAt;
  if (!closing && !resolvedFollowup) {
    throw new HttpError(400, "Set the next follow-up before saving this outcome", "FOLLOWUP_REQUIRED");
  }

  const lead = await prisma.$transaction(async (tx) => {
    const call = await tx.callLog.create({
      data: {
        leadId,
        userId: actor.id,
        startedAt: new Date(),
        durationSec,
        dispositionId: disposition.id,
        notes: data.notes || null,
        nextFollowupAt,
        nextAction,
      },
      include: { disposition: true, user: { select: { name: true } } },
    });

    if (nextFollowupAt) {
      await replaceOpenFollowup(tx, {
        leadId,
        ownerUserId: existing.assignedUserId ?? actor.id,
        actorId: actor.id,
        dueAt: nextFollowupAt,
        action: nextAction,
      });
    }

    const statusId =
      targetStatus && !existing.status.isFinal ? targetStatus.id : existing.statusId;

    const updated = await tx.lead.update({
      where: { id: leadId },
      data: {
        callAttempts: { increment: 1 },
        connectedCalls: connected ? { increment: 1 } : undefined,
        lastDispositionId: disposition.id,
        lastContactAt: new Date(),
        firstContactAt: existing.firstContactAt ?? new Date(),
        nextFollowupAt: nextFollowupAt ?? existing.nextFollowupAt,
        nextAction: nextAction ?? existing.nextAction,
        followupCount: nextFollowupAt ? { increment: 1 } : undefined,
        statusId,
        lastActivityAt: new Date(),
      },
    });

    await tx.activity.create({
      data: {
        leadId,
        userId: actor.id,
        type: "call",
        title: `Call · ${disposition.name}`,
        body: [data.notes, durationSec != null ? `${durationSec}s` : null, nextAction]
          .filter(Boolean)
          .join(" · "),
        refTable: "call_logs",
        refId: call.id,
      },
    });

    if (statusId !== existing.statusId && targetStatus) {
      await tx.activity.create({
        data: {
          leadId,
          userId: actor.id,
          type: "status",
          title: `Status → ${targetStatus.name}`,
          body: `From call disposition ${disposition.name}`,
        },
      });
    }

    return { call, updated };
  });

  await writeAudit({
    userId: actor.id,
    action: "lead.call_logged",
    entityType: "lead",
    entityId: leadId,
    newValue: { disposition: disposition.key, durationSec },
  });

  if (connected) await applyScore(leadId, "responded", actor.id);
  if (disposition.key === "INTERESTED") await applyScore(leadId, "interested", actor.id);
  if (disposition.key === "NOT_INTERESTED") await applyScore(leadId, "not_interested", actor.id);
  if (disposition.key === "SITE_VISIT_AGREED" || disposition.key === "CAMPUS_VISIT_AGREED") {
    await applyScore(leadId, "visit_agreed", actor.id);
  }
  if (disposition.key === "INVALID_NUMBER" || disposition.key === "WRONG_NUMBER") {
    await applyScore(leadId, "invalid", actor.id);
  }
  if (["NOT_ANSWERED", "BUSY", "SWITCHED_OFF"].includes(disposition.key) && existing.callAttempts >= 2) {
    await applyScore(leadId, "not_reachable", actor.id);
  }

  return lead.call;
}

export async function addTask(
  actor: AuthUser,
  leadId: string,
  title: string,
  dueAt?: string,
) {
  const text = title.trim();
  if (!text) throw new HttpError(400, "Task title is required", "VALIDATION");
  const existing = await requireLeadAccess(actor, leadId);
  const due = dueAt ? new Date(dueAt) : null;
  const task = await prisma.$transaction(async (tx) => {
    const created = await tx.task.create({
      data: {
        leadId,
        title: text,
        dueAt: due && !Number.isNaN(due.getTime()) ? due : null,
        assignedTo: existing.assignedUserId ?? actor.id,
        createdBy: actor.id,
      },
    });
    await tx.activity.create({
      data: {
        leadId,
        userId: actor.id,
        type: "task",
        title: "Task added",
        body: text,
        refTable: "tasks",
        refId: created.id,
      },
    });
    await tx.lead.update({ where: { id: leadId }, data: { lastActivityAt: new Date() } });
    return created;
  });
  await writeAudit({
    userId: actor.id,
    action: "lead.task_added",
    entityType: "lead",
    entityId: leadId,
    newValue: { title: text },
  });
  return task;
}

export const qualifySchema = z.object({
  occupation: z.string().trim().max(80).optional().or(z.literal("")),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  age: z.union([z.coerce.number().int().min(1).max(120), z.literal("")]).optional(),
  expectedValue: z.coerce.number().min(0).optional(),
  probabilityPct: z.coerce.number().int().min(0).max(100).optional(),
  nextAction: z.string().trim().max(200).optional().or(z.literal("")),
});

export async function updateQualification(
  actor: AuthUser,
  leadId: string,
  input: z.infer<typeof qualifySchema>,
) {
  const data = qualifySchema.parse(input);
  const existing = await requireLeadAccess(actor, leadId);
  const value = data.expectedValue ?? Number(existing.expectedValue);
  const pct = data.probabilityPct ?? existing.probabilityPct;
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      occupation: data.occupation === undefined ? undefined : data.occupation || null,
      city: data.city === undefined ? undefined : data.city || null,
      age: data.age === undefined || data.age === "" ? undefined : data.age,
      expectedValue: data.expectedValue,
      probabilityPct: data.probabilityPct,
      expectedRevenue: value * pct / 100,
      nextAction: data.nextAction === undefined ? undefined : data.nextAction || null,
      lastActivityAt: new Date(),
    },
  });

  await prisma.activity.create({
    data: {
      leadId,
      userId: actor.id,
      type: "qualification",
      title: "Qualification updated",
    },
  });
  await writeAudit({
    userId: actor.id,
    action: "lead.qualified",
    entityType: "lead",
    entityId: leadId,
  });
  return serializeLead((await requireLeadAccess(actor, leadId)) as unknown as Record<string, unknown>);
}
