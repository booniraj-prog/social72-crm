import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import type { AuthUser } from "@/lib/rbac";
import { leadScopeWhere } from "@/lib/scope";
import { HttpError } from "@/lib/session";
import { replaceOpenFollowup } from "@/modules/followups/sync";
import { applyScore, notify } from "@/modules/ops/service";
import { requireLeadAccess, serializeLead } from "@/modules/leads/service";
import {
  CONFIGURATIONS,
  NEGOTIATION_STATUSES,
  PROPERTY_TYPES,
  PURPOSES,
  REGISTRATION_STATUSES,
  SITE_VISIT_STATUSES,
  USE_TYPES,
} from "@/modules/real-estate/types";

const optionalText = z.string().trim().max(120).optional().or(z.literal(""));
const optionalMoney = z.union([z.coerce.number().min(0), z.literal("")]).optional();
const optionalUuid = z.union([z.string().uuid(), z.literal("")]).optional();
const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.union([z.enum(values), z.literal("")]).optional();

export const realEstateDetailsSchema = z.object({
  propertyId: optionalUuid,
  projectId: optionalUuid,
  location: optionalText,
  propertyType: optionalEnum(PROPERTY_TYPES),
  configuration: optionalEnum(CONFIGURATIONS),
  budget: optionalMoney,
  preferredLocation: optionalText,
  purpose: optionalEnum(PURPOSES),
  useType: optionalEnum(USE_TYPES),
  possessionRequirement: optionalText,
  loanRequired: z.union([z.boolean(), z.enum(["true", "false", ""]), z.null()]).optional(),
  siteVisitDate: z.string().optional().or(z.literal("")),
  siteVisitStatus: optionalEnum(SITE_VISIT_STATUSES),
  negotiationStatus: optionalEnum(NEGOTIATION_STATUSES),
  bookingAmount: optionalMoney,
  expectedRegistrationDate: z.string().optional().or(z.literal("")),
  registrationStatus: optionalEnum(REGISTRATION_STATUSES),
  propertyValue: optionalMoney,
});

export const siteVisitSchema = z.object({
  scheduledAt: z.string().min(1),
  propertyId: optionalUuid,
});

export const completeVisitSchema = z.object({
  outcome: z.string().trim().max(400).optional().or(z.literal("")),
});

export const projectSchema = z.object({
  clientId: z.string().uuid(),
  name: z.string().trim().min(2).max(160),
  location: optionalText,
});

export const propertySchema = z.object({
  clientId: z.string().uuid(),
  projectId: optionalUuid,
  name: z.string().trim().min(2).max(160),
  propertyType: optionalEnum(PROPERTY_TYPES),
  configuration: optionalEnum(CONFIGURATIONS),
  location: optionalText,
  value: optionalMoney,
});

function text(value?: string) {
  return value ? value : null;
}

function money(value?: number | "") {
  if (value === undefined || value === "") return null;
  return value;
}

