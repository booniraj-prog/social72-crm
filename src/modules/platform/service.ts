import { z } from "zod";
import { prisma } from "@/lib/db";
import { writeAudit, auditTips } from "@/lib/audit";
import { HttpError } from "@/lib/session";
import type { AuthUser } from "@/lib/rbac";
import { canApproveSpend, canCreateProposal, canDeleteRecords, canTagProposal } from "@/lib/rbac";
import { canApprove } from "@/lib/approvals";
import { optionalEmail, optionalId, optionalPassword, requiredId } from "@/lib/ids";
import { ensureOpsTables } from "@/lib/ops-tables";
import {
  asDate,
  asMoney,
  asText,
  getTrashItem,
  markTrashRestored,
  putInTrash,
  type TrashPayload,
} from "@/lib/trash";
import { forecastFrom, marginFloor } from "@/modules/resources/service";
import { hashPassword } from "better-auth/crypto";
import { createUser } from "@/modules/users/service";
import { alertChannelsForUser } from "@/lib/notify";
import {
  applyProposalDiscount,
  normalizeCosting,
  parseCostingJson,
  proposalCommercialLines,
  proposalInternals,
} from "@/lib/proposal-costing";
import { round2 } from "@/lib/money";
import { paymentStatus, poPaymentStatus, vsBench } from "@/lib/commercial";
import { istPeriodRange, startOfIstDay } from "@/lib/time";
import { computeLeadMetrics, metricsFromCounts } from "@/modules/insights/service";
import {
  BILLING_CYCLES,
  DOCUMENT_KINDS,
  ENGAGEMENT_STATUSES,
  EXPENSE_CATEGORIES,
  EXPENSE_STATUSES,
  INVOICE_KINDS,
  INVOICE_STATUSES,
  LICENSE_CATEGORIES,
  PRIORITIES,
  PURCHASE_STATUSES,
  SERVICE_LINES,
  TASK_STATUSES,
  DELIVERABLE_STATUSES,
} from "@/modules/platform/constants";

function money(n: unknown) {
  return Number(n ?? 0);
}

function emptyId(value?: string | null) {
  return value ? value : null;
}

async function resolveProject(engagementId?: string | null, clientId?: string | null) {
  const eid = emptyId(engagementId);
  if (!eid) return { engagementId: null as string | null, clientId: emptyId(clientId) };
  const project = await prisma.engagement.findUnique({ where: { id: eid } });
  if (!project) throw new HttpError(400, "Project not found", "BAD_PROJECT");
  return { engagementId: project.id, clientId: emptyId(clientId) ?? project.clientId };
}

async function applyProjectCost(engagementId: string | null | undefined, amount: number, sign: 1 | -1) {
  if (!engagementId || !amount) return;
  const delta = sign * amount;
  await prisma.$executeRaw`UPDATE engagements SET cost = GREATEST(0, cost + ${delta}) WHERE id = ${engagementId}`;
}

async function purchaseEngagementId(id: string) {
  const rows = await prisma.$queryRaw<{ engagement_id: string | null }[]>`
    SELECT engagement_id FROM purchase_orders WHERE id = ${id} LIMIT 1
  `;
  return rows[0]?.engagement_id ?? null;
}

export const engagementSchema = z.object({
  name: z.string().trim().min(2).max(160),
  clientId: requiredId("a client"),
  leadId: optionalId,
  serviceLine: z.string().optional().or(z.literal("")),
  projectType: z.string().optional().or(z.literal("")),
  billingModel: z.string().optional().or(z.literal("")),
  status: z.enum(ENGAGEMENT_STATUSES).optional(),
  budget: z.coerce.number().min(0).optional(),
  poValue: z.coerce.number().min(0).optional(),
  estimatedPeople: z.coerce.number().min(0).optional(),
  estimatedAds: z.coerce.number().min(0).optional(),
  estimatedTools: z.coerce.number().min(0).optional(),
  estimatedOther: z.coerce.number().min(0).optional(),
  dueDate: z.string().optional().or(z.literal("")),
});

export const taskSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  assignedTo: optionalId,
  leadId: optionalId,
  engagementId: optionalId,
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  dueAt: z.string().optional().or(z.literal("")),
});

export const licenseSchema = z.object({
  name: z.string().trim().min(2).max(160),
  vendor: z.string().trim().max(120).optional().or(z.literal("")),
  category: z.string().optional().or(z.literal("")),
  licenseType: z.string().trim().max(80).optional().or(z.literal("")),
  licenseKey: z.string().trim().max(200).optional().or(z.literal("")),
  seats: z.coerce.number().int().min(1).optional(),
  clientId: optionalId,
  engagementId: optionalId,
  ownerUserId: optionalId,
  expiryDate: z.string().optional().or(z.literal("")),
  amount: z.coerce.number().min(0).optional(),
  billingCycle: z.enum(BILLING_CYCLES).optional(),
  autoRenew: z.boolean().optional(),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export const invoiceSchema = z.object({
  id: optionalId,
  clientId: requiredId("a client"),
  leadId: optionalId,
  engagementId: optionalId,
  kind: z.enum(INVOICE_KINDS).optional(),
  status: z.enum(INVOICE_STATUSES).optional(),
  dueDate: z.string().optional().or(z.literal("")),
  gstPct: z.coerce.number().min(0).max(40).optional(),
  notes: z.string().trim().max(8000).optional().or(z.literal("")),
  paymentTerms: z.string().trim().max(200).optional().or(z.literal("")),
  description: z.string().trim().max(200).optional().or(z.literal("")),
  amount: z.coerce.number().min(0).optional(),
  paid: z.coerce.number().min(0).optional(),
  followUpAt: z.string().optional().or(z.literal("")),
  benchmarkAmount: z.coerce.number().min(0).optional(),
  attachmentUrl: z.string().trim().max(500).optional().or(z.literal("")),
  plannedAd: z.coerce.number().min(0).optional(),
  plannedVendor: z.coerce.number().min(0).optional(),
  plannedTools: z.coerce.number().min(0).optional(),
  plannedPeople: z.coerce.number().min(0).optional(),
  discountPct: z.coerce.number().min(0).max(100).optional(),
  discountAmt: z.coerce.number().min(0).optional(),
  manDayRate: z.coerce.number().min(0).optional(),
  costing: z
    .object({
      manDayRate: z.coerce.number().min(0).optional(),
      discountPct: z.coerce.number().min(0).max(100).optional(),
      discountAmt: z.coerce.number().min(0).optional(),
      streams: z
        .array(
          z.object({
            key: z.string(),
            adBudget: z.coerce.number().min(0).optional(),
            manDays: z.coerce.number().min(0).optional(),
            toolCharges: z.coerce.number().min(0).optional(),
            serviceCharges: z.coerce.number().min(0).optional(),
          }),
        )
        .optional(),
    })
    .optional(),
  lines: z
    .array(
      z.object({
        description: z.string().trim().min(1).max(200),
        qty: z.coerce.number().positive(),
        rate: z.coerce.number().min(0),
      }),
    )
    .optional(),
});

export const purchaseSchema = z.object({
  title: z.string().trim().min(2).max(160),
  clientId: optionalId,
  engagementId: optionalId,
  vendorName: z.string().trim().max(120).optional().or(z.literal("")),
  amount: z.coerce.number().min(0).optional(),
  status: z.enum(PURCHASE_STATUSES).optional(),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export const documentSchema = z
  .object({
    id: optionalId,
    title: z.string().trim().min(2).max(160),
    kind: z.enum(DOCUMENT_KINDS).optional(),
    url: z.string().trim().min(4).max(500),
    clientId: optionalId,
    engagementId: optionalId,
    invoiceId: optionalId,
    clientOrderId: optionalId,
    userId: optionalId,
    followUpAt: z.string().optional().or(z.literal("")),
    notes: z.string().trim().max(500).optional().or(z.literal("")),
  })
  .superRefine((value, ctx) => {
    if (!value.clientId && !value.engagementId && !value.invoiceId && !value.clientOrderId && !value.userId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Tag this file to a client, project, invoice, PO or person",
        path: ["clientId"],
      });
    }
  });

export const expenseSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES),
  amount: z.coerce.number().positive(),
  spentOn: z.string().min(1),
  clientId: optionalId,
  engagementId: optionalId,
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  receiptUrl: z.string().trim().max(500).optional().or(z.literal("")),
  status: z.enum(EXPENSE_STATUSES).optional(),
});

export const partnerSchema = z.object({
  name: z.string().trim().min(2).max(160),
  clientId: optionalId,
  mobile: z.string().trim().max(20).optional().or(z.literal("")),
  email: optionalEmail,
  commissionPct: z.coerce.number().int().min(0).max(100).optional(),
});

export const serviceLeadSchema = z.object({
  name: z.string().trim().min(2).max(160),
  mobile: z.string().trim().min(8).max(20),
  clientId: requiredId("a client"),
  serviceLine: z.string().optional().or(z.literal("")),
  captureChannel: z.string().optional().or(z.literal("")),
  priority: z.enum(PRIORITIES).optional(),
});

export const peopleSchema = z.object({
  userId: optionalId,
  name: z.string().trim().min(2).max(120).optional().or(z.literal("")),
  email: optionalEmail,
  password: optionalPassword,
  roleId: optionalId,
  mobile: z.string().trim().max(20).optional().or(z.literal("")),
  designation: z.string().trim().max(80).optional().or(z.literal("")),
  employeeNo: z.string().trim().max(40).optional().or(z.literal("")),
  departmentName: z.string().trim().max(80).optional().or(z.literal("")),
  targetAmount: z.coerce.number().min(0).optional(),
  alertEmail: optionalEmail,
  alertPhone: z.string().trim().max(20).optional().or(z.literal("")),
  photoUrl: z.string().trim().max(500).optional().or(z.literal("")),
  resumeUrl: z.string().trim().max(500).optional().or(z.literal("")),
});

