import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import type { AuthUser } from "@/lib/rbac";
import { leadScopeWhere } from "@/lib/scope";
import { HttpError } from "@/lib/session";
import { replaceOpenFollowup } from "@/modules/followups/sync";
import { applyScore, notify } from "@/modules/ops/service";
import { requireLeadAccess, serializeLead } from "@/modules/leads/service";
import { ADMISSION_STATUSES, PAYMENT_STATUSES } from "@/modules/education/types";

const optionalText = z.string().trim().max(120).optional().or(z.literal(""));
const optionalMoney = z.union([z.coerce.number().min(0), z.literal("")]).optional();

export const educationDetailsSchema = z.object({
  studentName: optionalText,
  parentName: optionalText,
  currentClass: optionalText,
  completedClass: optionalText,
  targetClass: optionalText,
  board: optionalText,
  course: optionalText,
  stream: optionalText,
  preferredCourse: optionalText,
  entranceExam: optionalText,
  academicScore: optionalText,
  location: optionalText,
  preferredCampus: optionalText,
  hostelRequired: z.union([z.boolean(), z.enum(["true", "false", ""]), z.null()]).optional(),
  parentOccupation: optionalText,
  budget: optionalMoney,
  admissionTimeline: optionalText,
  campusVisitDate: z.string().optional().or(z.literal("")),
  counsellingDate: z.string().optional().or(z.literal("")),
  admissionStatus: z.union([z.enum(ADMISSION_STATUSES), z.literal("")]).optional(),
  fee: optionalMoney,
  scholarship: optionalMoney,
  paymentStatus: z.union([z.enum(PAYMENT_STATUSES), z.literal("")]).optional(),
});

export const campusVisitSchema = z.object({
  scheduledAt: z.string().min(1),
  campus: z.string().trim().max(120).optional().or(z.literal("")),
});