function dateOnly(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function flag(value: z.infer<typeof realEstateDetailsSchema>["loanRequired"]) {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return null;
}

function asNumber(value: { toString(): string } | null | undefined) {
  return value == null ? null : Number(value.toString());
}

function serializeRe(row: {
  budget: { toString(): string } | null;
  bookingAmount: { toString(): string } | null;
  propertyValue: { toString(): string } | null;
  siteVisitDate: Date | null;
  expectedRegistrationDate: Date | null;
  project?: { id: string; name: string; location: string | null } | null;
  property?: { id: string; name: string; configuration: string | null } | null;
} & Record<string, unknown>) {
  const { project, property, ...rest } = row;
  return {
    ...rest,
    budget: asNumber(row.budget),
    bookingAmount: asNumber(row.bookingAmount),
    propertyValue: asNumber(row.propertyValue),
    siteVisitDate: row.siteVisitDate?.toISOString() ?? null,
    expectedRegistrationDate: row.expectedRegistrationDate?.toISOString() ?? null,
    project: project ? { id: project.id, name: project.name, location: project.location } : null,
    property: property
      ? { id: property.id, name: property.name, configuration: property.configuration }
      : null,
  };
}

export async function listRealEstateInventory(clientId?: string) {
  const where = clientId ? { clientId } : {};
  const [projects, properties] = await Promise.all([
    prisma.project.findMany({
      where: { ...where, isActive: true },
      include: { client: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.property.findMany({
      where,
      include: { project: { select: { name: true } }, client: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
  ]);
  return {
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      location: p.location,
      clientId: p.clientId,
      clientName: p.client.name,
    })),
    properties: properties.map((p) => ({
      id: p.id,
      name: p.name,
      projectId: p.projectId,
      clientId: p.clientId,
      propertyType: p.propertyType,
      configuration: p.configuration,
      location: p.location,
      value: asNumber(p.value),
      projectName: p.project?.name ?? null,
      clientName: p.client.name,
    })),
  };
}

export async function createProject(actorId: string, input: z.infer<typeof projectSchema>) {
  const data = projectSchema.parse(input);
  const client = await prisma.client.findUnique({ where: { id: data.clientId } });
  if (!client) throw new HttpError(404, "Client not found", "NOT_FOUND");
  const project = await prisma.project.create({
    data: { clientId: data.clientId, name: data.name, location: text(data.location) },
  });
  await writeAudit({
    userId: actorId,
    action: "project.created",
    entityType: "project",
    entityId: project.id,
    newValue: { name: project.name },
  });
  return project;
}

export async function createProperty(actorId: string, input: z.infer<typeof propertySchema>) {
  const data = propertySchema.parse(input);
  const client = await prisma.client.findUnique({ where: { id: data.clientId } });
  if (!client) throw new HttpError(404, "Client not found", "NOT_FOUND");
  const property = await prisma.property.create({
    data: {
      clientId: data.clientId,
      projectId: text(data.projectId),
      name: data.name,
      propertyType: text(data.propertyType),
      configuration: text(data.configuration),
      location: text(data.location),
      value: money(data.value),
    },
  });
  await writeAudit({
    userId: actorId,
    action: "property.created",
    entityType: "property",
    entityId: property.id,
    newValue: { name: property.name },
  });
  return property;
}

export async function listRealEstateBoard(
  actor: AuthUser,
  raw: { q?: string; statusKey?: string; visit?: string },
) {
  const scope = await leadScopeWhere(actor);
  const stages = await prisma.pipelineStage.findMany({
    where: { pipeline: { id: "seed-pipeline-real-estate" } },
    include: { status: true },
    orderBy: { sortOrder: "asc" },
  });
  const reWhere = {
    AND: [scope, { industry: { key: "real_estate" }, deletedAt: null }],
  };

  const statusCounts = await prisma.lead.groupBy({
    by: ["statusId"],
    where: reWhere,
    _count: { _all: true },
  });
  const countByStatusId = new Map(statusCounts.map((row) => [row.statusId, row._count._all]));
  const pipeline = stages.map((stage) => ({
    id: stage.id,
    name: stage.name,
    sortOrder: stage.sortOrder,
    statusId: stage.statusId,
    statusKey: stage.status.key,
    count: countByStatusId.get(stage.statusId) ?? 0,
  }));

  const where = {
    AND: [
      reWhere,
      raw.statusKey ? { status: { key: raw.statusKey } } : {},
      raw.q
        ? {
            OR: [
              { fullName: { contains: raw.q, mode: "insensitive" as const } },
              { mobileE164: { contains: raw.q.replace(/\s/g, "") } },
              { leadNumber: { contains: raw.q, mode: "insensitive" as const } },
              { realEstate: { preferredLocation: { contains: raw.q, mode: "insensitive" as const } } },
              { realEstate: { property: { name: { contains: raw.q, mode: "insensitive" as const } } } },
            ],
          }
        : {},
      raw.visit === "scheduled"
        ? { siteVisits: { some: { completedAt: null, scheduledAt: { not: null } } } }
        : raw.visit === "completed"
          ? { siteVisits: { some: { completedAt: { not: null } } } }
          : raw.visit === "none"
            ? { siteVisits: { none: {} } }
            : {},
    ],
  };

  const [total, visitsScheduled, visitsDone, bookings, registrations, leads, inventory] =
    await Promise.all([
      prisma.lead.count({ where: reWhere }),
      prisma.siteVisit.count({
        where: { completedAt: null, scheduledAt: { not: null }, lead: reWhere },
      }),
      prisma.siteVisit.count({
        where: { completedAt: { not: null }, lead: reWhere },
      }),
      prisma.lead.count({ where: { AND: [reWhere, { status: { key: "BOOKING" } }] } }),
      prisma.lead.count({
        where: { AND: [reWhere, { status: { key: { in: ["REGISTRATION", "CLOSED_WON"] } } }] },
      }),
      prisma.lead.findMany({
        where,
        include: {
          client: { select: { id: true, name: true } },
          campaign: { select: { id: true, name: true } },
          status: true,
          assignedUser: { select: { id: true, name: true } },
          source: true,
          industry: { select: { id: true, key: true, name: true } },
          realEstate: { include: { project: true, property: true } },
          siteVisits: { orderBy: { scheduledAt: "desc" }, take: 1 },
        },
        orderBy: [{ nextFollowupAt: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }],
        take: 100,
      }),
      listRealEstateInventory(),
    ]);

  return {
    pipeline,
    kpis: {
      leads: total,
      visitsScheduled,
      visitsDone,
      bookings,
      registrations,
      properties: inventory.properties.length,
    },
    inventory,
    items: leads.map((lead) => {
      const serialized = serializeLead(lead as unknown as Record<string, unknown>);
      const latestVisit = lead.siteVisits[0];
      return {
        ...serialized,
        realEstate: lead.realEstate ? serializeRe(lead.realEstate) : null,
        latestVisit: latestVisit
          ? {
              id: latestVisit.id,
              scheduledAt: latestVisit.scheduledAt?.toISOString() ?? null,
              completedAt: latestVisit.completedAt?.toISOString() ?? null,
              outcome: latestVisit.outcome,
            }
          : null,
      };
    }),
  };
}

export async function upsertRealEstateDetails(
  actor: AuthUser,
  leadId: string,
  input: z.infer<typeof realEstateDetailsSchema>,
) {
  const data = realEstateDetailsSchema.parse(input);
  const existing = await requireLeadAccess(actor, leadId);
  if (existing.industry.key !== "real_estate") {
    throw new HttpError(400, "This lead is not on the real estate pipeline", "NOT_REAL_ESTATE");
  }

  const payload = {
    propertyId: text(data.propertyId),
    projectId: text(data.projectId),
    location: text(data.location),
    propertyType: text(data.propertyType),
    configuration: text(data.configuration),
    budget: money(data.budget),
    preferredLocation: text(data.preferredLocation),
    purpose: text(data.purpose),
    useType: text(data.useType),
    possessionRequirement: text(data.possessionRequirement),
    loanRequired: flag(data.loanRequired),
    siteVisitDate: dateOnly(data.siteVisitDate),
    siteVisitStatus: text(data.siteVisitStatus),
    negotiationStatus: text(data.negotiationStatus),
    bookingAmount: money(data.bookingAmount),
    expectedRegistrationDate: dateOnly(data.expectedRegistrationDate),
    registrationStatus: text(data.registrationStatus),
    propertyValue: money(data.propertyValue),
  };

  const saved = await prisma.$transaction(async (tx) => {
    const details = await tx.realEstateDetails.upsert({
      where: { leadId },
      update: payload,
      create: { leadId, ...payload },
      include: { project: true, property: true },
    });
    await tx.lead.update({ where: { id: leadId }, data: { lastActivityAt: new Date() } });
    await tx.activity.create({
      data: {
        leadId,
        userId: actor.id,
        type: "real_estate",
        title: "Real estate details updated",
        body: [details.property?.name, payload.configuration, payload.registrationStatus]
          .filter(Boolean)
          .join(" · "),
      },
    });
    return details;
  });

  await writeAudit({
    userId: actor.id,
    action: "lead.real_estate_updated",
    entityType: "lead",
    entityId: leadId,
    newValue: { propertyId: payload.propertyId, registrationStatus: payload.registrationStatus },
  });
  return serializeRe(saved);
}

export async function scheduleSiteVisit(
  actor: AuthUser,
  leadId: string,
  input: z.infer<typeof siteVisitSchema>,
) {
  const data = siteVisitSchema.parse(input);
  const existing = await requireLeadAccess(actor, leadId);
  if (existing.industry.key !== "real_estate") {
    throw new HttpError(400, "This lead is not on the real estate pipeline", "NOT_REAL_ESTATE");
  }
  const scheduledAt = new Date(data.scheduledAt);
  if (Number.isNaN(scheduledAt.getTime())) {
    throw new HttpError(400, "Invalid site visit date", "VALIDATION");
  }
  const propertyId = text(data.propertyId) ?? existing.realEstate?.propertyId ?? null;
  const visitStatus = await prisma.leadStatus.findUnique({ where: { key: "SITE_VISIT" } });

  const visit = await prisma.$transaction(async (tx) => {
    const created = await tx.siteVisit.create({
      data: { leadId, scheduledAt, propertyId },
    });
    await replaceOpenFollowup(tx, {
      leadId,
      ownerUserId: existing.assignedUserId ?? actor.id,
      actorId: actor.id,
      dueAt: scheduledAt,
      action: "Site visit",
    });
    await tx.realEstateDetails.upsert({
      where: { leadId },
      update: {
        siteVisitDate: scheduledAt,
        siteVisitStatus: "Planned",
        propertyId: propertyId ?? undefined,
      },
      create: {
        leadId,
        siteVisitDate: scheduledAt,
        siteVisitStatus: "Planned",
        propertyId,
      },
    });
    await tx.lead.update({
      where: { id: leadId },
      data: {
        nextFollowupAt: scheduledAt,
        nextAction: "Site visit",
        statusId: visitStatus && !existing.status.isFinal ? visitStatus.id : existing.statusId,
        lastActivityAt: new Date(),
      },
    });
    await tx.activity.create({
      data: {
        leadId,
        userId: actor.id,
        type: "visit",
        title: "Site visit scheduled",
        body: scheduledAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
        refTable: "site_visits",
        refId: created.id,
      },
    });
    return created;
  });

  await writeAudit({
    userId: actor.id,
    action: "lead.site_visit_scheduled",
    entityType: "lead",
    entityId: leadId,
    newValue: { visitId: visit.id, propertyId },
  });
  await applyScore(leadId, "visit_agreed", actor.id);
  if (existing.assignedUserId) {
    await notify({
      userId: existing.assignedUserId,
      type: "site_visit",
      title: "Site visit scheduled",
      body: existing.fullName,
      leadId,
    });
  }
  return visit;
}

export async function completeSiteVisit(
  actor: AuthUser,
  leadId: string,
  visitId: string,
  input: z.infer<typeof completeVisitSchema>,
) {
  const data = completeVisitSchema.parse(input);
  const existing = await requireLeadAccess(actor, leadId);
  const visit = await prisma.siteVisit.findFirst({ where: { id: visitId, leadId } });
  if (!visit) throw new HttpError(404, "Site visit not found", "NOT_FOUND");
  if (visit.completedAt) return visit;
  const doneStatus = await prisma.leadStatus.findUnique({ where: { key: "SITE_VISIT_COMPLETED" } });

  const updated = await prisma.$transaction(async (tx) => {
    const done = await tx.siteVisit.update({
      where: { id: visitId },
      data: { completedAt: new Date(), outcome: text(data.outcome) },
    });
    await tx.realEstateDetails.updateMany({
      where: { leadId },
      data: { siteVisitStatus: "Completed" },
    });
    await tx.lead.update({
      where: { id: leadId },
      data: {
        lastActivityAt: new Date(),
        statusId:
          doneStatus && !existing.status.isFinal ? doneStatus.id : existing.statusId,
      },
    });
    await tx.activity.create({
      data: {
        leadId,
        userId: actor.id,
        type: "visit",
        title: "Site visit completed",
        body: data.outcome || null,
        refTable: "site_visits",
        refId: visitId,
      },
    });
    return done;
  });

  await writeAudit({
    userId: actor.id,
    action: "lead.site_visit_completed",
    entityType: "lead",
    entityId: leadId,
    newValue: { visitId, outcome: data.outcome },
  });
  await applyScore(leadId, "visit_completed", actor.id);
  return updated;
}