export const leaveSchema = z.object({
  type: z.string().trim().max(40).optional().or(z.literal("")),
  fromDate: z.string().min(1),
  toDate: z.string().min(1),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export const attendanceSchema = z.object({
  userId: optionalId,
  day: z.string().min(1),
  status: z.enum(["PRESENT", "ABSENT", "WFH", "LEAVE"]).optional(),
});

export const serviceDetailsSchema = z.object({
  serviceLine: z.string().optional().or(z.literal("")),
  requirement: z.string().trim().max(4000).optional().or(z.literal("")),
  proposalValue: z.coerce.number().min(0).optional().or(z.literal("")),
  milestone: z.string().trim().max(200).optional().or(z.literal("")),
});

export const courseSchema = z.object({
  clientId: requiredId("a client"),
  name: z.string().trim().min(2).max(160),
  fee: z.coerce.number().min(0).optional(),
  institutionName: z.string().trim().max(160).optional().or(z.literal("")),
});

async function nextNumber(prefix: string, model: "invoice" | "purchaseOrder") {
  const year = new Date().getFullYear();
  const start = `${prefix}-${year}-`;
  const latest =
    model === "invoice"
      ? await prisma.invoice.findFirst({ where: { number: { startsWith: start } }, orderBy: { number: "desc" } })
      : await prisma.purchaseOrder.findFirst({
          where: { number: { startsWith: start } },
          orderBy: { number: "desc" },
        });
  const seq = latest ? Number(latest.number.slice(start.length)) + 1 : 1;
  return `${start}${String(seq).padStart(5, "0")}`;
}

export async function listEngagements() {
  await ensureOpsTables();
  const rows = await prisma.engagement.findMany({
    include: { client: { select: { id: true, name: true } }, manager: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const approvals = await prisma
    .$queryRaw<Array<{ id: string; approval_status: string | null }>>`
      SELECT id, approval_status FROM engagements
    `
    .catch(() => [] as Array<{ id: string; approval_status: string | null }>);
  const byId = Object.fromEntries(approvals.map((row) => [row.id, row.approval_status || "APPROVED"]));
  const flags = await prisma
    .$queryRaw<Array<{ id: string; is_active: boolean | null }>>`
      SELECT id, is_active FROM engagements
    `
    .catch(() => [] as Array<{ id: string; is_active: boolean | null }>);
  const activeById = Object.fromEntries(flags.map((row) => [row.id, row.is_active !== false]));
  return rows.map((r) => ({
    ...r,
    isActive: activeById[r.id] ?? true,
    approvalStatus: byId[r.id] ?? "APPROVED",
    budget: money(r.budget),
    billed: money(r.billed),
    cost: money("cost" in r ? r.cost : 0),
    startDate: r.startDate?.toISOString() ?? null,
    dueDate: r.dueDate?.toISOString() ?? null,
  }));
}

export async function decideEngagement(id: string, status: "APPROVED" | "REJECTED", actor: AuthUser) {
  if (!(await canApprove(actor, "project"))) throw new HttpError(403, "You are not set as a project approver", "FORBIDDEN");
  await ensureOpsTables();
  const nextStatus = status === "APPROVED" ? "OPEN" : "ON_HOLD";
  await prisma.$executeRaw`
    UPDATE engagements SET approval_status = ${status}, status = ${nextStatus} WHERE id = ${id}
  `;
  await writeAudit({
    userId: actor.id,
    action: status === "APPROVED" ? "engagement.approved" : "engagement.rejected",
    entityType: "engagement",
    entityId: id,
  });
  return prisma.engagement.findUnique({ where: { id } });
}

export async function convertLeadToProject(actor: AuthUser, leadId: string) {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId },
    include: { client: true, serviceDetails: true },
  });
  if (!lead) throw new HttpError(404, "Lead not found", "NOT_FOUND");
  const existing = await prisma.engagement.findFirst({ where: { leadId } });
  if (existing) return existing;
  return createEngagement(actor, {
    name: `${lead.fullName} · ${lead.client.name}`,
    clientId: lead.clientId,
    leadId: lead.id,
    serviceLine: lead.serviceLine ?? lead.serviceDetails?.serviceLine ?? "",
    status: "PLANNING",
    budget: Number(lead.expectedValue ?? 0),
  });
}

export async function createEngagement(actor: AuthUser, input: z.infer<typeof engagementSchema>) {
  const data = engagementSchema.parse(input);
  await ensureOpsTables();
  const revenue = data.poValue || data.budget || 0;
  const floor = await marginFloor();
  const forecast = forecastFrom({
    revenue,
    people: data.estimatedPeople,
    ads: data.estimatedAds,
    tools: data.estimatedTools,
    other: data.estimatedOther,
    floor,
  });
  const row = await prisma.engagement.create({
    data: {
      name: data.name,
      clientId: data.clientId,
      leadId: data.leadId || null,
      serviceLine: data.serviceLine || data.projectType || null,
      status: data.status ?? "OPEN",
      budget: revenue,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      managerId: actor.id,
    },
  });
  const auto = await canApprove(actor, "project");
  await prisma.$executeRaw`
    UPDATE engagements
    SET project_type = ${data.projectType || data.serviceLine || null},
        billing_model = ${data.billingModel || null},
        po_value = ${data.poValue ?? revenue},
        estimated_people = ${data.estimatedPeople ?? 0},
        estimated_ads = ${data.estimatedAds ?? 0},
        estimated_tools = ${data.estimatedTools ?? 0},
        estimated_other = ${data.estimatedOther ?? 0},
        approval_status = ${auto ? "APPROVED" : "PENDING"}
    WHERE id = ${row.id}
  `;
  await writeAudit({
    userId: actor.id,
    action: auto ? "engagement.created" : "engagement.submitted",
    entityType: "engagement",
    entityId: row.id,
    newValue: { name: row.name, forecast, approvalStatus: auto ? "APPROVED" : "PENDING" },
  });
  return { ...row, forecast, approvalStatus: auto ? "APPROVED" : "PENDING" };
}

export async function listWorkTasks(actor: AuthUser) {
  const mine = actor.roleKey === "bpo_executive" || actor.roleKey === "employee";
  const rows = await prisma.task.findMany({
    where: mine ? { assignedTo: actor.id } : {},
    include: {
      assignee: { select: { id: true, name: true } },
      lead: { select: { id: true, fullName: true } },
      engagement: { select: { id: true, name: true } },
    },
    orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
    take: 300,
  });
  return rows.map((r) => ({
    ...r,
    dueAt: r.dueAt?.toISOString() ?? null,
    completedAt: r.completedAt?.toISOString() ?? null,
  }));
}

export async function createWorkTask(actor: AuthUser, input: z.infer<typeof taskSchema>) {
  const data = taskSchema.parse(input);
  return prisma.task.create({
    data: {
      title: data.title,
      description: data.description || null,
      assignedTo: data.assignedTo || actor.id,
      leadId: data.leadId || null,
      engagementId: data.engagementId || null,
      status: data.status ?? "OPEN",
      priority: data.priority ?? "MEDIUM",
      dueAt: data.dueAt ? new Date(data.dueAt) : null,
      createdBy: actor.id,
    },
  });
}

export async function completeWorkTask(id: string) {
  return prisma.task.update({
    where: { id },
    data: { status: "DONE", completedAt: new Date() },
  });
}

export async function listLicenses() {
  const rows = await prisma.toolLicense.findMany({
    include: {
      client: { select: { name: true } },
      owner: { select: { name: true } },
      engagement: { select: { name: true } },
    },
    orderBy: { expiryDate: "asc" },
    take: 300,
  });
  const now = new Date();
  const history = await auditTips(
    "tool_license",
    rows.map((r) => r.id),
  );
  return rows.map((r) => {
    const expiry = r.expiryDate;
    const days = expiry ? Math.ceil((expiry.getTime() - now.getTime()) / 86400000) : null;
    let bucket = "active";
    if (!r.ownerUserId && !r.clientId) bucket = "unassigned";
    if (expiry && days !== null && days < 0) bucket = "expired";
    else if (expiry && days !== null && days <= 30) bucket = "expiring";
    return {
      ...r,
      amount: money(r.amount),
      expiryDate: expiry?.toISOString() ?? null,
      daysToExpiry: days,
      bucket,
      history: history[r.id] ?? "",
    };
  });
}

export async function licenseKpis() {
  const licenses = await listLicenses();
  const monthly = licenses.reduce((sum, l) => {
    if (l.billingCycle === "MONTHLY") return sum + l.amount;
    if (l.billingCycle === "YEARLY") return sum + l.amount / 12;
    if (l.billingCycle === "QUARTERLY") return sum + l.amount / 3;
    return sum;
  }, 0);
  return {
    active: licenses.filter((l) => l.bucket === "active").length,
    expiring: licenses.filter((l) => l.bucket === "expiring").length,
    expired: licenses.filter((l) => l.bucket === "expired").length,
    unassigned: licenses.filter((l) => l.bucket === "unassigned").length,
    monthlyCost: Math.round(monthly),
    annualCost: Math.round(monthly * 12),
  };
}

export async function createLicense(actor: AuthUser, input: z.infer<typeof licenseSchema>) {
  const data = licenseSchema.parse(input);
  const project = await resolveProject(data.engagementId, data.clientId);
  const row = await prisma.toolLicense.create({
    data: {
      name: data.name,
      vendor: data.vendor || null,
      category: data.category || LICENSE_CATEGORIES[0],
      licenseType: data.licenseType || null,
      licenseKey: data.licenseKey || null,
      seats: data.seats ?? 1,
      clientId: project.clientId,
      engagementId: project.engagementId,
      ownerUserId: data.ownerUserId || actor.id,
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
      amount: data.amount ?? 0,
      billingCycle: data.billingCycle ?? "YEARLY",
      autoRenew: data.autoRenew ?? false,
      notes: data.notes || null,
    },
  });
  const autoApprove = ["super_admin", "accounts", "crm_manager"].includes(actor.roleKey);
  if (!autoApprove) {
    await prisma.$executeRaw`UPDATE tool_licenses SET status = 'PENDING' WHERE id = ${row.id}`;
  } else {
    await applyProjectCost(project.engagementId, money(data.amount), 1);
  }
  await writeAudit({
    userId: actor.id,
    action: "license.created",
    entityType: "tool_license",
    entityId: row.id,
  });
  return row;
}

export async function updateLicense(actor: AuthUser, id: string, input: z.infer<typeof licenseSchema>) {
  const data = licenseSchema.parse(input);
  const existing = await prisma.toolLicense.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "License not found", "NOT_FOUND");
  const ownPending = existing.ownerUserId === actor.id && existing.status === "PENDING";
  if (!ownPending && !canDeleteRecords(actor) && !canApproveSpend(actor)) {
    throw new HttpError(403, "Not allowed to edit this record", "FORBIDDEN");
  }
  const project = await resolveProject(data.engagementId, data.clientId);
  if (existing.status === "APPROVED") await applyProjectCost(existing.engagementId, money(existing.amount), -1);
  const row = await prisma.toolLicense.update({
    where: { id },
    data: {
      name: data.name,
      vendor: data.vendor || null,
      category: data.category || existing.category,
      licenseKey: data.licenseKey || null,
      seats: data.seats ?? existing.seats,
      clientId: project.clientId,
      engagementId: project.engagementId,
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : existing.expiryDate,
      amount: data.amount ?? 0,
      billingCycle: data.billingCycle ?? existing.billingCycle,
      notes: data.notes || null,
    },
  });
  if (existing.status === "APPROVED") await applyProjectCost(project.engagementId, data.amount ?? 0, 1);
  await writeAudit({
    userId: actor.id,
    action: "license.updated",
    entityType: "tool_license",
    entityId: id,
    oldValue: { name: existing.name, amount: money(existing.amount) },
    newValue: { name: data.name, amount: data.amount ?? 0 },
  });
  return row;
}

export async function getInvoice(id: string) {
  const row = await prisma.invoice.findUnique({
    where: { id },
    include: {
      client: true,
      lead: { select: { id: true, fullName: true, email: true, mobileE164: true } },
      engagement: { select: { id: true, name: true } },
      lines: true,
      owner: { select: { name: true, email: true } },
    },
  });
  if (!row) throw new HttpError(404, "Invoice not found", "NOT_FOUND");
  const extras = await invoiceCommercialExtras(id);
  return {
    ...row,
    subtotal: money(row.subtotal),
    gstPct: money(row.gstPct),
    total: money(row.total),
    paid: money(row.paid),
    outstanding: money(row.total) - money(row.paid),
    issueDate: row.issueDate.toISOString(),
    dueDate: row.dueDate?.toISOString() ?? null,
    paymentTerms: row.paymentTerms,
    discountPct: extras.discountPct,
    discountAmt: extras.discountAmt,
    gross: extras.gross || money(row.subtotal) + extras.discountAmt,
    costing: extras.costing,
    lines: row.lines.map((l) => ({
      id: l.id,
      description: l.description,
      qty: money(l.qty),
      rate: money(l.rate),
      amount: money(l.amount),
    })),
    files: await listDocuments({ invoiceId: id }),
  };
}

async function invoiceCommercialExtras(id: string) {
  try {
    const rows = await prisma.$queryRaw<Array<{ discount_pct: unknown; discount_amt: unknown; costing_json: string | null }>>`
      SELECT discount_pct, discount_amt, costing_json FROM invoices WHERE id = ${id}
    `;
    const row = rows[0];
    const costing = parseCostingJson(row?.costing_json);
    const discountAmt = money(row?.discount_amt);
    const discountPct = money(row?.discount_pct);
    const internals = costing ? proposalInternals(costing) : null;
    const commercial = costing ? proposalCommercialLines(costing).reduce((s, l) => s + l.amount, 0) : 0;
    return { discountPct, discountAmt, costing, gross: commercial || 0, internals };
  } catch {
    return { discountPct: 0, discountAmt: 0, costing: null, gross: 0, internals: null };
  }
}

async function applyInvoiceCommercial(
  id: string,
  data: { followUpAt?: string; benchmarkAmount?: number; engagementId?: string },
) {
  const followUp = data.followUpAt ? new Date(`${data.followUpAt.slice(0, 10)}T00:00:00.000Z`) : null;
  await prisma
    .$executeRaw`
      UPDATE invoices
      SET follow_up_at = ${followUp}::date,
          benchmark_amount = CASE
            WHEN ${data.benchmarkAmount ?? 0} > 0 THEN ${data.benchmarkAmount ?? 0}
            ELSE COALESCE((SELECT po_value FROM engagements WHERE id = ${data.engagementId || null}), COALESCE(benchmark_amount, 0))
          END
      WHERE id = ${id}
    `
    .catch(() => undefined);
}

export async function listInvoices() {
  await ensureOpsTables();
  const rows = await prisma.invoice.findMany({
    include: {
      client: { select: { name: true } },
      lead: { select: { fullName: true } },
      engagement: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const extras = await prisma
    .$queryRaw<
      Array<{
        id: string;
        follow_up_at: Date | null;
        benchmark_amount: unknown;
        po_value: unknown;
        project: string | null;
      }>
    >`
      SELECT i.id, i.follow_up_at, i.benchmark_amount, e.po_value, e.name AS project
      FROM invoices i
      LEFT JOIN engagements e ON e.id = i.engagement_id
    `
    .catch(() => [] as Array<{ id: string; follow_up_at: Date | null; benchmark_amount: unknown; po_value: unknown; project: string | null }>);
  const extraById = Object.fromEntries(extras.map((row) => [row.id, row]));
  const history = await auditTips(
    "invoice",
    rows.map((r) => r.id),
  );
  return rows.map((r) => {
    const extra = extraById[r.id];
    const total = money(r.total);
    const paid = money(r.paid);
    const bench = money(extra?.benchmark_amount) || money(extra?.po_value);
    return {
      ...r,
      subtotal: money(r.subtotal),
      gstPct: money(r.gstPct),
      total,
      paid,
      issueDate: r.issueDate.toISOString(),
      dueDate: r.dueDate?.toISOString() ?? null,
      outstanding: total - paid,
      project: extra?.project ?? r.engagement?.name ?? "—",
      payment: paymentStatus({ total, paid, dueDate: r.dueDate, status: r.status }),
      followUp: extra?.follow_up_at ? new Date(extra.follow_up_at).toISOString().slice(0, 10) : "—",
      bench,
      vsBench: vsBench(total, bench),
      history: history[r.id] ?? "",
    };
  });
}

export const tagProposalSchema = z.object({
  invoiceId: requiredId("a proposal"),
  engagementId: optionalId,
  name: z.string().trim().max(160).optional().or(z.literal("")),
});

type PlannedRow = {
  id: string;
  engagement_id: string | null;
  planned_ad: unknown;
  planned_vendor: unknown;
  planned_tools: unknown;
  planned_people: unknown;
  discount_pct?: unknown;
  discount_amt?: unknown;
  costing_json?: string | null;
};

async function plannedQuoteMap() {
  try {
    const rows = await prisma.$queryRaw<PlannedRow[]>`
      SELECT id, engagement_id, planned_ad, planned_vendor, planned_tools, planned_people, discount_pct, discount_amt, costing_json
      FROM invoices
      WHERE kind = 'QUOTE'
    `;
    return Object.fromEntries(
      rows.map((r) => [
        r.id,
        {
          engagementId: r.engagement_id,
          plannedAd: money(r.planned_ad),
          plannedVendor: money(r.planned_vendor),
          plannedTools: money(r.planned_tools),
          plannedPeople: money(r.planned_people),
          discountPct: money(r.discount_pct),
          discountAmt: money(r.discount_amt),
          costing: parseCostingJson(r.costing_json),
        },
      ]),
    );
  } catch {
    return {} as Record<
      string,
      {
        engagementId: string | null;
        plannedAd: number;
        plannedVendor: number;
        plannedTools: number;
        plannedPeople: number;
        discountPct: number;
        discountAmt: number;
        costing: ReturnType<typeof parseCostingJson>;
      }
    >;
  }
}

export async function listProposals() {
  const [quotes, planned] = await Promise.all([
    prisma.invoice.findMany({
      where: { kind: "QUOTE" },
      include: {
        client: { select: { id: true, name: true } },
        engagement: { select: { id: true, name: true, budget: true } },
        lines: true,
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    plannedQuoteMap(),
  ]);
  const history = await auditTips(
    "invoice",
    quotes.map((q) => q.id),
  );
  return quotes.map((q) => {
    const extra = planned[q.id];
    const plannedAd = extra?.plannedAd ?? 0;
    const plannedVendor = extra?.plannedVendor ?? 0;
    const plannedTools = extra?.plannedTools ?? 0;
    const plannedPeople = extra?.plannedPeople ?? 0;
    const plannedDirect = plannedAd + plannedVendor + plannedTools;
    const billed = money(q.total);
    return {
      id: q.id,
      number: q.number,
      clientId: q.clientId,
      client: q.client.name,
      status: q.status,
      total: billed,
      subtotal: money(q.subtotal),
      gstPct: money(q.gstPct),
      dueDate: q.dueDate?.toISOString() ?? null,
      notes: q.notes,
      paymentTerms: q.paymentTerms,
      projectId: q.engagement?.id ?? extra?.engagementId ?? null,
      project: q.engagement?.name ?? null,
      plannedAd,
      plannedVendor,
      plannedTools,
      plannedPeople,
      plannedCost: plannedDirect + plannedPeople,
      plannedGross: billed - plannedDirect,
      plannedNet: billed - plannedDirect - plannedPeople,
      discountAmt: extra?.discountAmt ?? 0,
      costing: extra?.costing ?? null,
      history: history[q.id] ?? "",
      lines: q.lines.map((l) => ({
        description: l.description,
        qty: money(l.qty),
        rate: money(l.rate),
        amount: money(l.amount),
      })),
    };
  });
}

export async function tagProposalToProject(actor: AuthUser, input: z.infer<typeof tagProposalSchema>) {
  if (!canTagProposal(actor)) throw new HttpError(403, "Sales or a project manager tags a won proposal", "FORBIDDEN");
  const data = tagProposalSchema.parse(input);
  const quote = await prisma.invoice.findUnique({
    where: { id: data.invoiceId },
    include: { client: { select: { name: true } } },
  });
  if (!quote || quote.kind !== "QUOTE") throw new HttpError(404, "Proposal not found", "NOT_FOUND");
  let engagementId = emptyId(data.engagementId);
  const packageName =
    data.name ||
    quote.notes
      ?.split("\n")
      .find((line) => line.startsWith("Package:"))
      ?.replace("Package:", "")
      .trim() ||
    `${quote.client.name} · ${quote.number}`;
  if (!engagementId) {
    const created = await createEngagement(actor, {
      name: packageName,
      clientId: quote.clientId,
      leadId: quote.leadId || "",
      status: "PLANNING",
      budget: money(quote.subtotal),
    });
    engagementId = created.id;
  } else {
    const project = await prisma.engagement.findUnique({ where: { id: engagementId } });
    if (!project) throw new HttpError(400, "Project not found", "BAD_PROJECT");
    if (project.clientId !== quote.clientId) {
      throw new HttpError(400, "Project belongs to a different client", "CLIENT_MISMATCH");
    }
    if (money(project.budget) <= 0 && money(quote.subtotal) > 0) {
      await prisma.engagement.update({ where: { id: engagementId }, data: { budget: quote.subtotal } });
    }
  }
  await prisma.invoice.update({ where: { id: quote.id }, data: { engagementId } });
  await writeAudit({
    userId: actor.id,
    action: "proposal.tagged",
    entityType: "invoice",
    entityId: quote.id,
    newValue: { engagementId },
  });
  return prisma.invoice.findUnique({ where: { id: quote.id }, include: { engagement: true } });
}

const AD_CATEGORIES = new Set(["Advertising"]);
const TOOL_CATEGORIES = new Set(["Software", "SaaS", "Hosting", "Domains", "Marketing tools"]);
const VENDOR_CATEGORIES = new Set(["Vendor"]);

async function safeRaw<T>(query: Promise<T>, fallback: T) {
  try {
    return await query;
  } catch {
    return fallback;
  }
}

export async function projectEconomics() {
  const [projects, invoices, expenses, purchases, licenses, planned] = await Promise.all([
    prisma.engagement.findMany({
      include: { client: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 200,
    }),
    safeRaw(
      prisma.$queryRaw<{ engagement_id: string | null; kind: string; status: string; total: unknown; paid: unknown; subtotal: unknown }[]>`
        SELECT engagement_id, kind, status, total, paid, subtotal FROM invoices
      `,
      [],
    ),
    safeRaw(
      prisma.$queryRaw<{ engagement_id: string | null; category: string; amount: unknown }[]>`
        SELECT engagement_id, category, amount FROM expenses WHERE status IN ('APPROVED', 'REIMBURSED')
      `,
      [],
    ),
    safeRaw(
      prisma.$queryRaw<{ engagement_id: string | null; amount: unknown }[]>`
        SELECT engagement_id, amount FROM purchase_orders WHERE status <> 'REJECTED'
      `,
      [],
    ),
    safeRaw(
      prisma.$queryRaw<{ engagement_id: string | null; amount: unknown; status: string }[]>`
        SELECT engagement_id, amount, status FROM tool_licenses
      `,
      [],
    ),
    plannedQuoteMap(),
  ]);

  return projects.map((project) => {
    const tagged = Object.values(planned).filter((q) => q.engagementId === project.id);
    const plannedAd = tagged.reduce((s, q) => s + q.plannedAd, 0);
    const plannedVendor = tagged.reduce((s, q) => s + q.plannedVendor, 0);
    const plannedTools = tagged.reduce((s, q) => s + q.plannedTools, 0);
    const plannedPeople = tagged.reduce((s, q) => s + q.plannedPeople, 0);
    const quoteFee = invoices
      .filter((i) => i.engagement_id === project.id && i.kind === "QUOTE" && i.status !== "VOID")
      .reduce((s, i) => s + money(i.subtotal), 0);
    const billed = invoices
      .filter((i) => i.engagement_id === project.id && i.kind !== "QUOTE" && !["VOID", "DRAFT"].includes(i.status))
      .reduce((s, i) => s + money(i.total), 0);
    const collected = invoices
      .filter((i) => i.engagement_id === project.id && i.kind !== "QUOTE" && i.status !== "VOID")
      .reduce((s, i) => s + money(i.paid), 0);
    const projectExpenses = expenses.filter((e) => e.engagement_id === project.id);
    const ads = projectExpenses.filter((e) => AD_CATEGORIES.has(e.category)).reduce((s, e) => s + money(e.amount), 0);
    const vendorExp = projectExpenses.filter((e) => VENDOR_CATEGORIES.has(e.category)).reduce((s, e) => s + money(e.amount), 0);
    const toolsExp = projectExpenses.filter((e) => TOOL_CATEGORIES.has(e.category)).reduce((s, e) => s + money(e.amount), 0);
    const other = projectExpenses
      .filter((e) => !AD_CATEGORIES.has(e.category) && !VENDOR_CATEGORIES.has(e.category) && !TOOL_CATEGORIES.has(e.category))
      .reduce((s, e) => s + money(e.amount), 0);
    const vendorPo = purchases.filter((p) => p.engagement_id === project.id).reduce((s, p) => s + money(p.amount), 0);
    const toolsLic = licenses
      .filter((l) => l.engagement_id === project.id && l.status !== "REJECTED")
      .reduce((s, l) => s + money(l.amount), 0);
    const actualAds = ads;
    const actualVendor = vendorPo + vendorExp;
    const actualTools = toolsLic + toolsExp;
    const actualDirect = actualAds + actualVendor + actualTools;
    const actualAll = actualDirect + other;
    const revenue = billed || quoteFee || money(project.budget);
    const gross = revenue - actualDirect;
    const net = revenue - actualAll;
    const plannedGross = revenue - (plannedAd + plannedVendor + plannedTools);
    const plannedNet = plannedGross - plannedPeople;
    return {
      id: project.id,
      name: project.name,
      client: project.client.name,
      status: project.status,
      budget: money(project.budget) || quoteFee,
      billed,
      collected,
      actualDirect,
      actualAll,
      other,
      gross,
      net,
      grossPct: revenue > 0 ? Math.round((gross / revenue) * 1000) / 10 : 0,
      netPct: revenue > 0 ? Math.round((net / revenue) * 1000) / 10 : 0,
      plannedGross,
      plannedNet,
      plannedCost: plannedAd + plannedVendor + plannedTools + plannedPeople,
    };
  });
}

export async function createInvoice(actor: AuthUser, input: z.infer<typeof invoiceSchema>) {
  const data = invoiceSchema.parse(input);
  if ((data.kind ?? "INVOICE") === "QUOTE" && !canCreateProposal(actor)) {
    throw new HttpError(403, "Sales owns proposals", "FORBIDDEN");
  }
  if ((data.kind ?? "INVOICE") !== "QUOTE" && !(await canApprove(actor, "invoice")) && !canCreateProposal(actor)) {
    throw new HttpError(403, "Not allowed to raise this invoice", "FORBIDDEN");
  }
  const costing = data.costing
    ? normalizeCosting({
        ...data.costing,
        manDayRate: data.costing.manDayRate ?? data.manDayRate,
        discountPct: data.costing.discountPct ?? data.discountPct,
        discountAmt: data.costing.discountAmt ?? data.discountAmt,
      })
    : null;
  const internals = costing ? proposalInternals(costing) : null;
  const fromCosting = costing ? proposalCommercialLines(costing) : [];
  const extraLines =
    data.lines && data.lines.length > 0
      ? data.lines.map((l) => {
          const amount = round2(l.qty * l.rate);
          return { description: l.description, qty: l.qty, rate: l.rate, amount };
        })
      : [];
  const builtLines =
    fromCosting.length > 0
      ? [...fromCosting, ...extraLines]
      : extraLines.length > 0
        ? extraLines
        : data.description
          ? [
              {
                description: data.description,
                qty: 1,
                rate: data.amount ?? 0,
                amount: data.amount ?? 0,
              },
            ]
          : [];
  if (builtLines.length === 0) throw new HttpError(400, "Add at least one line item", "VALIDATION");
  const gross = round2(builtLines.reduce((s, l) => s + l.amount, 0));
  const discounted = applyProposalDiscount(gross, costing ?? normalizeCosting({ discountPct: data.discountPct, discountAmt: data.discountAmt }));
  const gstPct = data.gstPct ?? 18;
  const total = round2(discounted.taxable * (1 + gstPct / 100));
  const kind = data.kind ?? "INVOICE";
  const prefix = kind === "QUOTE" ? "QT" : kind === "PROFORMA" ? "PF" : "INV";
  const number = await nextNumber(prefix, "invoice");
  const autoApprove = kind === "QUOTE" ? await canApprove(actor, "proposal") : await canApprove(actor, "invoice");
  const row = await prisma.invoice.create({
    data: {
      number,
      clientId: data.clientId,
      leadId: data.leadId || null,
      engagementId: data.engagementId || null,
      ownerUserId: actor.id,
      kind,
      status: data.status ?? (autoApprove ? "SENT" : "DRAFT"),
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      subtotal: discounted.taxable,
      gstPct,
      total,
      paid: data.paid ?? 0,
      notes: data.notes || null,
      lines: { create: builtLines },
    },
  });
  if (data.paymentTerms) {
    await prisma.$executeRaw`UPDATE invoices SET payment_terms = ${data.paymentTerms} WHERE id = ${row.id}`;
  }
  await applyInvoiceCommercial(row.id, data);
  const plannedAd = internals?.plannedAd ?? data.plannedAd ?? 0;
  const plannedVendor = internals?.plannedVendor ?? data.plannedVendor ?? 0;
  const plannedTools = internals?.plannedTools ?? data.plannedTools ?? 0;
  const plannedPeople = internals?.plannedPeople ?? data.plannedPeople ?? 0;
  const costingJson = costing ? JSON.stringify(costing) : null;
  await prisma.$executeRaw`
    UPDATE invoices
    SET planned_ad = ${plannedAd},
        planned_vendor = ${plannedVendor},
        planned_tools = ${plannedTools},
        planned_people = ${plannedPeople},
        discount_pct = ${discounted.discountAmt && gross ? round2((discounted.discountAmt / gross) * 100) : data.discountPct ?? 0},
        discount_amt = ${discounted.discountAmt},
        costing_json = ${costingJson}
    WHERE id = ${row.id}
  `;
  await writeAudit({
    userId: actor.id,
    action: "invoice.created",
    entityType: "invoice",
    entityId: row.id,
    newValue: { number, total, kind, status: row.status },
  });
  if (data.attachmentUrl) {
    await createDocument(actor, {
      title: `Invoice ${number}`,
      kind: "INVOICE",
      url: data.attachmentUrl,
      clientId: data.clientId,
      engagementId: data.engagementId,
      invoiceId: row.id,
    }).catch(() => undefined);
  }
  return row;
}

export async function updateInvoice(actor: AuthUser, input: z.infer<typeof invoiceSchema>) {
  const data = invoiceSchema.parse(input);
  if (!data.id) throw new HttpError(400, "Missing document id", "VALIDATION");
  const existing = await prisma.invoice.findUnique({ where: { id: data.id }, include: { lines: true } });
  if (!existing) throw new HttpError(404, "Document not found", "NOT_FOUND");
  const costing = data.costing
    ? normalizeCosting({
        ...data.costing,
        manDayRate: data.costing.manDayRate ?? data.manDayRate,
        discountPct: data.costing.discountPct ?? data.discountPct,
        discountAmt: data.costing.discountAmt ?? data.discountAmt,
      })
    : null;
  const internals = costing ? proposalInternals(costing) : null;
  const fromCosting = costing ? proposalCommercialLines(costing) : [];
  const extraLines =
    data.lines && data.lines.length > 0
      ? data.lines.map((l) => {
          const amount = round2(l.qty * l.rate);
          return { description: l.description, qty: l.qty, rate: l.rate, amount };
        })
      : [];
  const builtLines =
    fromCosting.length > 0
      ? [...fromCosting, ...extraLines]
      : extraLines.length > 0
        ? extraLines
        : existing.lines.map((l) => ({
            description: l.description,
            qty: money(l.qty),
            rate: money(l.rate),
            amount: money(l.amount),
          }));
  if (builtLines.length === 0) throw new HttpError(400, "Add at least one line item", "VALIDATION");
  const gross = round2(builtLines.reduce((s, l) => s + l.amount, 0));
  const discounted = applyProposalDiscount(
    gross,
    costing ?? normalizeCosting({ discountPct: data.discountPct, discountAmt: data.discountAmt }),
  );
  const gstPct = data.gstPct ?? money(existing.gstPct);
  const total = round2(discounted.taxable * (1 + gstPct / 100));
  await prisma.invoiceLine.deleteMany({ where: { invoiceId: existing.id } });
  const row = await prisma.invoice.update({
    where: { id: existing.id },
    data: {
      clientId: data.clientId,
      notes: data.notes || null,
      dueDate: data.dueDate ? new Date(data.dueDate) : existing.dueDate,
      subtotal: discounted.taxable,
      gstPct,
      total,
      lines: { create: builtLines },
    },
  });
  if (data.paymentTerms) {
    await prisma.$executeRaw`UPDATE invoices SET payment_terms = ${data.paymentTerms} WHERE id = ${row.id}`;
  }
  await applyInvoiceCommercial(row.id, data);
  const plannedAd = internals?.plannedAd ?? data.plannedAd ?? 0;
  const plannedVendor = internals?.plannedVendor ?? data.plannedVendor ?? 0;
  const plannedTools = internals?.plannedTools ?? data.plannedTools ?? 0;
  const plannedPeople = internals?.plannedPeople ?? data.plannedPeople ?? 0;
  const costingJson = costing ? JSON.stringify(costing) : null;
  await prisma.$executeRaw`
    UPDATE invoices
    SET planned_ad = ${plannedAd},
        planned_vendor = ${plannedVendor},
        planned_tools = ${plannedTools},
        planned_people = ${plannedPeople},
        discount_pct = ${discounted.discountAmt && gross ? round2((discounted.discountAmt / gross) * 100) : data.discountPct ?? 0},
        discount_amt = ${discounted.discountAmt},
        costing_json = ${costingJson}
    WHERE id = ${row.id}
  `;
  await writeAudit({
    userId: actor.id,
    action: existing.kind === "QUOTE" ? "proposal.updated" : "invoice.updated",
    entityType: "invoice",
    entityId: row.id,
    oldValue: { total: money(existing.total), notes: existing.notes },
    newValue: { total, notes: data.notes },
  });
  return row;
}

export async function decideInvoice(id: string, status: "SENT" | "VOID", actor: AuthUser) {
  const existing = await prisma.invoice.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Document not found", "NOT_FOUND");
  const kind: "proposal" | "invoice" = existing.kind === "QUOTE" ? "proposal" : "invoice";
  if (!(await canApprove(actor, kind))) throw new HttpError(403, "You are not set as an approver for this document", "FORBIDDEN");
  const row = await prisma.invoice.update({
    where: { id },
    data: { status },
  });
  await writeAudit({
    userId: actor.id,
    action: status === "SENT" ? "invoice.approved" : "invoice.rejected",
    entityType: "invoice",
    entityId: id,
  });
  return row;
}

export async function listPurchases() {
  const rows = await prisma.purchaseOrder.findMany({
    include: { vendor: true, client: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const links = await prisma.$queryRaw<{ id: string; project: string | null }[]>`
    SELECT po.id, e.name AS project
    FROM purchase_orders po
    LEFT JOIN engagements e ON e.id = po.engagement_id
  `;
  const projectById = Object.fromEntries(links.map((l) => [l.id, l.project]));
  const history = await auditTips(
    "purchase",
    rows.map((r) => r.id),
  );
  return rows.map((r) => ({
    ...r,
    amount: money(r.amount),
    project: projectById[r.id] ?? "—",
    history: history[r.id] ?? "",
  }));
}

export async function createPurchase(actor: AuthUser, input: z.infer<typeof purchaseSchema>) {
  const data = purchaseSchema.parse(input);
  const project = await resolveProject(data.engagementId, data.clientId);
  let vendorId: string | null = null;
  if (data.vendorName) {
    const vendor = await prisma.vendor.create({ data: { name: data.vendorName } });
    vendorId = vendor.id;
  }
  const number = await nextNumber("PO", "purchaseOrder");
  const row = await prisma.purchaseOrder.create({
    data: {
      number,
      title: data.title,
      clientId: project.clientId,
      vendorId,
      ownerUserId: actor.id,
      status: data.status ?? "REQUESTED",
      amount: data.amount ?? 0,
      notes: data.notes || null,
    },
  });
  if (project.engagementId) {
    await prisma.$executeRaw`UPDATE purchase_orders SET engagement_id = ${project.engagementId} WHERE id = ${row.id}`;
  }
  await writeAudit({
    userId: actor.id,
    action: "purchase.created",
    entityType: "purchase",
    entityId: row.id,
    newValue: { title: data.title, amount: data.amount ?? 0 },
  });
  return row;
}

export async function updatePurchase(actor: AuthUser, id: string, input: z.infer<typeof purchaseSchema>) {
  const data = purchaseSchema.parse(input);
  const existing = await prisma.purchaseOrder.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Purchase not found", "NOT_FOUND");
  const ownPending = existing.ownerUserId === actor.id && existing.status === "REQUESTED";
  if (!ownPending && !canDeleteRecords(actor) && !canApproveSpend(actor)) {
    throw new HttpError(403, "Not allowed to edit this record", "FORBIDDEN");
  }
  const project = await resolveProject(data.engagementId, data.clientId);
  if (existing.status === "APPROVED") await applyProjectCost(await purchaseEngagementId(id), money(existing.amount), -1);
  const row = await prisma.purchaseOrder.update({
    where: { id },
    data: {
      title: data.title,
      clientId: project.clientId,
      amount: data.amount ?? 0,
      notes: data.notes || null,
    },
  });
  if (project.engagementId) {
    await prisma.$executeRaw`UPDATE purchase_orders SET engagement_id = ${project.engagementId} WHERE id = ${row.id}`;
  }
  if (existing.status === "APPROVED") await applyProjectCost(project.engagementId, data.amount ?? 0, 1);
  await writeAudit({
    userId: actor.id,
    action: "purchase.updated",
    entityType: "purchase",
    entityId: id,
    oldValue: { title: existing.title, amount: money(existing.amount) },
    newValue: { title: data.title, amount: data.amount ?? 0 },
  });
  return row;
}

export async function listExpenses(actor: AuthUser) {
  const mine = !["super_admin", "crm_manager", "accounts", "hr_admin"].includes(actor.roleKey);
  const rows = await prisma.expense.findMany({
    where: mine ? { claimantId: actor.id } : {},
    include: {
      claimant: { select: { name: true } },
      client: { select: { name: true } },
      engagement: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const history = await auditTips(
    "expense",
    rows.map((r) => r.id),
  );
  return rows.map((r) => ({
    ...r,
    amount: money(r.amount),
    spentOn: r.spentOn.toISOString(),
    project: r.engagement?.name ?? "—",
    history: history[r.id] ?? "",
  }));
}

export async function createExpense(actor: AuthUser, input: z.infer<typeof expenseSchema>) {
  const data = expenseSchema.parse(input);
  const project = await resolveProject(data.engagementId, data.clientId);
  const row = await prisma.expense.create({
    data: {
      claimantId: actor.id,
      category: data.category,
      amount: data.amount,
      spentOn: new Date(data.spentOn),
      clientId: project.clientId,
      engagementId: project.engagementId,
      notes: data.notes || null,
      receiptUrl: data.receiptUrl || null,
      status: "SUBMITTED",
    },
  });
  await writeAudit({
    userId: actor.id,
    action: "expense.created",
    entityType: "expense",
    entityId: row.id,
    newValue: { amount: data.amount, category: data.category, engagementId: project.engagementId },
  });
  return row;
}

export async function updateExpense(actor: AuthUser, id: string, input: z.infer<typeof expenseSchema>) {
  const data = expenseSchema.parse(input);
  const existing = await prisma.expense.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Expense not found", "NOT_FOUND");
  const ownPending = existing.claimantId === actor.id && existing.status === "SUBMITTED";
  if (!ownPending && !canDeleteRecords(actor) && !canApproveSpend(actor)) {
    throw new HttpError(403, "Not allowed to edit this record", "FORBIDDEN");
  }
  const project = await resolveProject(data.engagementId, data.clientId);
  const wasCosted = ["APPROVED", "REIMBURSED"].includes(existing.status);
  if (wasCosted) await applyProjectCost(existing.engagementId, money(existing.amount), -1);
  const row = await prisma.expense.update({
    where: { id },
    data: {
      category: data.category,
      amount: data.amount,
      spentOn: new Date(data.spentOn),
      clientId: project.clientId,
      notes: data.notes || null,
      receiptUrl: data.receiptUrl || existing.receiptUrl,
    },
  });
  if (wasCosted) await applyProjectCost(project.engagementId, data.amount, 1);
  await writeAudit({
    userId: actor.id,
    action: "expense.updated",
    entityType: "expense",
    entityId: id,
    oldValue: { amount: money(existing.amount), category: existing.category },
    newValue: { amount: data.amount, category: data.category, engagementId: project.engagementId },
  });
  return row;
}

export async function decideExpense(id: string, status: "APPROVED" | "REJECTED" | "REIMBURSED", actor: AuthUser) {
  if (!canApproveSpend(actor)) throw new HttpError(403, "Accounts or HR must approve spend", "FORBIDDEN");
  const existing = await prisma.expense.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Expense not found", "NOT_FOUND");
  const row = await prisma.expense.update({
    where: { id },
    data: { status, approverId: actor.id },
  });
  const wasCosted = ["APPROVED", "REIMBURSED"].includes(existing.status);
  const nowCosted = ["APPROVED", "REIMBURSED"].includes(status);
  if (!wasCosted && nowCosted) await applyProjectCost(existing.engagementId, money(existing.amount), 1);
  if (wasCosted && !nowCosted) await applyProjectCost(existing.engagementId, money(existing.amount), -1);
  return row;
}

export async function decidePurchase(id: string, status: "APPROVED" | "REJECTED", actor: AuthUser) {
  if (!canApproveSpend(actor)) throw new HttpError(403, "Accounts or HR must approve spend", "FORBIDDEN");
  const existing = await prisma.purchaseOrder.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Purchase not found", "NOT_FOUND");
  const row = await prisma.purchaseOrder.update({ where: { id }, data: { status } });
  const projectId = await purchaseEngagementId(id);
  if (existing.status !== "APPROVED" && status === "APPROVED") {
    await applyProjectCost(projectId, money(existing.amount), 1);
  }
  if (existing.status === "APPROVED" && status === "REJECTED") {
    await applyProjectCost(projectId, money(existing.amount), -1);
  }
  await writeAudit({ userId: actor.id, action: `purchase.${status.toLowerCase()}`, entityType: "purchase", entityId: id });
  return row;
}

export async function decideLicense(id: string, status: "APPROVED" | "REJECTED", actor: AuthUser) {
  if (!canApproveSpend(actor)) throw new HttpError(403, "Accounts or HR must approve spend", "FORBIDDEN");
  const existing = await prisma.toolLicense.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "License not found", "NOT_FOUND");
  await prisma.$executeRaw`UPDATE tool_licenses SET status = ${status} WHERE id = ${id}`;
  if (existing.status !== "APPROVED" && status === "APPROVED") {
    await applyProjectCost(existing.engagementId, money(existing.amount), 1);
  }
  if (existing.status === "APPROVED" && status === "REJECTED") {
    await applyProjectCost(existing.engagementId, money(existing.amount), -1);
  }
  await writeAudit({ userId: actor.id, action: `license.${status.toLowerCase()}`, entityType: "tool_license", entityId: id });
  return prisma.toolLicense.findUnique({ where: { id } });
}

export async function decidePerson(id: string, status: "APPROVED" | "REJECTED", actor: AuthUser) {
  if (!(await canApprove(actor, "people"))) throw new HttpError(403, "You are not set as a people approver", "FORBIDDEN");
  await prisma.$executeRaw`UPDATE "user" SET approval_status = ${status}, is_active = ${status === "APPROVED"} WHERE id = ${id}`;
  await writeAudit({ userId: actor.id, action: `user.${status.toLowerCase()}`, entityType: "user", entityId: id });
  return prisma.user.findUnique({ where: { id }, include: { role: true } });
}

function assertCanDelete(actor: AuthUser, ownPending: boolean) {
  if (ownPending || canDeleteRecords(actor) || canApproveSpend(actor)) return;
  throw new HttpError(403, "Not allowed to delete this record", "FORBIDDEN");
}

export async function deleteExpense(actor: AuthUser, id: string) {
  const row = await prisma.expense.findUnique({ where: { id } });
  if (!row) throw new HttpError(404, "Expense not found", "NOT_FOUND");
  assertCanDelete(actor, row.claimantId === actor.id && row.status === "SUBMITTED");
  if (["APPROVED", "REIMBURSED"].includes(row.status)) {
    await applyProjectCost(row.engagementId, money(row.amount), -1);
  }
  await putInTrash({
    entityType: "expense",
    entityId: id,
    title: `${row.category} · ₹${money(row.amount)}`,
    summary: row.notes ?? undefined,
    payload: row,
    deletedBy: actor.id,
  });
  await prisma.expense.delete({ where: { id } });
  await writeAudit({ userId: actor.id, action: "expense.deleted", entityType: "expense", entityId: id });
  return { id };
}

export async function deletePurchase(actor: AuthUser, id: string) {
  const row = await prisma.purchaseOrder.findUnique({ where: { id } });
  if (!row) throw new HttpError(404, "Purchase not found", "NOT_FOUND");
  assertCanDelete(actor, row.ownerUserId === actor.id && row.status === "REQUESTED");
  if (row.status === "APPROVED") await applyProjectCost(await purchaseEngagementId(id), money(row.amount), -1);
  await putInTrash({
    entityType: "purchase",
    entityId: id,
    title: `${row.number} · ${row.title}`,
    summary: row.notes ?? undefined,
    payload: { ...row, engagementId: await purchaseEngagementId(id) },
    deletedBy: actor.id,
  });
  await prisma.purchaseOrder.delete({ where: { id } });
  await writeAudit({ userId: actor.id, action: "purchase.deleted", entityType: "purchase", entityId: id });
  return { id };
}

export async function deleteLicense(actor: AuthUser, id: string) {
  const row = await prisma.toolLicense.findUnique({ where: { id } });
  if (!row) throw new HttpError(404, "License not found", "NOT_FOUND");
  assertCanDelete(actor, row.ownerUserId === actor.id && row.status === "PENDING");
  if (row.status === "APPROVED") await applyProjectCost(row.engagementId, money(row.amount), -1);
  await putInTrash({
    entityType: "license",
    entityId: id,
    title: row.name,
    summary: row.vendor ?? undefined,
    payload: row,
    deletedBy: actor.id,
  });
  await prisma.toolLicense.delete({ where: { id } });
  await writeAudit({ userId: actor.id, action: "license.deleted", entityType: "tool_license", entityId: id });
  return { id };
}

export async function deleteInvoice(actor: AuthUser, id: string) {
  if (!canDeleteRecords(actor)) throw new HttpError(403, "Not allowed to delete this record", "FORBIDDEN");
  const row = await prisma.invoice.findUnique({ where: { id }, include: { lines: true } });
  if (!row) throw new HttpError(404, "Invoice not found", "NOT_FOUND");
  await putInTrash({
    entityType: "invoice",
    entityId: id,
    title: `${row.number} · ${row.kind}`,
    summary: row.notes?.slice(0, 160) ?? undefined,
    payload: row,
    deletedBy: actor.id,
  });
  await prisma.invoice.delete({ where: { id } });
  await writeAudit({ userId: actor.id, action: "invoice.deleted", entityType: "invoice", entityId: id });
  return { id };
}

export async function deletePerson(actor: AuthUser, id: string) {
  if (!(await canApprove(actor, "people")) && !canDeleteRecords(actor)) {
    throw new HttpError(403, "Not allowed to delete this record", "FORBIDDEN");
  }
  if (id === actor.id) throw new HttpError(400, "You cannot delete your own account", "FORBIDDEN");
  const target = await prisma.user.findUnique({ where: { id }, include: { role: true } });
  if (!target) throw new HttpError(404, "Person not found", "NOT_FOUND");
  if (target.role.key === "super_admin" && actor.roleKey !== "super_admin") {
    throw new HttpError(403, "Cannot remove a super admin", "FORBIDDEN");
  }
  await putInTrash({
    entityType: "person",
    entityId: id,
    title: target.name,
    summary: target.email,
    payload: { ...target, role: undefined },
    deletedBy: actor.id,
  });
  await prisma.user.update({ where: { id }, data: { isActive: false } });
  await prisma.$executeRaw`UPDATE "user" SET approval_status = 'REJECTED' WHERE id = ${id}`.catch(() => undefined);
  await prisma.session.deleteMany({ where: { userId: id } }).catch(() => undefined);
  await writeAudit({ userId: actor.id, action: "user.deleted", entityType: "user", entityId: id });
  return { id };
}

export async function restoreTrashItem(actor: AuthUser, id: string) {
  if (!canDeleteRecords(actor) && !(await canApprove(actor, "people"))) {
    throw new HttpError(403, "Not allowed to restore records", "FORBIDDEN");
  }
  const item = await getTrashItem(id);
  if (!item || item.restoredAt) throw new HttpError(404, "This trash item is gone", "NOT_FOUND");
  if (item.purgeAt.getTime() < Date.now()) throw new HttpError(410, "This record expired after 30 days", "EXPIRED");
  const data = item.payload;
  if (item.entityType === "expense") await restoreExpense(data);
  else if (item.entityType === "purchase") await restorePurchase(data);
  else if (item.entityType === "license") await restoreLicense(data);
  else if (item.entityType === "invoice") await restoreInvoice(data);
  else if (item.entityType === "person") await restorePerson(data, item.entityId);
  else throw new HttpError(400, "Unknown trash type", "UNKNOWN");
  await markTrashRestored(id);
  await writeAudit({
    userId: actor.id,
    action: `${item.entityType}.restored`,
    entityType: item.entityType,
    entityId: item.entityId,
  });
  return { id: item.entityId, type: item.entityType };
}

async function restoreExpense(data: TrashPayload) {
  const id = String(data.id);
  const existing = await prisma.expense.findUnique({ where: { id } });
  if (existing) return;
  const engagementId = asText(data.engagementId);
  const amount = asMoney(data.amount);
  const status = String(data.status ?? "SUBMITTED");
  await prisma.expense.create({
    data: {
      id,
      claimantId: String(data.claimantId),
      approverId: asText(data.approverId),
      clientId: asText(data.clientId),
      engagementId,
      vendorId: asText(data.vendorId),
      category: String(data.category),
      amount,
      spentOn: asDate(data.spentOn) ?? new Date(),
      status,
      notes: asText(data.notes),
      receiptUrl: asText(data.receiptUrl),
      createdAt: asDate(data.createdAt) ?? undefined,
    },
  });
  if (["APPROVED", "REIMBURSED"].includes(status)) await applyProjectCost(engagementId, amount, 1);
}

async function restorePurchase(data: TrashPayload) {
  const id = String(data.id);
  const existing = await prisma.purchaseOrder.findUnique({ where: { id } });
  if (existing) return;
  const engagementId = asText(data.engagementId);
  const amount = asMoney(data.amount);
  const status = String(data.status ?? "REQUESTED");
  await prisma.purchaseOrder.create({
    data: {
      id,
      number: String(data.number),
      clientId: asText(data.clientId),
      vendorId: asText(data.vendorId),
      ownerUserId: asText(data.ownerUserId),
      title: String(data.title),
      status,
      amount,
      orderedAt: asDate(data.orderedAt),
      deliveredAt: asDate(data.deliveredAt),
      notes: asText(data.notes),
      createdAt: asDate(data.createdAt) ?? undefined,
    },
  });
  if (engagementId) {
    await prisma.$executeRaw`UPDATE purchase_orders SET engagement_id = ${engagementId} WHERE id = ${id}`;
  }
  if (status === "APPROVED") await applyProjectCost(engagementId, amount, 1);
}

async function restoreLicense(data: TrashPayload) {
  const id = String(data.id);
  const existing = await prisma.toolLicense.findUnique({ where: { id } });
  if (existing) return;
  const engagementId = asText(data.engagementId);
  const amount = asMoney(data.amount);
  const status = String(data.status ?? "APPROVED");
  await prisma.toolLicense.create({
    data: {
      id,
      name: String(data.name),
      vendor: asText(data.vendor),
      category: asText(data.category),
      licenseType: asText(data.licenseType),
      licenseKey: asText(data.licenseKey),
      seats: Number(data.seats ?? 1) || 1,
      clientId: asText(data.clientId),
      engagementId,
      ownerUserId: asText(data.ownerUserId),
      purchaseDate: asDate(data.purchaseDate),
      startDate: asDate(data.startDate),
      expiryDate: asDate(data.expiryDate),
      amount,
      billingCycle: String(data.billingCycle ?? "YEARLY"),
      autoRenew: Boolean(data.autoRenew),
      accountRef: asText(data.accountRef),
      notes: asText(data.notes),
      createdAt: asDate(data.createdAt) ?? undefined,
    },
  });
  await prisma.$executeRaw`UPDATE tool_licenses SET status = ${status} WHERE id = ${id}`;
  if (status === "APPROVED") await applyProjectCost(engagementId, amount, 1);
}

async function restoreInvoice(data: TrashPayload) {
  const id = String(data.id);
  const existing = await prisma.invoice.findUnique({ where: { id } });
  if (existing) return;
  const lines = Array.isArray(data.lines) ? data.lines : [];
  await prisma.invoice.create({
    data: {
      id,
      number: String(data.number),
      clientId: String(data.clientId),
      leadId: asText(data.leadId),
      engagementId: asText(data.engagementId),
      ownerUserId: asText(data.ownerUserId),
      kind: String(data.kind ?? "INVOICE"),
      status: String(data.status ?? "DRAFT"),
      issueDate: asDate(data.issueDate) ?? undefined,
      dueDate: asDate(data.dueDate),
      subtotal: asMoney(data.subtotal),
      gstPct: asMoney(data.gstPct) || 18,
      total: asMoney(data.total),
      paid: asMoney(data.paid),
      notes: asText(data.notes),
      createdAt: asDate(data.createdAt) ?? undefined,
      lines: {
        create: lines.map((line) => {
          const item = (line ?? {}) as TrashPayload;
          return {
            id: item.id ? String(item.id) : undefined,
            description: String(item.description ?? "Line"),
            qty: asMoney(item.qty) || 1,
            rate: asMoney(item.rate),
            amount: asMoney(item.amount),
          };
        }),
      },
    },
  });
  const paymentTerms = asText(data.paymentTerms);
  if (paymentTerms) {
    await prisma.$executeRaw`UPDATE invoices SET payment_terms = ${paymentTerms} WHERE id = ${id}`;
  }
  const costingJson = asText(data.costingJson);
  await prisma.$executeRaw`
    UPDATE invoices
    SET planned_ad = ${asMoney(data.plannedAd)},
        planned_vendor = ${asMoney(data.plannedVendor)},
        planned_tools = ${asMoney(data.plannedTools)},
        planned_people = ${asMoney(data.plannedPeople)},
        discount_pct = ${asMoney(data.discountPct)},
        discount_amt = ${asMoney(data.discountAmt)},
        costing_json = ${costingJson}
    WHERE id = ${id}
  `;
}

async function restorePerson(data: TrashPayload, id: string) {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "This person no longer exists and cannot be restored", "NOT_FOUND");
  const approval = String(data.approvalStatus ?? "APPROVED");
  const status = approval === "REJECTED" ? "APPROVED" : approval;
  await prisma.$executeRaw`UPDATE "user" SET is_active = true, approval_status = ${status} WHERE id = ${id}`;
}

async function approvalByUserId() {
  try {
    const rows = await prisma.$queryRaw<Array<{ id: string; approval_status: string | null }>>`
      SELECT id, approval_status FROM "user"
    `;
    return Object.fromEntries(rows.map((row) => [row.id, row.approval_status || "APPROVED"]));
  } catch {
    return {} as Record<string, string>;
  }
}

export async function listPeople() {
  await ensureOpsTables();
  const users = await prisma.user.findMany({
    include: { role: true, department: true, employee: true, client: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
  const approvals = await approvalByUserId();
  const visible = users.filter((u) => {
    const status = approvals[u.id] ?? (u.isActive ? "APPROVED" : "PENDING");
    if (status === "REJECTED" && !u.isActive) return false;
    return u.isActive || status === "PENDING";
  });
  const history = await auditTips(
    "user",
    visible.map((u) => u.id),
  );
  const resumes = await prisma
    .$queryRaw<Array<{ user_id: string; resume_url: string | null }>>`
      SELECT user_id, resume_url FROM employee_profiles
    `
    .catch(() => [] as Array<{ user_id: string; resume_url: string | null }>);
  const extras = Object.fromEntries(resumes.map((row) => [row.user_id, row.resume_url]));
  return visible.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    mobile: u.mobile,
    alertEmail: u.alertEmail,
    alertPhone: u.alertPhone,
    notifyEmail: u.notifyEmail,
    notifySms: u.notifySms,
    isActive: u.isActive,
    approvalStatus: approvals[u.id] ?? (u.isActive ? "APPROVED" : "PENDING"),
    lastLoginAt: u.lastLoginAt,
    role: { id: u.role.id, name: u.role.name, key: u.role.key },
    department: u.department?.name ?? null,
    designation: u.employee?.designation ?? null,
    employeeNo: u.employee?.employeeNo ?? null,
    joiningDate: u.employee?.joiningDate?.toISOString() ?? null,
    targetAmount: money(u.employee?.targetAmount),
    photoUrl: u.image,
    resumeUrl: extras[u.id] ?? null,
    history: history[u.id] ?? "",
  }));
}

export async function upsertPeopleProfile(userId: string, input: z.infer<typeof peopleSchema>) {
  await ensureOpsTables();
  const data = peopleSchema.parse({ ...input, userId });
  let departmentId: string | undefined;
  if (data.departmentName) {
    const key = data.departmentName.toLowerCase().replace(/\s+/g, "_");
    const dept = await prisma.department.upsert({
      where: { key },
      update: { name: data.departmentName },
      create: { key, name: data.departmentName },
    });
    departmentId = dept.id;
  }
  await prisma.user.update({
    where: { id: userId },
    data: {
      departmentId,
      alertEmail: data.alertEmail === undefined ? undefined : data.alertEmail || null,
      alertPhone: data.alertPhone === undefined ? undefined : data.alertPhone || null,
      ...(data.name ? { name: data.name } : {}),
      ...(data.mobile !== undefined ? { mobile: data.mobile || null } : {}),
      ...(data.roleId ? { roleId: data.roleId } : {}),
      ...(data.photoUrl !== undefined ? { image: data.photoUrl || null } : {}),
    },
  });
  const profile = await prisma.employeeProfile.upsert({
    where: { userId },
    update: {
      designation: data.designation,
      employeeNo: data.employeeNo,
      targetAmount: data.targetAmount,
    },
    create: {
      userId,
      designation: data.designation,
      employeeNo: data.employeeNo,
      targetAmount: data.targetAmount,
    },
  });
  if (data.resumeUrl !== undefined) {
    await prisma.$executeRaw`UPDATE employee_profiles SET resume_url = ${data.resumeUrl || null} WHERE user_id = ${userId}`.catch(
      () => undefined,
    );
  }
  return profile;
}

export async function createEmployee(actor: AuthUser, input: z.infer<typeof peopleSchema>) {
  const data = peopleSchema.parse(input);
  const name = data.name?.trim() ?? "";
  const email = data.email?.trim() ?? "";
  const password = data.password ?? "";
  if (name.length < 2) throw new HttpError(400, "Enter the employee name", "VALIDATION");
  if (!email) throw new HttpError(400, "Enter a work email", "VALIDATION");
  if (password.length < 8) throw new HttpError(400, "Password must be at least 8 characters", "VALIDATION");

  let roleId = data.roleId || "";
  if (!roleId) {
    const role = await prisma.role.findFirst({ where: { key: "employee" } });
    if (!role) throw new HttpError(400, "Employee role is missing", "INVALID_ROLE");
    roleId = role.id;
  }

  const auto = await canApprove(actor, "people");
  const user = await createUser(actor.id, {
    name,
    email,
    password,
    roleId,
    mobile: data.mobile,
    alertEmail: data.alertEmail,
    alertPhone: data.alertPhone,
    isActive: auto,
    approvalStatus: auto ? "APPROVED" : "PENDING",
  });

  await upsertPeopleProfile(user.id, {
    userId: user.id,
    designation: data.designation,
    employeeNo: data.employeeNo,
    departmentName: data.departmentName,
    targetAmount: data.targetAmount,
    alertEmail: data.alertEmail,
    alertPhone: data.alertPhone,
    photoUrl: data.photoUrl,
    resumeUrl: data.resumeUrl,
  });

  return user;
}

export async function updateEmployee(actor: AuthUser, input: z.infer<typeof peopleSchema>) {
  const data = peopleSchema.parse(input);
  if (!data.userId) throw new HttpError(400, "Person is required", "VALIDATION");
  if (!(await canApprove(actor, "people")) && !canDeleteRecords(actor) && actor.id !== data.userId) {
    throw new HttpError(403, "Not allowed to update this person", "FORBIDDEN");
  }
  if (data.password) {
    const passwordHash = await hashPassword(data.password);
    const account = await prisma.account.findFirst({
      where: { userId: data.userId, providerId: "credential" },
    });
    if (account) {
      await prisma.account.update({
        where: { id: account.id },
        data: { password: passwordHash, updatedAt: new Date() },
      });
    } else {
      await prisma.account.create({
        data: {
          id: crypto.randomUUID(),
          userId: data.userId,
          accountId: data.userId,
          providerId: "credential",
          issuer: "local:credential",
          password: passwordHash,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    }
  }
  return upsertPeopleProfile(data.userId, data);
}

export async function listPartners() {
  return prisma.channelPartner.findMany({
    include: { client: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
}

export async function createPartner(actor: AuthUser, input: z.infer<typeof partnerSchema>) {
  const data = partnerSchema.parse(input);
  return prisma.channelPartner.create({
    data: {
      name: data.name,
      clientId: data.clientId || null,
      ownerUserId: actor.id,
      mobile: data.mobile || null,
      email: data.email || null,
      commissionPct: data.commissionPct ?? 0,
    },
  });
}

export async function listCourses() {
  const rows = await prisma.course.findMany({
    include: { client: { select: { name: true } }, institution: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
  return rows.map((r) => ({ ...r, fee: money(r.fee) }));
}

export async function createCourse(input: z.infer<typeof courseSchema>) {
  const data = courseSchema.parse(input);
  let institutionId: string | undefined;
  if (data.institutionName) {
    const inst = await prisma.institution.create({
      data: { clientId: data.clientId, name: data.institutionName },
    });
    institutionId = inst.id;
  }
  return prisma.course.create({
    data: { clientId: data.clientId, name: data.name, fee: data.fee ?? 0, institutionId },
  });
}

export async function upsertServiceDetails(leadId: string, input: z.infer<typeof serviceDetailsSchema>) {
  const data = serviceDetailsSchema.parse(input);
  return prisma.serviceDetails.upsert({
    where: { leadId },
    update: {
      serviceLine: data.serviceLine || null,
      requirement: data.requirement || null,
      proposalValue: data.proposalValue === "" ? null : data.proposalValue,
      milestone: data.milestone || null,
    },
    create: {
      leadId,
      serviceLine: data.serviceLine || null,
      requirement: data.requirement || null,
      proposalValue: data.proposalValue === "" ? null : data.proposalValue,
      milestone: data.milestone || null,
    },
  });
}

export async function createServiceLead(actor: AuthUser, input: z.infer<typeof serviceLeadSchema>) {
  const data = serviceLeadSchema.parse(input);
  const campaign = await prisma.campaign.findFirst({
    where: { clientId: data.clientId, isActive: true },
    orderBy: { createdAt: "desc" },
  });
  if (!campaign) {
    throw new HttpError(400, "This client needs a campaign before leads can be added", "NO_CAMPAIGN");
  }
  const { createLead } = await import("@/modules/leads/service");
  return createLead(actor, {
    fullName: data.name,
    mobile: data.mobile,
    clientId: data.clientId,
    campaignId: campaign.id,
    serviceLine: data.serviceLine || undefined,
    captureChannel: data.captureChannel || "manual",
    priority: data.priority,
    assignedUserId: actor.id,
  });
}

export async function listLeaves(actor: AuthUser) {
  const mine = !["super_admin", "hr_admin", "crm_manager"].includes(actor.roleKey);
  const rows = await prisma.leaveRequest.findMany({
    where: mine ? { userId: actor.id } : {},
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return rows.map((r) => ({
    ...r,
    fromDate: r.fromDate.toISOString(),
    toDate: r.toDate.toISOString(),
  }));
}

export async function createLeave(actor: AuthUser, input: z.infer<typeof leaveSchema>) {
  const data = leaveSchema.parse(input);
  return prisma.leaveRequest.create({
    data: {
      userId: actor.id,
      type: data.type || "CASUAL",
      fromDate: new Date(data.fromDate),
      toDate: new Date(data.toDate),
      notes: data.notes || null,
    },
  });
}

export async function decideLeave(id: string, status: "APPROVED" | "REJECTED") {
  return prisma.leaveRequest.update({ where: { id }, data: { status } });
}

export async function markAttendance(actor: AuthUser, input: z.infer<typeof attendanceSchema>) {
  const data = attendanceSchema.parse(input);
  const userId = data.userId || actor.id;
  const day = new Date(data.day);
  return prisma.attendanceDay.upsert({
    where: { userId_day: { userId, day } },
    update: { status: data.status ?? "PRESENT" },
    create: { userId, day, status: data.status ?? "PRESENT" },
  });
}

export async function platformKpis() {
  const now = new Date();
  const monthStart = new Date(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01T00:00:00+05:30`);
  const deliverable = (prisma as { deliverable?: { count: (args: object) => Promise<number> } }).deliverable;
  const [
    openTasks,
    overdueTasks,
    invoices,
    pendingExpenses,
    pos,
    licenses,
    activeProjects,
    dueProjects,
    overdueDeliverables,
    pendingDeliverables,
    activeCustomers,
    monthlyExpenseAgg,
    monthlyInvoiceAgg,
  ] = await Promise.all([
    prisma.task.count({ where: { status: { notIn: ["DONE", "CANCELLED"] } } }),
    prisma.task.count({
      where: { status: { notIn: ["DONE", "CANCELLED"] }, dueAt: { lt: now } },
    }),
    prisma.invoice.findMany({ where: { status: { in: ["SENT", "PARTIAL", "OVERDUE"] } }, select: { total: true, paid: true } }),
    prisma.expense.count({ where: { status: "SUBMITTED" } }),
    prisma.purchaseOrder.count({ where: { status: { in: ["REQUESTED", "APPROVED", "ORDERED"] } } }),
    licenseKpis(),
    prisma.engagement.count({ where: { status: { notIn: ["COMPLETED", "CLOSED"] } } }),
    prisma.engagement.count({
      where: { status: { notIn: ["COMPLETED", "CLOSED"] }, dueDate: { lte: new Date(now.getTime() + 7 * 86400000) } },
    }),
    deliverable
      ? deliverable.count({
          where: { status: { notIn: ["COMPLETED", "APPROVED"] }, dueDate: { lt: now } },
        })
      : Promise.resolve(0),
    deliverable
      ? deliverable.count({
          where: { status: { in: ["PENDING", "INTERNAL_REVIEW", "SENT_TO_CLIENT", "REVISION"] } },
        })
      : Promise.resolve(0),
    prisma.client.count({ where: { isActive: true } }),
    prisma.expense.aggregate({ where: { spentOn: { gte: monthStart } }, _sum: { amount: true } }),
    prisma.invoice.aggregate({ where: { issueDate: { gte: monthStart }, status: { not: "VOID" } }, _sum: { total: true, paid: true } }),
  ]);
  const outstanding = invoices.reduce((s, i) => s + money(i.total) - money(i.paid), 0);
  return {
    openTasks,
    overdueTasks,
    outstanding: Math.round(outstanding),
    pendingExpenses,
    openPurchases: pos,
    licensesExpiring: licenses.expiring,
    licensesExpired: licenses.expired,
    activeProjects,
    dueProjects,
    overdueDeliverables,
    pendingDeliverables,
    activeCustomers,
    monthlyExpenses: Math.round(money(monthlyExpenseAgg._sum.amount)),
    monthlyRevenue: Math.round(money(monthlyInvoiceAgg._sum.paid)),
    monthlyInvoiced: Math.round(money(monthlyInvoiceAgg._sum.total)),
    overdueCollections: invoices.filter((i) => money(i.total) - money(i.paid) > 1).length,
  };
}

export async function listServiceBoard(actor: AuthUser) {
  const { leadScopeWhere } = await import("@/lib/scope");
  const scope = await leadScopeWhere(actor);
  const leads = await prisma.lead.findMany({
    where: { AND: [scope, { industry: { key: "services" }, deletedAt: null }] },
    include: {
      client: { select: { name: true } },
      status: true,
      assignedUser: { select: { name: true } },
      serviceDetails: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  return leads.map((l) => ({
    id: l.id,
    name: l.fullName,
    client: l.client.name,
    status: l.status.name,
    statusKey: l.status.key,
    owner: l.assignedUser?.name ?? "Unassigned",
    serviceLine: l.serviceLine ?? l.serviceDetails?.serviceLine ?? null,
    requirement: l.serviceDetails?.requirement ?? null,
    proposalValue: money(l.serviceDetails?.proposalValue),
  }));
}

export async function platformSearch(q: string) {
  const query = q.trim();
  if (query.length < 2) {
    return { leads: [], clients: [], invoices: [], licenses: [], people: [], engagements: [], tasks: [], purchases: [], expenses: [] };
  }
  const [leads, clients, invoices, licenses, people, engagements, tasks, purchases, expenses] = await Promise.all([
    prisma.lead.findMany({
      where: {
        deletedAt: null,
        OR: [
          { fullName: { contains: query, mode: "insensitive" } },
          { mobileE164: { contains: query.replace(/\s/g, "") } },
          { leadNumber: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
        ],
      },
      take: 8,
      select: { id: true, fullName: true, leadNumber: true },
    }),
    prisma.client.findMany({
      where: { name: { contains: query, mode: "insensitive" } },
      take: 5,
      select: { id: true, name: true },
    }),
    prisma.invoice.findMany({
      where: { OR: [{ number: { contains: query, mode: "insensitive" } }, { notes: { contains: query, mode: "insensitive" } }] },
      take: 5,
      select: { id: true, number: true, total: true },
    }),
    prisma.toolLicense.findMany({
      where: { OR: [{ name: { contains: query, mode: "insensitive" } }, { vendor: { contains: query, mode: "insensitive" } }] },
      take: 5,
      select: { id: true, name: true, expiryDate: true },
    }),
    prisma.user.findMany({
      where: { OR: [{ name: { contains: query, mode: "insensitive" } }, { email: { contains: query, mode: "insensitive" } }] },
      take: 5,
      select: { id: true, name: true, email: true },
    }),
    prisma.engagement.findMany({
      where: { name: { contains: query, mode: "insensitive" } },
      take: 5,
      select: { id: true, name: true, status: true },
    }),
    prisma.task.findMany({
      where: { title: { contains: query, mode: "insensitive" } },
      take: 5,
      select: { id: true, title: true, status: true },
    }),
    prisma.purchaseOrder.findMany({
      where: {
        OR: [{ number: { contains: query, mode: "insensitive" } }, { title: { contains: query, mode: "insensitive" } }],
      },
      take: 5,
      select: { id: true, number: true, title: true },
    }),
    prisma.expense.findMany({
      where: { notes: { contains: query, mode: "insensitive" } },
      take: 5,
      select: { id: true, category: true, notes: true },
    }),
  ]);
  return {
    leads,
    clients,
    invoices: invoices.map((i) => ({ ...i, total: money(i.total) })),
    licenses: licenses.map((l) => ({ ...l, expiryDate: l.expiryDate?.toISOString() ?? null })),
    people,
    engagements,
    tasks,
    purchases,
    expenses,
  };
}

async function notifyOnce(input: {
  userId: string;
  type: string;
  title: string;
  body?: string;
  leadId?: string | null;
  entityType?: string;
  entityId?: string;
}) {
  const existing = await prisma.notification.findFirst({
    where: {
      userId: input.userId,
      type: input.type,
      entityId: input.entityId ?? undefined,
      createdAt: { gte: new Date(Date.now() - 20 * 60 * 60 * 1000) },
    },
  });
  if (existing) return existing;
  const channels = await alertChannelsForUser(input.userId);
  return prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      leadId: input.leadId ?? null,
      entityType: input.entityType,
      entityId: input.entityId,
      ...channels,
    },
  });
}

export async function runPlatformTick() {
  const now = new Date();
  const windows = [30, 15, 7, 1];
  const licenses = await prisma.toolLicense.findMany({
    where: { expiryDate: { not: null }, ownerUserId: { not: null } },
  });
  for (const license of licenses) {
    if (!license.expiryDate || !license.ownerUserId) continue;
    const days = Math.ceil((license.expiryDate.getTime() - now.getTime()) / 86400000);
    if (!windows.includes(days)) continue;
    await notifyOnce({
      userId: license.ownerUserId,
      type: `license_renewal_${days}`,
      title: `License renews in ${days} day${days === 1 ? "" : "s"}`,
      body: license.name,
      entityType: "tool_license",
      entityId: license.id,
    });
  }

  const overdueTasks = await prisma.task.findMany({
    where: { completedAt: null, status: { notIn: ["DONE", "CANCELLED"] }, dueAt: { lt: now }, assignedTo: { not: null } },
    take: 40,
  });
  for (const task of overdueTasks) {
    if (!task.assignedTo) continue;
    await notifyOnce({
      userId: task.assignedTo,
      type: "task_overdue",
      title: "Task overdue",
      body: task.title,
      entityType: "task",
      entityId: task.id,
      leadId: task.leadId,
    });
  }

  const invoices = await prisma.invoice.findMany({
    where: { status: { in: ["SENT", "PARTIAL", "OVERDUE"] }, dueDate: { lt: now } },
    take: 40,
  });
  for (const invoice of invoices) {
    if (invoice.status !== "OVERDUE") {
      await prisma.invoice.update({ where: { id: invoice.id }, data: { status: "OVERDUE" } });
    }
    if (invoice.ownerUserId) {
      await notifyOnce({
        userId: invoice.ownerUserId,
        type: "invoice_overdue",
        title: "Invoice overdue",
        body: invoice.number,
        entityType: "invoice",
        entityId: invoice.id,
      });
    }
  }

  const overdueDeliverables = await prisma.deliverable.findMany({
    where: { status: { notIn: ["COMPLETED", "APPROVED"] }, dueDate: { lt: now }, assignedTo: { not: null } },
    take: 40,
  });
  for (const row of overdueDeliverables) {
    if (!row.assignedTo) continue;
    await notifyOnce({
      userId: row.assignedTo,
      type: "deliverable_overdue",
      title: "Deliverable overdue",
      body: row.title,
      entityType: "deliverable",
      entityId: row.id,
    });
  }
}

export const deliverableSchema = z.object({
  engagementId: requiredId("a project"),
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  dueDate: z.string().optional().or(z.literal("")),
  priority: z.enum(PRIORITIES).optional(),
  status: z.enum(DELIVERABLE_STATUSES).optional(),
});

export const vendorSchema = z.object({
  name: z.string().trim().min(2).max(160),
  email: z.string().trim().email().optional().or(z.literal("")),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  gstin: z.string().trim().max(20).optional().or(z.literal("")),
  contactName: z.string().trim().max(120).optional().or(z.literal("")),
  category: z.string().trim().max(80).optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export async function listDeliverables() {
  const now = new Date();
  const rows = await prisma.deliverable.findMany({
    include: {
      engagement: { select: { name: true, client: { select: { name: true } } } },
      assignee: { select: { name: true } },
    },
    orderBy: { dueDate: "asc" },
    take: 300,
  });
  return rows.map((r) => ({
    ...r,
    dueDate: r.dueDate?.toISOString() ?? null,
    overdue: Boolean(r.dueDate && r.dueDate < now && !["COMPLETED", "APPROVED"].includes(r.status)),
    project: r.engagement.name,
    client: r.engagement.client.name,
    owner: r.assignee?.name ?? "Unassigned",
  }));
}

export async function createDeliverable(actor: AuthUser, input: z.infer<typeof deliverableSchema>) {
  const data = deliverableSchema.parse(input);
  return prisma.deliverable.create({
    data: {
      engagementId: data.engagementId,
      title: data.title,
      description: data.description || null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      priority: data.priority ?? "MEDIUM",
      status: data.status ?? "PENDING",
      assignedTo: actor.id,
    },
  });
}

export async function listVendors() {
  return prisma.vendor.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { purchases: true } } } });
}

export async function createVendor(input: z.infer<typeof vendorSchema>) {
  const data = vendorSchema.parse(input);
  return prisma.vendor.create({
    data: {
      name: data.name,
      email: data.email || null,
      phone: data.phone || null,
      gstin: data.gstin || null,
      contactName: data.contactName || null,
      category: data.category || null,
      notes: data.notes || null,
    },
  });
}

export type DocumentFilter = {
  clientId?: string;
  engagementId?: string;
  invoiceId?: string;
  clientOrderId?: string;
  userId?: string;
};

type DocumentSqlRow = {
  id: string;
  title: string;
  kind: string;
  url: string;
  client: string | null;
  project: string | null;
  invoice: string | null;
  po: string | null;
  person: string | null;
  client_id: string | null;
  engagement_id: string | null;
  invoice_id: string | null;
  client_order_id: string | null;
  user_id: string | null;
  follow_up_at: Date | null;
  created_at: Date;
};

function mapDocumentRow(r: DocumentSqlRow) {
  return {
    id: r.id,
    filename: r.title,
    kind: r.kind,
    url: r.url,
    client: r.client ?? "—",
    project: r.project ?? "—",
    invoice: r.invoice ?? "—",
    po: r.po ?? "—",
    person: r.person ?? "—",
    clientId: r.client_id,
    engagementId: r.engagement_id,
    invoiceId: r.invoice_id,
    clientOrderId: r.client_order_id,
    userId: r.user_id,
    followUp: r.follow_up_at ? new Date(r.follow_up_at).toISOString().slice(0, 10) : "—",
    createdAt: r.created_at.toISOString().slice(0, 10),
  };
}

async function resolveDocumentTags(input: z.infer<typeof documentSchema>) {
  let clientId = emptyId(input.clientId);
  let engagementId = emptyId(input.engagementId);
  let invoiceId = emptyId(input.invoiceId);
  let clientOrderId = emptyId(input.clientOrderId);
  const userId = emptyId(input.userId);
  if (invoiceId) {
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (invoice) {
      clientId = clientId || invoice.clientId;
      engagementId = engagementId || invoice.engagementId;
    }
  }
  if (clientOrderId) {
    const orders = await prisma
      .$queryRaw<Array<{ client_id: string; engagement_id: string | null }>>`
        SELECT client_id, engagement_id FROM client_orders WHERE id = ${clientOrderId}
      `
      .catch(() => [] as Array<{ client_id: string; engagement_id: string | null }>);
    const order = orders[0];
    if (order) {
      clientId = clientId || order.client_id;
      engagementId = engagementId || order.engagement_id;
    }
  }
  if (engagementId && !clientId) {
    const project = await prisma.engagement.findUnique({ where: { id: engagementId } });
    clientId = project?.clientId ?? null;
  }
  return { clientId, engagementId, invoiceId, clientOrderId, userId };
}

export async function listDocuments(filter?: string | DocumentFilter) {
  await ensureOpsTables();
  const scope: DocumentFilter = typeof filter === "string" ? { clientId: filter } : filter ?? {};
  try {
    const clientId = emptyId(scope.clientId);
    const engagementId = emptyId(scope.engagementId);
    const invoiceId = emptyId(scope.invoiceId);
    const clientOrderId = emptyId(scope.clientOrderId);
    const userId = emptyId(scope.userId);
    const rows = await prisma.$queryRaw<DocumentSqlRow[]>`
      SELECT f.id, f.title, f.kind, f.url, c.name AS client, e.name AS project, i.number AS invoice, o.number AS po, u.name AS person,
        f.client_id, f.engagement_id, f.invoice_id, f.client_order_id, f.user_id, f.follow_up_at, f.created_at
      FROM crm_files f
      LEFT JOIN clients c ON c.id = f.client_id
      LEFT JOIN engagements e ON e.id = f.engagement_id
      LEFT JOIN invoices i ON i.id = f.invoice_id
      LEFT JOIN client_orders o ON o.id = f.client_order_id
      LEFT JOIN "user" u ON u.id = f.user_id
      WHERE (${clientId}::text IS NULL OR f.client_id = ${clientId})
        AND (${engagementId}::text IS NULL OR f.engagement_id = ${engagementId})
        AND (${invoiceId}::text IS NULL OR f.invoice_id = ${invoiceId})
        AND (${clientOrderId}::text IS NULL OR f.client_order_id = ${clientOrderId})
        AND (${userId}::text IS NULL OR f.user_id = ${userId})
      ORDER BY f.created_at DESC
      LIMIT 200
    `;
    return rows.map(mapDocumentRow);
  } catch {
    const files = await prisma.attachment.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
    return files
      .filter((r) => {
        if (typeof filter === "string") return r.entityType === "client" && r.entityId === filter;
        if (!scope.clientId && !scope.engagementId && !scope.invoiceId && !scope.clientOrderId && !scope.userId) return true;
        if (scope.engagementId) return r.entityType === "engagement" && r.entityId === scope.engagementId;
        if (scope.invoiceId) return r.entityType === "invoice" && r.entityId === scope.invoiceId;
        if (scope.clientOrderId) return r.entityType === "client_order" && r.entityId === scope.clientOrderId;
        if (scope.userId) return r.entityType === "user" && r.entityId === scope.userId;
        if (scope.clientId) return r.entityType === "client" && r.entityId === scope.clientId;
        return true;
      })
      .map((r) => ({
        id: r.id,
        filename: r.filename,
        kind: r.entityType,
        url: r.url,
        client: r.entityType === "client" ? r.entityId : "—",
        project: r.entityType === "engagement" ? r.entityId : "—",
        invoice: r.entityType === "invoice" ? r.entityId : "—",
        po: r.entityType === "client_order" ? r.entityId : "—",
        person: r.entityType === "user" ? r.entityId : "—",
        clientId: r.entityType === "client" ? r.entityId : null,
        engagementId: r.entityType === "engagement" ? r.entityId : null,
        invoiceId: r.entityType === "invoice" ? r.entityId : null,
        clientOrderId: r.entityType === "client_order" ? r.entityId : null,
        userId: r.entityType === "user" ? r.entityId : null,
        followUp: "—",
        createdAt: r.createdAt.toISOString().slice(0, 10),
      }));
  }
}

export async function createDocument(actor: AuthUser, input: z.infer<typeof documentSchema>) {
  await ensureOpsTables();
  const data = documentSchema.parse(input);
  const tags = await resolveDocumentTags(data);
  const id = crypto.randomUUID();
  const followUp = data.followUpAt ? new Date(`${data.followUpAt.slice(0, 10)}T00:00:00.000Z`) : null;
  await prisma.$executeRaw`
    INSERT INTO crm_files (id, title, kind, url, client_id, engagement_id, invoice_id, client_order_id, user_id, follow_up_at, notes, created_by)
    VALUES (
      ${id},
      ${data.title},
      ${data.kind ?? "OTHER"},
      ${data.url},
      ${tags.clientId},
      ${tags.engagementId},
      ${tags.invoiceId},
      ${tags.clientOrderId},
      ${tags.userId},
      ${followUp}::date,
      ${data.notes || null},
      ${actor.id}
    )
  `;
  const entityType = tags.invoiceId
    ? "invoice"
    : tags.clientOrderId
      ? "client_order"
      : tags.engagementId
        ? "engagement"
        : tags.userId
          ? "user"
          : "client";
  const entityId = tags.invoiceId || tags.clientOrderId || tags.engagementId || tags.userId || tags.clientId;
  if (entityId) {
    await prisma.attachment
      .create({
        data: {
          entityType,
          entityId,
          filename: data.title,
          url: data.url,
          uploadedBy: actor.id,
        },
      })
      .catch(() => undefined);
  }
  await writeAudit({
    userId: actor.id,
    action: "document.created",
    entityType: "document",
    entityId: id,
    newValue: { title: data.title, ...tags },
  });
  return { id };
}

export async function updateDocument(actor: AuthUser, input: z.infer<typeof documentSchema>) {
  await ensureOpsTables();
  const data = documentSchema.parse(input);
  if (!data.id) throw new HttpError(400, "Document is required", "VALIDATION");
  const tags = await resolveDocumentTags(data);
  const followUp = data.followUpAt ? new Date(`${data.followUpAt.slice(0, 10)}T00:00:00.000Z`) : null;
  await prisma.$executeRaw`
    UPDATE crm_files
    SET title = ${data.title},
        kind = ${data.kind ?? "OTHER"},
        url = ${data.url},
        client_id = ${tags.clientId},
        engagement_id = ${tags.engagementId},
        invoice_id = ${tags.invoiceId},
        client_order_id = ${tags.clientOrderId},
        user_id = ${tags.userId},
        follow_up_at = ${followUp}::date,
        notes = ${data.notes || null}
    WHERE id = ${data.id}
  `;
  await writeAudit({
    userId: actor.id,
    action: "document.updated",
    entityType: "document",
    entityId: data.id,
    newValue: { title: data.title, ...tags },
  });
  return { id: data.id };
}

export async function deleteDocument(actor: AuthUser, id: string) {
  if (!canDeleteRecords(actor)) throw new HttpError(403, "Not allowed to delete this record", "FORBIDDEN");
  await ensureOpsTables();
  const rows = await prisma
    .$queryRaw<Array<{ id: string; title: string; url: string }>>`
      SELECT id, title, url FROM crm_files WHERE id = ${id}
    `
    .catch(() => [] as Array<{ id: string; title: string; url: string }>);
  const row = rows[0] ?? (await prisma.attachment.findUnique({ where: { id } }));
  if (!row) throw new HttpError(404, "Document not found", "NOT_FOUND");
  await prisma.$executeRaw`DELETE FROM crm_files WHERE id = ${id}`.catch(() => undefined);
  await prisma.attachment.delete({ where: { id } }).catch(() => undefined);
  await writeAudit({ userId: actor.id, action: "document.deleted", entityType: "document", entityId: id });
  return { id };
}

export async function deleteLeadImportFile(actor: AuthUser, id: string) {
  await ensureOpsTables();
  const rows = await prisma.$queryRaw<Array<{ id: string; kind: string; title: string }>>`
    SELECT id, kind, title FROM crm_files WHERE id = ${id}
  `;
  const row = rows[0];
  if (!row || row.kind !== "LEAD_IMPORT") throw new HttpError(404, "Lead file not found", "NOT_FOUND");
  await prisma.$executeRaw`DELETE FROM crm_files WHERE id = ${id}`;
  await writeAudit({
    userId: actor.id,
    action: "lead_import.deleted",
    entityType: "document",
    entityId: id,
    oldValue: { title: row.title },
  });
  return { id };
}

export async function getCustomer360(clientId: string) {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      industry: true,
      campaigns: {
        orderBy: { createdAt: "desc" },
        include: { owner: { select: { id: true, name: true } } },
      },
      leads: {
        take: 12,
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          fullName: true,
          leadNumber: true,
          nextFollowupAt: true,
          firstContactAt: true,
          assignedUser: { select: { name: true } },
          status: { select: { name: true, key: true } },
        },
      },
      engagements: { take: 20, orderBy: { createdAt: "desc" } },
      invoices: { take: 20, orderBy: { createdAt: "desc" }, include: { engagement: { select: { name: true } } } },
      expenses: { take: 20, orderBy: { createdAt: "desc" } },
      licenses: { take: 20, orderBy: { expiryDate: "asc" } },
      purchases: { take: 20, orderBy: { createdAt: "desc" } },
    },
  });
  if (!client) throw new HttpError(404, "Client not found", "NOT_FOUND");

  const month = istPeriodRange("month");
  const monthGte = new Date(`${month.from}T00:00:00+05:30`);
  const monthLte = new Date(`${month.to}T23:59:59.999+05:30`);
  const today = startOfIstDay();
  const leadBase = { clientId, deletedAt: null };
  const monthLeads = {
    ...leadBase,
    OR: [
      { generatedAt: { gte: monthGte, lte: monthLte } },
      { generatedAt: null, createdAt: { gte: monthGte, lte: monthLte } },
    ],
  };

  const { listClientOrders, listContacts } = await import("@/modules/resources/service");
  const [
    contacts,
    orders,
    files,
    lifetime,
    thisMonth,
    adSpendAll,
    adSpendMonth,
    firstCallLate,
    overdueFollowups,
    inNurture,
    unassigned,
    callsMonth,
    connectedMonth,
    invoiceTotals,
  ] = await Promise.all([
    listContacts(clientId),
    listClientOrders(clientId),
    listDocuments(clientId),
    computeLeadMetrics(leadBase),
    computeLeadMetrics(monthLeads),
    prisma.marketingSpend.aggregate({ where: { campaign: { clientId } }, _sum: { amount: true } }),
    prisma.marketingSpend.aggregate({
      where: { campaign: { clientId }, spendDate: { gte: monthGte, lte: monthLte } },
      _sum: { amount: true },
    }),
    prisma.lead.count({
      where: {
        ...leadBase,
        assignedUserId: { not: null },
        firstContactAt: null,
        status: { isFinal: false },
        slaFirstCallDueAt: { lt: today },
      },
    }),
    prisma.lead.count({
      where: { ...leadBase, status: { isFinal: false }, nextFollowupAt: { lt: today } },
    }),
    prisma.lead.count({ where: { ...leadBase, status: { key: "NURTURE" } } }),
    prisma.lead.count({ where: { ...leadBase, assignedUserId: null, status: { isFinal: false } } }),
    prisma.callLog.count({
      where: { lead: { clientId, deletedAt: null }, startedAt: { gte: monthGte, lte: monthLte } },
    }),
    prisma.callLog.count({
      where: {
        lead: { clientId, deletedAt: null },
        startedAt: { gte: monthGte, lte: monthLte },
        durationSec: { gt: 0 },
      },
    }),
    prisma.invoice.aggregate({
      where: { clientId, kind: { not: "QUOTE" }, status: { not: "VOID" } },
      _sum: { total: true, paid: true },
    }),
  ]);

  const campaignRows = await Promise.all(
    client.campaigns.map(async (campaign) => {
      const base = await computeLeadMetrics({ campaignId: campaign.id, deletedAt: null });
      const lineSum = await prisma.marketingSpend.aggregate({
        where: { campaignId: campaign.id },
        _sum: { amount: true },
      });
      const spend = Number(lineSum._sum.amount ?? 0) || money(campaign.actualSpend);
      const kpis = metricsFromCounts({ ...base, spend });
      return {
        id: campaign.id,
        name: campaign.name,
        platform: campaign.platform,
        isActive: campaign.isActive,
        owner: campaign.owner?.name ?? "—",
        budget: money(campaign.budget),
        spend: kpis.spend,
        leads: kpis.leads,
        qualified: kpis.qualified,
        won: kpis.won,
        cpl: kpis.cpl,
        conversionRate: kpis.conversionRate,
      };
    }),
  );

  const billed = money(invoiceTotals._sum.total);
  const collected = money(invoiceTotals._sum.paid);
  const outstanding = billed - collected;
  const opsCost =
    client.expenses.reduce((s, e) => s + money(e.amount), 0) +
    client.purchases.reduce((s, p) => s + money(p.amount), 0) +
    client.licenses.reduce((s, l) => s + money(l.amount), 0);
  const adSpend = money(adSpendAll._sum.amount);
  const monthAdSpend = money(adSpendMonth._sum.amount);
  const monthKpis = metricsFromCounts({ ...thisMonth, spend: monthAdSpend });
  const cost = opsCost + adSpend;
  const poValue = orders.reduce((s, o) => s + money(o.value), 0);
  const poRemaining = orders.reduce((s, o) => s + money(o.remaining), 0);

  return {
    ...client,
    month: { from: month.from, to: month.to },
    review: {
      leads: lifetime.leads,
      monthLeads: monthKpis.leads,
      monthCpl: monthKpis.cpl,
      monthCalls: callsMonth,
      monthConnected: connectedMonth,
      monthWon: monthKpis.won,
      firstCallLate,
      overdueFollowups,
      inNurture,
      unassigned,
      adSpend,
      monthAdSpend,
      opsCost,
      poValue,
      poRemaining,
      billedVsPo: poValue > 0 ? Math.round((billed / poValue) * 1000) / 10 : null,
    },
    campaigns: campaignRows,
    engagements: client.engagements.map((e) => ({
      ...e,
      budget: money(e.budget),
      billed: money(e.billed),
      dueDate: e.dueDate?.toISOString() ?? null,
    })),
    invoices: client.invoices.map((i) => ({
      ...i,
      total: money(i.total),
      paid: money(i.paid),
      outstanding: money(i.total) - money(i.paid),
      issueDate: i.issueDate.toISOString(),
      payment: paymentStatus({
        total: money(i.total),
        paid: money(i.paid),
        dueDate: i.dueDate,
        status: i.status,
      }),
      project: i.engagement?.name ?? "—",
    })),
    expenses: client.expenses.map((e) => ({ ...e, amount: money(e.amount), spentOn: e.spentOn.toISOString() })),
    licenses: client.licenses.map((l) => ({ ...l, amount: money(l.amount), expiryDate: l.expiryDate?.toISOString() ?? null })),
    purchases: client.purchases.map((p) => ({ ...p, amount: money(p.amount) })),
    contacts: contacts.map((c) => ({
      id: c.id,
      name: c.name,
      designation: c.designation,
      email: c.email,
      mobile: c.mobile,
      whatsapp: c.whatsapp,
      primary: c.is_primary,
    })),
    orders: orders.map((o) => ({
      id: o.id,
      number: o.number,
      value: money(o.value),
      utilized: money(o.utilized),
      remaining: money(o.remaining),
      status: o.payment ?? o.status,
      project: o.project,
      followUp: o.followUp,
    })),
    files,
    outstanding,
    collected,
    billed,
    cost,
    profit: collected - cost,
  };
}

export { HttpError };