export const completeVisitSchema = z.object({
  outcome: z.string().trim().max(400).optional().or(z.literal("")),
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

function hostel(value: z.infer<typeof educationDetailsSchema>["hostelRequired"]) {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return null;
}

function serializeEdu(row: {
  budget: { toString(): string } | null;
  fee: { toString(): string } | null;
  scholarship: { toString(): string } | null;
  campusVisitDate: Date | null;
  counsellingDate: Date | null;
} & Record<string, unknown>) {
  return {
    ...row,
    budget: row.budget == null ? null : Number(row.budget.toString()),
    fee: row.fee == null ? null : Number(row.fee.toString()),
    scholarship: row.scholarship == null ? null : Number(row.scholarship.toString()),
    campusVisitDate: row.campusVisitDate?.toISOString() ?? null,
    counsellingDate: row.counsellingDate?.toISOString() ?? null,
  };
}

export async function listEducationPipeline() {
  return prisma.pipelineStage.findMany({
    where: { pipeline: { id: "seed-pipeline-education" } },
    include: { status: true },
    orderBy: { sortOrder: "asc" },
  });
}

export async function listEducationBoard(
  actor: AuthUser,
  raw: { q?: string; statusKey?: string; visit?: string },
) {
  const scope = await leadScopeWhere(actor);
  const stages = await listEducationPipeline();
  const educationWhere = {
    AND: [scope, { industry: { key: "education" }, deletedAt: null }],
  };

  const statusCounts = await prisma.lead.groupBy({
    by: ["statusId"],
    where: educationWhere,
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
      educationWhere,
      raw.statusKey ? { status: { key: raw.statusKey } } : {},
      raw.q
        ? {
            OR: [
              { fullName: { contains: raw.q, mode: "insensitive" as const } },
              { mobileE164: { contains: raw.q.replace(/\s/g, "") } },
              { leadNumber: { contains: raw.q, mode: "insensitive" as const } },
              { education: { studentName: { contains: raw.q, mode: "insensitive" as const } } },
              { education: { parentName: { contains: raw.q, mode: "insensitive" as const } } },
            ],
          }
        : {},
      raw.visit === "scheduled"
        ? { campusVisits: { some: { completedAt: null, scheduledAt: { not: null } } } }
        : raw.visit === "completed"
          ? { campusVisits: { some: { completedAt: { not: null } } } }
          : raw.visit === "none"
            ? { campusVisits: { none: {} } }
            : {},
    ],
  };

  const [total, campusScheduled, campusCompleted, counselling, applications, admissions, leads] =
    await Promise.all([
      prisma.lead.count({ where: educationWhere }),
      prisma.campusVisit.count({
        where: { completedAt: null, scheduledAt: { not: null }, lead: educationWhere },
      }),
      prisma.campusVisit.count({
        where: { completedAt: { not: null }, lead: educationWhere },
      }),
      prisma.lead.count({
        where: { AND: [educationWhere, { status: { key: "COUNSELLING" } }] },
      }),
      prisma.lead.count({
        where: { AND: [educationWhere, { status: { key: "APPLICATION" } }] },
      }),
      prisma.lead.count({
        where: {
          AND: [educationWhere, { status: { key: { in: ["ADMISSION_CONFIRMED", "CLOSED_WON"] } } }],
        },
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
          education: true,
          campusVisits: { orderBy: { scheduledAt: "desc" }, take: 1 },
        },
        orderBy: [{ nextFollowupAt: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }],
        take: 100,
      }),
    ]);

  return {
    pipeline,
    kpis: {
      leads: total,
      campusScheduled,
      campusCompleted,
      counselling,
      applications,
      admissions,
    },
    items: leads.map((lead) => {
      const serialized = serializeLead(lead as unknown as Record<string, unknown>);
      const latestVisit = lead.campusVisits[0];
      return {
        ...serialized,
        education: lead.education ? serializeEdu(lead.education) : null,
        latestVisit: latestVisit
          ? {
              id: latestVisit.id,
              scheduledAt: latestVisit.scheduledAt?.toISOString() ?? null,
              completedAt: latestVisit.completedAt?.toISOString() ?? null,
              campus: latestVisit.campus,
              outcome: latestVisit.outcome,
            }
          : null,
      };
    }),
  };
}

export async function upsertEducationDetails(
  actor: AuthUser,
  leadId: string,
  input: z.infer<typeof educationDetailsSchema>,
) {
  const data = educationDetailsSchema.parse(input);
  const existing = await requireLeadAccess(actor, leadId);
  if (existing.industry.key !== "education") {
    throw new HttpError(400, "This lead is not on the education pipeline", "NOT_EDUCATION");
  }

  const payload = {
    studentName: text(data.studentName),
    parentName: text(data.parentName),
    currentClass: text(data.currentClass),
    completedClass: text(data.completedClass),
    targetClass: text(data.targetClass),
    board: text(data.board),
    course: text(data.course),
    stream: text(data.stream),
    preferredCourse: text(data.preferredCourse),
    entranceExam: text(data.entranceExam),
    academicScore: text(data.academicScore),
    location: text(data.location),
    preferredCampus: text(data.preferredCampus),
    hostelRequired: hostel(data.hostelRequired),
    parentOccupation: text(data.parentOccupation),
    budget: money(data.budget),
    admissionTimeline: text(data.admissionTimeline),
    campusVisitDate: dateOnly(data.campusVisitDate),
    counsellingDate: dateOnly(data.counsellingDate),
    admissionStatus: text(data.admissionStatus),
    fee: money(data.fee),
    scholarship: money(data.scholarship),
    paymentStatus: text(data.paymentStatus),
  };

  const saved = await prisma.$transaction(async (tx) => {
    const details = await tx.educationDetails.upsert({
      where: { leadId },
      update: payload,
      create: { leadId, ...payload },
    });
    await tx.lead.update({ where: { id: leadId }, data: { lastActivityAt: new Date() } });
    await tx.activity.create({
      data: {
        leadId,
        userId: actor.id,
        type: "education",
        title: "Education details updated",
        body: [payload.targetClass, payload.preferredCampus, payload.admissionStatus]
          .filter(Boolean)
          .join(" · "),
      },
    });
    return details;
  });

  await writeAudit({
    userId: actor.id,
    action: "lead.education_updated",
    entityType: "lead",
    entityId: leadId,
    newValue: { admissionStatus: payload.admissionStatus, targetClass: payload.targetClass },
  });

  return serializeEdu(saved);
}

export async function scheduleCampusVisit(
  actor: AuthUser,
  leadId: string,
  input: z.infer<typeof campusVisitSchema>,
) {
  const data = campusVisitSchema.parse(input);
  const existing = await requireLeadAccess(actor, leadId);
  if (existing.industry.key !== "education") {
    throw new HttpError(400, "This lead is not on the education pipeline", "NOT_EDUCATION");
  }
  const scheduledAt = new Date(data.scheduledAt);
  if (Number.isNaN(scheduledAt.getTime())) {
    throw new HttpError(400, "Invalid campus visit date", "VALIDATION");
  }
  const campus = text(data.campus) ?? existing.education?.preferredCampus ?? null;
  const campusStatus = await prisma.leadStatus.findUnique({ where: { key: "CAMPUS_VISIT" } });

  const visit = await prisma.$transaction(async (tx) => {
    const created = await tx.campusVisit.create({
      data: { leadId, scheduledAt, campus },
    });
    await replaceOpenFollowup(tx, {
      leadId,
      ownerUserId: existing.assignedUserId ?? actor.id,
      actorId: actor.id,
      dueAt: scheduledAt,
      action: campus ? `Campus visit · ${campus}` : "Campus visit",
    });
    await tx.educationDetails.upsert({
      where: { leadId },
      update: {
        campusVisitDate: scheduledAt,
        preferredCampus: campus ?? undefined,
      },
      create: {
        leadId,
        campusVisitDate: scheduledAt,
        preferredCampus: campus,
        studentName: existing.fullName,
      },
    });
    await tx.lead.update({
      where: { id: leadId },
      data: {
        nextFollowupAt: scheduledAt,
        nextAction: campus ? `Campus visit · ${campus}` : "Campus visit",
        statusId:
          campusStatus && !existing.status.isFinal ? campusStatus.id : existing.statusId,
        lastActivityAt: new Date(),
      },
    });
    await tx.activity.create({
      data: {
        leadId,
        userId: actor.id,
        type: "visit",
        title: "Campus visit scheduled",
        body: [campus, scheduledAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })]
          .filter(Boolean)
          .join(" · "),
        refTable: "campus_visits",
        refId: created.id,
      },
    });
    return created;
  });

  await writeAudit({
    userId: actor.id,
    action: "lead.campus_visit_scheduled",
    entityType: "lead",
    entityId: leadId,
    newValue: { visitId: visit.id, campus },
  });
  await applyScore(leadId, "visit_agreed", actor.id);
  if (existing.assignedUserId) {
    await notify({
      userId: existing.assignedUserId,
      type: "campus_visit",
      title: "Campus visit scheduled",
      body: existing.fullName,
      leadId,
    });
  }
  return visit;
}

