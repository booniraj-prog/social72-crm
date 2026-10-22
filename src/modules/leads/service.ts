import { Prisma } from "@prisma/client";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { normalizeMobile } from "@/lib/phone";
import type { AuthUser } from "@/lib/rbac";
import { canAssignLeads, canPickLeads, leadScopeWhere } from "@/lib/scope";
import { DuplicateLeadError, HttpError } from "@/lib/session";
import { optionalEmail, optionalId, requiredId } from "@/lib/ids";
import { ALL_ISSUE_STATUS_KEYS, ISSUE_STATUS_KEYS, type IssueFilter } from "@/lib/lead-quality";
import { attachLeadActive, excludePausedLeads, pausedLeadIds } from "@/lib/lead-active";
import { STATUS_SCORE_EVENTS } from "@/lib/lead-score";
import { ensureOpsTables } from "@/lib/ops-tables";
import { applyScore, notify } from "@/modules/ops/service";
import { replaceOpenFollowup } from "@/modules/followups/sync";
import { GMEET_NEW, touchPointLabel } from "@/lib/touch-points";

const TEMPERATURES = ["HOT", "WARM", "COLD", "UNQUALIFIED"] as const;

export const leadFilterSchema = z.object({
  q: z.string().trim().optional(),
  clientId: optionalId,
  campaignId: optionalId,
  statusId: optionalId,
  sourceId: optionalId,
  assignedUserId: z.preprocess(
    (value) => (value === "" || value == null ? undefined : value),
    z.union([z.string().uuid(), z.literal("unassigned")]).optional(),
  ),
  industryKey: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  temperature: z.enum(TEMPERATURES).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  issue: z.enum(["working", "dnc", "wrong", "unavailable", "unwanted", "invalid", "duplicate"]).optional(),
  minScore: z.coerce.number().int().optional(),
  sort: z.enum(["new", "score"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export const createLeadSchema = z.object({
  firstName: z.string().trim().max(80).optional().or(z.literal("")),
  lastName: z.string().trim().max(80).optional().or(z.literal("")),
  fullName: z.string().trim().min(2).max(160).optional(),
  mobile: z.string().trim().min(8).max(20),
  alternateMobile: z.string().trim().max(20).optional().or(z.literal("")),
  email: optionalEmail,
  city: z.string().trim().max(80).optional().or(z.literal("")),
  state: z.string().trim().max(80).optional().or(z.literal("")),
  pincode: z.string().trim().max(12).optional().or(z.literal("")),
  gender: z.string().trim().max(20).optional().or(z.literal("")),
  occupation: z.string().trim().max(80).optional().or(z.literal("")),
  clientId: requiredId("a client"),
  campaignId: requiredId("a campaign"),
  sourceId: optionalId,
  sourcePlatform: z.string().trim().max(80).optional().or(z.literal("")),
  utmSource: z.string().trim().max(80).optional().or(z.literal("")),
  utmMedium: z.string().trim().max(80).optional().or(z.literal("")),
  utmCampaign: z.string().trim().max(80).optional().or(z.literal("")),
  assignedUserId: requiredId("an employee"),
  temperature: z.enum(TEMPERATURES).optional(),
  expectedValue: z.coerce.number().min(0).optional(),
  probabilityPct: z.coerce.number().int().min(0).max(100).optional(),
  nextAction: z.string().trim().max(200).optional().or(z.literal("")),
  nextFollowupAt: z.string().optional().or(z.literal("")),
  age: z.union([z.coerce.number().int().min(1).max(120), z.literal("")]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  captureChannel: z.string().trim().max(40).optional().or(z.literal("")),
  serviceLine: z.string().trim().max(80).optional().or(z.literal("")),
  adId: z.string().trim().max(80).optional().or(z.literal("")),
  adSet: z.string().trim().max(80).optional().or(z.literal("")),
});

export const updateLeadSchema = createLeadSchema.partial().omit({ clientId: true, campaignId: true, mobile: true }).extend({
  mobile: z.string().trim().min(8).max(20).optional(),
  clientId: optionalId,
  campaignId: optionalId,
});

const leadListInclude = {
  client: { select: { id: true, name: true } },
  campaign: { select: { id: true, name: true } },
  status: true,
  assignedUser: { select: { id: true, name: true } },
  source: true,
  industry: { select: { id: true, key: true, name: true } },
} satisfies Prisma.LeadInclude;

function blank(value?: string | null) {
  return value ? value : null;
}

function composeName(firstName?: string | null, lastName?: string | null, fullName?: string | null) {
  if (fullName?.trim()) return fullName.trim();
  return [firstName, lastName].filter(Boolean).join(" ").trim();
}

function money(value?: number) {
  return new Prisma.Decimal(value ?? 0);
}

function expectedRevenue(value: number, probability: number) {
  return new Prisma.Decimal(((value || 0) * (probability || 0)) / 100);
}

export function serializeLead<T extends Record<string, unknown>>(lead: T) {
  const decimalKeys = [
    "expectedValue",
    "expectedRevenue",
    "actualRevenue",
  ] as const;
  const out: Record<string, unknown> = { ...lead };
  for (const key of decimalKeys) {
    const v = out[key];
    if (v !== undefined && v !== null && typeof v === "object" && "toString" in v) {
      out[key] = Number(v.toString());
    }
  }
  return out;
}

async function nextLeadNumber() {
  const year = new Date().getFullYear();
  const prefix = `S72-${year}-`;
  const latest = await prisma.lead.findFirst({
    where: { leadNumber: { startsWith: prefix } },
    orderBy: { leadNumber: "desc" },
    select: { leadNumber: true },
  });
  const seq = latest ? Number(latest.leadNumber.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(seq).padStart(6, "0")}`;
}

async function ensureLeadSources() {
  const defaults = [
    { name: "Meta Ads", platform: "meta_ads" },
    { name: "Google Ads", platform: "google_ads" },
    { name: "Website", platform: "website" },
    { name: "Landing page", platform: "landing_page" },
    { name: "Referral", platform: "referral" },
    { name: "Organic", platform: "organic" },
    { name: "Other", platform: "other" },
  ];
  const existing = await prisma.leadSource.findMany();
  if (existing.length > 0) return existing.filter((s) => s.isActive);
  await prisma.leadSource.createMany({ data: defaults });
  return prisma.leadSource.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
}

export async function listLeadSources() {
  return ensureLeadSources();
}

export async function listLeadStatuses() {
  await ensureOpsTables();
  return prisma.leadStatus.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
}

export async function listAssignees() {
  return prisma.user.findMany({
    where: {
      isActive: true,
      role: { key: { in: ["bpo_executive", "bpo_leader", "crm_manager", "sales_manager", "marketing_manager", "project_manager"] } },
    },
    select: { id: true, name: true, email: true, role: { select: { key: true, name: true } } },
    orderBy: { name: "asc" },
  });
}

export async function listLeads(actor: AuthUser, raw: Record<string, string | undefined>) {
  const filters = leadFilterSchema.parse({
    ...raw,
    page: raw.page || 1,
    pageSize: raw.pageSize || 50,
  });
  const scope = await leadScopeWhere(actor);

  const where: Prisma.LeadWhereInput = { AND: [scope] };
  const and = where.AND as Prisma.LeadWhereInput[];

  if (filters.q) {
    const q = filters.q;
    and.push({
      OR: [
            { fullName: { contains: q, mode: "insensitive" } },
            { mobileE164: { contains: q.replace(/\s/g, "") } },
            { email: { contains: q, mode: "insensitive" } },
            { leadNumber: { contains: q, mode: "insensitive" } },
            { assignedUser: { name: { contains: q, mode: "insensitive" } } },
            { assignedUser: { email: { contains: q, mode: "insensitive" } } },
      ],
    });
  }
  if (filters.clientId) and.push({ clientId: filters.clientId });
  if (filters.campaignId) and.push({ campaignId: filters.campaignId });
  if (filters.statusId) and.push({ statusId: filters.statusId });
  if (filters.sourceId) and.push({ sourceId: filters.sourceId });
  if (filters.assignedUserId === "unassigned") and.push({ assignedUserId: null });
  else if (filters.assignedUserId) and.push({ assignedUserId: filters.assignedUserId });
  if (filters.industryKey) and.push({ industry: { key: filters.industryKey } });
  if (filters.city) and.push({ city: { contains: filters.city, mode: "insensitive" } });
  if (filters.state) and.push({ state: { contains: filters.state, mode: "insensitive" } });
  if (filters.temperature) and.push({ temperature: filters.temperature });
  if (filters.minScore !== undefined) and.push({ leadScore: { gte: filters.minScore } });
  if (filters.from) and.push({ createdAt: { gte: new Date(filters.from) } });
  if (filters.to) {
    const end = new Date(filters.to);
    end.setHours(23, 59, 59, 999);
    and.push({ createdAt: { lte: end } });
  }
  if (filters.issue === "working") {
    const paused = await pausedLeadIds();
    and.push({ status: { key: { notIn: [...ALL_ISSUE_STATUS_KEYS] } }, duplicateOfId: null, ...excludePausedLeads(paused) });
  } else if (filters.issue) {
    const keys = ISSUE_STATUS_KEYS[filters.issue as Exclude<IssueFilter, "working">];
    if (keys) and.push({ status: { key: { in: keys } } });
  }

  const skip = (filters.page - 1) * filters.pageSize;
  const orderBy: Prisma.LeadOrderByWithRelationInput[] =
    filters.sort === "score" ? [{ leadScore: "desc" }, { createdAt: "desc" }] : [{ createdAt: "desc" }];
  const [total, leads] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.lead.findMany({
      where,
      include: leadListInclude,
      orderBy,
      skip,
      take: filters.pageSize,
    }),
  ]);

  return {
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    leads: (await attachLeadActive(leads)).map((lead) => serializeLead(lead as unknown as Record<string, unknown>)),
  };
}

async function scopedLead(actor: AuthUser, id: string) {
  const scope = await leadScopeWhere(actor);
  const lead = await prisma.lead.findFirst({
    where: { id, AND: [scope] },
    include: {
      ...leadListInclude,
      createdBy: { select: { id: true, name: true } },
      notes: { orderBy: { createdAt: "desc" }, take: 20, include: { user: { select: { name: true } } } },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 80,
        include: { user: { select: { name: true } } },
      },
      callLogs: {
        orderBy: { startedAt: "desc" },
        take: 25,
        include: {
          disposition: true,
          user: { select: { id: true, name: true } },
        },
      },
      followUps: {
        orderBy: { dueAt: "asc" },
        take: 10,
        include: { user: { select: { name: true } } },
      },
      tasks: {
        where: { completedAt: null },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { assignee: { select: { name: true } } },
      },
    },
  });
  if (!lead) throw new HttpError(404, "Lead not found", "NOT_FOUND");
  await ensureOpsTables();
  const extras = await prisma.$queryRaw<Array<{ id: string; kind: string | null; meet_url: string | null; location: string | null }>>`
    SELECT id, kind, meet_url, location FROM follow_ups WHERE lead_id = ${id}
  `;
  const extraById = new Map(extras.map((row) => [row.id, row]));
  const followUps = lead.followUps.map((item) => {
    const extra = extraById.get(item.id);
    return {
      ...item,
      kind: extra?.kind ?? null,
      meetUrl: extra?.meet_url ?? null,
      location: extra?.location ?? null,
    };
  });
  const [hydrated] = await attachLeadActive([{ ...lead, followUps }]);
  return hydrated;
}

export async function requireLeadAccess(actor: AuthUser, id: string) {
  return scopedLead(actor, id);
}

export async function getLead(actor: AuthUser, id: string) {
  const lead = await scopedLead(actor, id);
  return serializeLead(lead as unknown as Record<string, unknown>);
}

async function findDuplicate(clientId: string, mobileE164: string, excludeId?: string) {
  return prisma.lead.findFirst({
    where: {
      clientId,
      mobileE164,
      deletedAt: null,
      duplicateOfId: null,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    include: {
      status: true,
      assignedUser: { select: { id: true, name: true } },
      campaign: { select: { id: true, name: true } },
    },
  });
}

async function slaDueDates() {
  const [assign, firstCall] = await Promise.all([
    prisma.slaRule.findUnique({ where: { key: "assign_new_lead" } }),
    prisma.slaRule.findUnique({ where: { key: "first_call" } }),
  ]);
  const now = Date.now();
  return {
    slaAssignDueAt: assign ? new Date(now + assign.thresholdMinutes * 60_000) : null,
    slaFirstCallDueAt: firstCall ? new Date(now + firstCall.thresholdMinutes * 60_000) : null,
  };
}

export async function createLead(actor: AuthUser, input: z.infer<typeof createLeadSchema>) {
  const data = createLeadSchema.parse(input);
  const mobileE164 = normalizeMobile(data.mobile);
  const campaign = await prisma.campaign.findUnique({
    where: { id: data.campaignId },
    include: { client: true },
  });
  if (!campaign || campaign.clientId !== data.clientId) {
    throw new HttpError(400, "Campaign does not belong to this client", "INVALID_CAMPAIGN");
  }

  const duplicate = await findDuplicate(data.clientId, mobileE164);
  if (duplicate) {
    throw new HttpError(409, "A lead with this mobile already exists for the client", "DUPLICATE");
  }

  const assignedStatus = await prisma.leadStatus.findUniqueOrThrow({ where: { key: "ASSIGNED" } });
  const assignedUserId = data.assignedUserId;
  const assigneeUser = await prisma.user.findUnique({ where: { id: assignedUserId } });
  if (!assigneeUser?.isActive) throw new HttpError(400, "Assignee not found", "INVALID_ASSIGNEE");
  const statusId = assignedStatus.id;
  const fullName = composeName(data.firstName, data.lastName, data.fullName);
  if (!fullName) throw new HttpError(400, "Name is required", "VALIDATION");

  const expectedValue = data.expectedValue ?? 0;
  const probabilityPct = data.probabilityPct ?? 0;
  const sla = await slaDueDates();
  const leadNumber = await nextLeadNumber();

  const lead = await prisma.$transaction(async (tx) => {
    const created = await tx.lead.create({
      data: {
        leadNumber,
        clientId: data.clientId,
        campaignId: data.campaignId,
        industryId: campaign.industryId,
        sourceId: blank(data.sourceId as string | undefined),
        statusId,
        assignedUserId,
        assignedAt: new Date(),
        createdById: actor.id,
        firstName: blank(data.firstName),
        lastName: blank(data.lastName),
        fullName,
        mobileE164,
        alternateMobile: data.alternateMobile ? normalizeMobile(data.alternateMobile) : null,
        email: blank(data.email)?.toLowerCase() ?? null,
        city: blank(data.city),
        state: blank(data.state),
        pincode: blank(data.pincode),
        gender: blank(data.gender),
        occupation: blank(data.occupation),
        age: typeof data.age === "number" ? data.age : null,
        sourcePlatform: blank(data.sourcePlatform),
        utmSource: blank(data.utmSource),
        utmMedium: blank(data.utmMedium),
        utmCampaign: blank(data.utmCampaign),
        generatedAt: new Date(),
        temperature: data.temperature ?? "WARM",
        expectedValue: money(expectedValue),
        probabilityPct,
        expectedRevenue: expectedRevenue(expectedValue, probabilityPct),
        nextAction: blank(data.nextAction),
        nextFollowupAt: data.nextFollowupAt ? new Date(data.nextFollowupAt) : null,
        lastActivityAt: new Date(),
        priority: data.priority ?? "MEDIUM",
        captureChannel: blank(data.captureChannel),
        serviceLine: blank(data.serviceLine),
        adId: blank(data.adId),
        adSet: blank(data.adSet),
        slaAssignDueAt: null,
        slaFirstCallDueAt: sla.slaFirstCallDueAt,
      },
      include: leadListInclude,
    });

    await tx.activity.create({
      data: {
        leadId: created.id,
        userId: actor.id,
        type: "created",
        title: "Lead created",
        body: `${fullName} · ${created.leadNumber}`,
      },
    });

    await tx.leadAssignment.create({
      data: {
        leadId: created.id,
        toUserId: assignedUserId,
        assignedBy: actor.id,
      },
    });
    await tx.activity.create({
      data: {
        leadId: created.id,
        userId: actor.id,
        type: "assigned",
        title: `Assigned to ${assigneeUser.name}`,
      },
    });

    return created;
  });

  await writeAudit({
    userId: actor.id,
    action: "lead.created",
    entityType: "lead",
    entityId: lead.id,
    newValue: { leadNumber: lead.leadNumber, mobileE164, clientId: data.clientId },
  });

  return serializeLead(lead as unknown as Record<string, unknown>);
}

export async function updateLead(actor: AuthUser, id: string, input: z.infer<typeof updateLeadSchema>) {
  const data = updateLeadSchema.parse(input);
  const existing = await scopedLead(actor, id);

  let mobileE164 = existing.mobileE164;
  if (data.mobile) {
    mobileE164 = normalizeMobile(data.mobile);
    const duplicate = await findDuplicate(data.clientId ?? existing.clientId, mobileE164, id);
    if (duplicate) {
      throw new HttpError(409, "A lead with this mobile already exists for the client", "DUPLICATE");
    }
  }

  const expectedValue =
    data.expectedValue !== undefined ? data.expectedValue : Number(existing.expectedValue);
  const probabilityPct =
    data.probabilityPct !== undefined ? data.probabilityPct : existing.probabilityPct;

  const fullName = composeName(
    data.firstName ?? existing.firstName,
    data.lastName ?? existing.lastName,
    data.fullName ?? existing.fullName,
  );

  const lead = await prisma.lead.update({
    where: { id },
    data: {
      firstName: data.firstName === undefined ? undefined : blank(data.firstName),
      lastName: data.lastName === undefined ? undefined : blank(data.lastName),
      fullName: fullName || existing.fullName,
      mobileE164,
      alternateMobile:
        data.alternateMobile === undefined
          ? undefined
          : data.alternateMobile
            ? normalizeMobile(data.alternateMobile)
            : null,
      email: data.email === undefined ? undefined : blank(data.email)?.toLowerCase() ?? null,
      city: data.city === undefined ? undefined : blank(data.city),
      state: data.state === undefined ? undefined : blank(data.state),
      pincode: data.pincode === undefined ? undefined : blank(data.pincode),
      gender: data.gender === undefined ? undefined : blank(data.gender),
      occupation: data.occupation === undefined ? undefined : blank(data.occupation),
      age: data.age === undefined || data.age === "" ? undefined : (data.age as number),
      sourceId: data.sourceId === undefined ? undefined : blank(data.sourceId as string),
      sourcePlatform: data.sourcePlatform === undefined ? undefined : blank(data.sourcePlatform),
      utmSource: data.utmSource === undefined ? undefined : blank(data.utmSource),
      utmMedium: data.utmMedium === undefined ? undefined : blank(data.utmMedium),
      utmCampaign: data.utmCampaign === undefined ? undefined : blank(data.utmCampaign),
      temperature: data.temperature,
      expectedValue: data.expectedValue === undefined ? undefined : money(expectedValue),
      probabilityPct: data.probabilityPct === undefined ? undefined : probabilityPct,
      expectedRevenue: expectedRevenue(expectedValue, probabilityPct),
      nextAction: data.nextAction === undefined ? undefined : blank(data.nextAction),
      nextFollowupAt:
        data.nextFollowupAt === undefined
          ? undefined
          : data.nextFollowupAt
            ? new Date(data.nextFollowupAt)
            : null,
      lastActivityAt: new Date(),
    },
    include: leadListInclude,
  });

  await prisma.activity.create({
    data: {
      leadId: id,
      userId: actor.id,
      type: "updated",
      title: "Lead details updated",
    },
  });

  await writeAudit({
    userId: actor.id,
    action: "lead.updated",
    entityType: "lead",
    entityId: id,
  });

  return serializeLead(lead as unknown as Record<string, unknown>);
}

export async function assignLead(actor: AuthUser, id: string, assignedUserId: string) {
  if (!canAssignLeads(actor)) {
    throw new HttpError(403, "You cannot assign leads", "FORBIDDEN");
  }
  if (!assignedUserId) {
    throw new HttpError(400, "Every lead must stay assigned to an employee", "ASSIGNMENT_REQUIRED");
  }
  const existing = await scopedLead(actor, id);
  const user = await prisma.user.findUnique({ where: { id: assignedUserId } });
  if (!user?.isActive) throw new HttpError(400, "Assignee not found", "INVALID_ASSIGNEE");

  const assignedStatus = await prisma.leadStatus.findUniqueOrThrow({ where: { key: "ASSIGNED" } });
  const firstCall = await prisma.slaRule.findUnique({ where: { key: "first_call" } });

  const lead = await prisma.$transaction(async (tx) => {
    const updated = await tx.lead.update({
      where: { id },
      data: {
        assignedUserId,
        assignedAt: new Date(),
        statusId: existing.status.key === "NEW" ? assignedStatus.id : existing.statusId,
        slaFirstCallDueAt: new Date(Date.now() + (firstCall?.thresholdMinutes ?? 10) * 60_000),
        slaAssignDueAt: null,
        lastActivityAt: new Date(),
      },
      include: leadListInclude,
    });

    await tx.leadAssignment.create({
      data: {
        leadId: id,
        fromUserId: existing.assignedUserId,
        toUserId: assignedUserId,
        assignedBy: actor.id,
      },
    });

    await tx.activity.create({
      data: {
        leadId: id,
        userId: actor.id,
        type: "assigned",
        title: `Assigned to ${user.name}`,
        body: existing.assignedUser ? `Previously ${existing.assignedUser.name}` : null,
      },
    });

    return updated;
  });

  await writeAudit({
    userId: actor.id,
    action: "lead.assigned",
    entityType: "lead",
    entityId: id,
    oldValue: { assignedUserId: existing.assignedUserId },
    newValue: { assignedUserId },
  });

  await notify({
    userId: assignedUserId,
    type: "lead_assigned",
    title: "New lead assigned",
    body: existing.fullName,
    leadId: id,
  });

  return serializeLead(lead as unknown as Record<string, unknown>);
}

export async function claimLead(actor: AuthUser, id: string) {
  if (!canPickLeads(actor)) {
    throw new HttpError(403, "You cannot pick leads", "FORBIDDEN");
  }
  const existing = await scopedLead(actor, id);
  if (existing.assignedUserId && existing.assignedUserId !== actor.id) {
    throw new HttpError(409, "This lead is already owned by another executive", "ALREADY_ASSIGNED");
  }
  if (existing.assignedUserId === actor.id) {
    return serializeLead(existing as unknown as Record<string, unknown>);
  }

  const assignedStatus = await prisma.leadStatus.findUniqueOrThrow({ where: { key: "ASSIGNED" } });
  const firstCall = await prisma.slaRule.findUnique({ where: { key: "first_call" } });
  const now = new Date();

  const lead = await prisma.$transaction(async (tx) => {
    const claimed = await tx.lead.updateMany({
      where: { id, assignedUserId: null, deletedAt: null },
      data: {
        assignedUserId: actor.id,
        assignedAt: now,
        statusId: existing.status.key === "NEW" ? assignedStatus.id : existing.statusId,
        slaFirstCallDueAt: new Date(now.getTime() + (firstCall?.thresholdMinutes ?? 10) * 60_000),
        slaAssignDueAt: null,
        lastActivityAt: now,
      },
    });
    if (claimed.count === 0) {
      throw new HttpError(409, "This lead was just picked by someone else", "ALREADY_ASSIGNED");
    }

    await tx.leadAssignment.create({
      data: {
        leadId: id,
        fromUserId: null,
        toUserId: actor.id,
        assignedBy: actor.id,
        reason: "Picked from calling pool",
      },
    });
    await tx.activity.create({
      data: {
        leadId: id,
        userId: actor.id,
        type: "assigned",
        title: `Picked by ${actor.name}`,
      },
    });

    return tx.lead.findFirstOrThrow({
      where: { id },
      include: leadListInclude,
    });
  });

  await writeAudit({
    userId: actor.id,
    action: "lead.picked",
    entityType: "lead",
    entityId: id,
    newValue: { assignedUserId: actor.id },
  });

  return serializeLead(lead as unknown as Record<string, unknown>);
}

export async function changeStatus(actor: AuthUser, id: string, statusId: string, reason?: string) {
  let existing = await scopedLead(actor, id);
  if (!existing.assignedUserId && canPickLeads(actor)) {
    await claimLead(actor, id);
    existing = await scopedLead(actor, id);
  }
  const status = await prisma.leadStatus.findUnique({ where: { id: statusId } });
  if (!status?.isActive) throw new HttpError(400, "Invalid status", "INVALID_STATUS");

  const transitions = await prisma.statusTransition.findMany({
    where: { fromStatusId: existing.statusId },
  });
  const qualityMove = ALL_ISSUE_STATUS_KEYS.includes(status.key);
  if (transitions.length > 0 && !qualityMove && !transitions.some((t) => t.toStatusId === statusId)) {
    throw new HttpError(400, "That status change is not allowed", "INVALID_TRANSITION");
  }

  const isWon = status.key === "CLOSED_WON";
  const isLost = status.key === "CLOSED_LOST";
  if (!status.isFinal && !qualityMove && !existing.nextFollowupAt) {
    throw new HttpError(
      400,
      "Schedule a next follow-up before leaving this lead open",
      "FOLLOWUP_REQUIRED",
    );
  }

  const lead = await prisma.$transaction(async (tx) => {
    const updated = await tx.lead.update({
      where: { id },
      data: {
        statusId,
        converted: isWon,
        closureType: isWon ? "WON" : isLost ? "LOST" : existing.closureType,
        closureDate: isWon || isLost ? new Date() : existing.closureDate,
        wonLostReason: reason ?? existing.wonLostReason,
        lastActivityAt: new Date(),
      },
      include: leadListInclude,
    });

    await tx.activity.create({
      data: {
        leadId: id,
        userId: actor.id,
        type: "status",
        title: `Status → ${status.name}`,
        body: reason || `${existing.status.name} to ${status.name}`,
      },
    });

    if (isWon || isLost) {
      await tx.closure.create({
        data: {
          leadId: id,
          type: isWon ? "WON" : "LOST",
          amount: isWon ? updated.actualRevenue : null,
          reason: reason ?? null,
          closedAt: new Date(),
          closedBy: actor.id,
        },
      });
    }

    return updated;
  });

  await writeAudit({
    userId: actor.id,
    action: "lead.status_changed",
    entityType: "lead",
    entityId: id,
    oldValue: { status: existing.status.key },
    newValue: { status: status.key, reason },
  });

  const scoreEvent = STATUS_SCORE_EVENTS[status.key];
  if (scoreEvent) await applyScore(id, scoreEvent, actor.id);
  if (isWon) {
    const managers = await prisma.user.findMany({
      where: { isActive: true, role: { key: { in: ["crm_manager", "bpo_leader"] } } },
      select: { id: true },
      take: 8,
    });
    for (const user of managers) {
      await notify({
        userId: user.id,
        type: "closure",
        title: "Lead closed won",
        body: existing.fullName,
        leadId: id,
      });
    }
  }

  return serializeLead(lead as unknown as Record<string, unknown>);
}

export async function changeTemperature(actor: AuthUser, id: string, temperature: (typeof TEMPERATURES)[number]) {
  const existing = await scopedLead(actor, id);
  const lead = await prisma.lead.update({
    where: { id },
    data: { temperature, lastActivityAt: new Date() },
    include: leadListInclude,
  });
  await prisma.activity.create({
    data: {
      leadId: id,
      userId: actor.id,
      type: "temperature",
      title: `Temperature → ${temperature}`,
      body: existing.temperature,
    },
  });
  await writeAudit({
    userId: actor.id,
    action: "lead.temperature_changed",
    entityType: "lead",
    entityId: id,
    oldValue: { temperature: existing.temperature },
    newValue: { temperature },
  });
  if (temperature === "HOT" && existing.assignedUserId) {
    await notify({
      userId: existing.assignedUserId,
      type: "hot_lead",
      title: "Hot lead",
      body: existing.fullName,
      leadId: id,
    });
  }
  return serializeLead(lead as unknown as Record<string, unknown>);
}

export async function addNote(actor: AuthUser, id: string, body: string) {
  const text = body.trim();
  if (text.length < 1) throw new HttpError(400, "Note cannot be empty", "VALIDATION");
  await scopedLead(actor, id);
  const note = await prisma.$transaction(async (tx) => {
    const created = await tx.note.create({
      data: { leadId: id, userId: actor.id, body: text },
      include: { user: { select: { name: true } } },
    });
    await tx.activity.create({
      data: {
        leadId: id,
        userId: actor.id,
        type: "note",
        title: "Note added",
        body: text,
        refTable: "notes",
        refId: created.id,
      },
    });
    await tx.lead.update({ where: { id }, data: { lastActivityAt: new Date() } });
    return created;
  });
  await writeAudit({
    userId: actor.id,
    action: "lead.note_added",
    entityType: "lead",
    entityId: id,
  });
  return note;
}

export async function scheduleFollowup(
  actor: AuthUser,
  id: string,
  dueAt: string,
  action?: string,
  extras?: { kind?: string; meetUrl?: string; location?: string },
) {
  const existing = await scopedLead(actor, id);
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) throw new HttpError(400, "Invalid follow-up date", "VALIDATION");

  const followStatus = await prisma.leadStatus.findUnique({ where: { key: "FOLLOW_UP" } });
  const kind = extras?.kind || "call";
  const meetUrl = extras?.meetUrl?.trim() || (kind === "gmeet" ? GMEET_NEW : null);
  const nextAction = action?.trim() || touchPointLabel(kind);
  const lead = await prisma.$transaction(async (tx) => {
    const followUp = await replaceOpenFollowup(tx, {
      leadId: id,
      ownerUserId: existing.assignedUserId ?? actor.id,
      actorId: actor.id,
      dueAt: due,
      action: nextAction,
      kind,
      meetUrl,
      location: extras?.location || null,
    });
    const updated = await tx.lead.update({
      where: { id },
      data: {
        nextFollowupAt: due,
        nextAction,
        followupCount: { increment: 1 },
        statusId:
          followStatus && !existing.status.isFinal ? followStatus.id : existing.statusId,
        lastActivityAt: new Date(),
      },
      include: leadListInclude,
    });
    await tx.activity.create({
      data: {
        leadId: id,
        userId: actor.id,
        type: "followup",
        title: `${touchPointLabel(kind)} scheduled`,
        body: `${nextAction} · ${due.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`,
      },
    });
    return { updated, followUpId: followUp.id };
  });

  await writeAudit({
    userId: actor.id,
    action: "lead.followup_created",
    entityType: "lead",
    entityId: id,
    newValue: { dueAt, kind },
  });
  return {
    lead: serializeLead(lead.updated as unknown as Record<string, unknown>),
    followUpId: lead.followUpId,
  };
}

export async function createLeadWithDuplicateInfo(
  actor: AuthUser,
  input: z.infer<typeof createLeadSchema>,
) {
  try {
    return await createLead(actor, input);
  } catch (error) {
    if (error instanceof HttpError && error.code === "DUPLICATE") {
      const data = createLeadSchema.parse(input);
      const mobileE164 = normalizeMobile(data.mobile);
      const existing = await findDuplicate(data.clientId, mobileE164);
      throw new DuplicateLeadError(
        error.message,
        existing ? serializeLead(existing as unknown as Record<string, unknown>) : null,
      );
    }
    throw error;
  }
}

export async function collapseDuplicateLeads(actor: AuthUser, clientId?: string) {
  await ensureOpsTables();
  const scope = await leadScopeWhere(actor);
  const duplicateStatus = await prisma.leadStatus.findUnique({ where: { key: "DUPLICATE" } });
  if (!duplicateStatus) throw new HttpError(500, "Duplicate status is missing", "MISSING_STATUS");

  const leads = await prisma.lead.findMany({
    where: {
      AND: [scope, clientId ? { clientId } : {}, { duplicateOfId: null }],
    },
    select: {
      id: true,
      clientId: true,
      mobileE164: true,
      createdAt: true,
      callAttempts: true,
      converted: true,
      status: { select: { isFinal: true, key: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const groups = new Map<string, typeof leads>();
  for (const lead of leads) {
    const key = `${lead.clientId}:${lead.mobileE164}`;
    const list = groups.get(key) ?? [];
    list.push(lead);
    groups.set(key, list);
  }

  let collapsed = 0;
  let groupsTouched = 0;
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    groupsTouched += 1;
    const ranked = [...group].sort((a, b) => {
      const score = (row: (typeof group)[number]) =>
        (row.converted ? 1000 : 0) + row.callAttempts + (row.status.isFinal && row.status.key !== "DUPLICATE" ? 20 : 0);
      const diff = score(b) - score(a);
      if (diff !== 0) return diff;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
    const keep = ranked[0];
    const drop = ranked.slice(1);
    for (const extra of drop) {
      await prisma.lead.update({
        where: { id: extra.id },
        data: {
          duplicateOfId: keep.id,
          statusId: duplicateStatus.id,
          lastActivityAt: new Date(),
        },
      });
      collapsed += 1;
    }
  }

  await writeAudit({
    userId: actor.id,
    action: "lead.duplicates_collapsed",
    entityType: clientId ? "client" : "lead",
    entityId: clientId ?? actor.id,
    newValue: { collapsed, groupsTouched },
  });
  return { collapsed, groups: groupsTouched, kept: leads.length - collapsed };
}