export async function completeCampusVisit(
  actor: AuthUser,
  leadId: string,
  visitId: string,
  input: z.infer<typeof completeVisitSchema>,
) {
  const data = completeVisitSchema.parse(input);
  await requireLeadAccess(actor, leadId);
  const visit = await prisma.campusVisit.findFirst({ where: { id: visitId, leadId } });
  if (!visit) throw new HttpError(404, "Campus visit not found", "NOT_FOUND");
  if (visit.completedAt) return visit;

  const updated = await prisma.$transaction(async (tx) => {
    const done = await tx.campusVisit.update({
      where: { id: visitId },
      data: { completedAt: new Date(), outcome: text(data.outcome) },
    });
    await tx.lead.update({ where: { id: leadId }, data: { lastActivityAt: new Date() } });
    await tx.activity.create({
      data: {
        leadId,
        userId: actor.id,
        type: "visit",
        title: "Campus visit completed",
        body: data.outcome || visit.campus,
        refTable: "campus_visits",
        refId: visitId,
      },
    });
    return done;
  });

  await writeAudit({
    userId: actor.id,
    action: "lead.campus_visit_completed",
    entityType: "lead",
    entityId: leadId,
    newValue: { visitId, outcome: data.outcome },
  });
  await applyScore(leadId, "visit_completed", actor.id);
  return updated;
}
