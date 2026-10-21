import { z } from "zod";
import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { poPaymentStatus, vsBench } from "@/lib/commercial";
import { ensureOpsTables } from "@/lib/ops-tables";
import type { AuthUser } from "@/lib/rbac";
import { optionalId, requiredId } from "@/lib/ids";

const WEEK_HOURS = 40;

export const allocationSchema = z.object({
  userId: requiredId("a person"),
  engagementId: requiredId("a project"),
  roleLabel: z.string().trim().max(80).optional().or(z.literal("")),
  hoursWeek: z.coerce.number().min(0).max(80),
  startDate: z.string().optional().or(z.literal("")),
  endDate: z.string().optional().or(z.literal("")),
  billable: z.boolean().optional(),
  hourlyCost: z.coerce.number().min(0).optional(),
});

export const contactSchema = z.object({
  clientId: requiredId("a client"),
  name: z.string().trim().min(2).max(120),
  designation: z.string().trim().max(80).optional().or(z.literal("")),
  email: z.string().trim().email().optional().or(z.literal("")),
  mobile: z.string().trim().max(20).optional().or(z.literal("")),
  whatsapp: z.string().trim().max(20).optional().or(z.literal("")),
  isPrimary: z.boolean().optional(),
});

export const clientOrderSchema = z.object({
  clientId: requiredId("a client"),
  engagementId: optionalId,
  number: z.string().trim().min(2).max(80),
  value: z.coerce.number().min(0),
  taxPct: z.coerce.number().min(0).max(40).optional(),
  orderedAt: z.string().optional().or(z.literal("")),
  validUntil: z.string().optional().or(z.literal("")),
  documentUrl: z.string().trim().max(500).optional().or(z.literal("")),
  followUpAt: z.string().optional().or(z.literal("")),
  benchmarkAmount: z.coerce.number().min(0).optional(),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

function n(v: unknown) {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
}

export async function marginFloor() {
  const row = await prisma.setting.findUnique({ where: { key: "margin_floor_pct" } });
  const value = typeof row?.value === "number" ? row.value : Number(row?.value ?? 25);
  return Number.isFinite(value) ? value : 25;
}

export function forecastFrom(input: {
  revenue: number;
  people?: number;
  ads?: number;
  tools?: number;
  other?: number;
  floor?: number;
}) {
  const cost = n(input.people) + n(input.ads) + n(input.tools) + n(input.other);
  const profit = n(input.revenue) - cost;
  const margin = n(input.revenue) > 0 ? Math.round((profit / n(input.revenue)) * 1000) / 10 : 0;
  const floor = input.floor ?? 25;
  return { cost, profit, margin, floor, warn: n(input.revenue) > 0 && margin < floor };
}

export async function listCapacity() {
  await ensureOpsTables();
  const people = await prisma.user.findMany({
    where: { isActive: true, role: { key: { not: "client" } } },
    include: { employee: true, role: true },
    orderBy: { name: "asc" },
  });
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      user_id: string;
      engagement_id: string;
      role_label: string | null;
      hours_week: unknown;
      pct: unknown;
      start_date: Date | null;
      end_date: Date | null;
      billable: boolean;
      hourly_cost: unknown;
      project: string | null;
      client: string | null;
    }>
  >`
    SELECT a.id, a.user_id, a.engagement_id, a.role_label, a.hours_week, a.pct,
           a.start_date, a.end_date, a.billable, a.hourly_cost,
           e.name AS project, c.name AS client
    FROM resource_allocations a
    LEFT JOIN engagements e ON e.id = a.engagement_id
    LEFT JOIN clients c ON c.id = e.client_id
    ORDER BY a.created_at DESC
  `;
  const byUser = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = byUser.get(row.user_id) ?? [];
    list.push(row);
    byUser.set(row.user_id, list);
  }
  return people.map((person) => {
    const allocations = (byUser.get(person.id) ?? []).map((a) => ({
      id: a.id,
      projectId: a.engagement_id,
      project: a.project ?? "Project",
      client: a.client ?? "—",
      role: a.role_label ?? "Delivery",
      hoursWeek: n(a.hours_week),
      pct: n(a.pct),
      billable: a.billable,
      hourlyCost: n(a.hourly_cost),
    }));
    const used = allocations.reduce((s, a) => s + a.hoursWeek, 0);
    const capacity = WEEK_HOURS;
    return {
      id: person.id,
      name: person.name,
      role: person.role.name,
      designation: person.employee?.designation ?? null,
      photoUrl: person.image,
      monthlyCost: n(person.employee?.salaryAmount),
      capacity,
      used,
      available: Math.max(0, capacity - used),
      over: used > capacity,
      allocations,
    };
  });
}

export async function createAllocation(actor: AuthUser, input: z.infer<typeof allocationSchema>) {
  await ensureOpsTables();
  const data = allocationSchema.parse(input);
  const capacity = await listCapacity();
  const person = capacity.find((p) => p.id === data.userId);
  if (!person) throw new HttpError(404, "Person not found", "NOT_FOUND");
  if (person.used + data.hoursWeek > person.capacity + 0.01) {
    throw new HttpError(
      400,
      `${person.name} has ${person.available} hours free this week. Reduce allocation before assigning ${data.hoursWeek} hours.`,
      "OVER_ALLOCATED",
    );
  }
  const id = crypto.randomUUID();
  const pct = Math.round((data.hoursWeek / WEEK_HOURS) * 1000) / 10;
  const hourly =
    data.hourlyCost ??
    (person.monthlyCost ? Math.round((person.monthlyCost / (WEEK_HOURS * 4.3)) * 100) / 100 : 0);
  await prisma.$executeRaw`
    INSERT INTO resource_allocations
      (id, user_id, engagement_id, role_label, hours_week, pct, start_date, end_date, billable, hourly_cost)
    VALUES (
      ${id},
      ${data.userId},
      ${data.engagementId},
      ${data.roleLabel || "Delivery"},
      ${data.hoursWeek},
      ${pct},
      ${data.startDate || null},
      ${data.endDate || null},
      ${data.billable ?? true},
      ${hourly}
    )
  `;
  await writeAudit({
    userId: actor.id,
    action: "allocation.created",
    entityType: "resource_allocation",
    entityId: id,
    newValue: { userId: data.userId, engagementId: data.engagementId, hoursWeek: data.hoursWeek },
  });
  return { id };
}

export async function listContacts(clientId: string) {
  await ensureOpsTables();
  return prisma.$queryRaw<
    Array<{
      id: string;
      name: string;
      designation: string | null;
      email: string | null;
      mobile: string | null;
      whatsapp: string | null;
      is_primary: boolean;
    }>
  >`
    SELECT id, name, designation, email, mobile, whatsapp, is_primary
    FROM client_contacts
    WHERE client_id = ${clientId}
    ORDER BY is_primary DESC, name ASC
  `;
}

export async function createContact(actor: AuthUser, input: z.infer<typeof contactSchema>) {
  await ensureOpsTables();
  const data = contactSchema.parse(input);
  const id = crypto.randomUUID();
  if (data.isPrimary) {
    await prisma.$executeRaw`UPDATE client_contacts SET is_primary = false WHERE client_id = ${data.clientId}`;
  }
  await prisma.$executeRaw`
    INSERT INTO client_contacts (id, client_id, name, designation, email, mobile, whatsapp, is_primary)
    VALUES (
      ${id},
      ${data.clientId},
      ${data.name},
      ${data.designation || null},
      ${data.email || null},
      ${data.mobile || null},
      ${data.whatsapp || data.mobile || null},
      ${data.isPrimary ?? false}
    )
  `;
  await writeAudit({
    userId: actor.id,
    action: "contact.created",
    entityType: "client_contact",
    entityId: id,
    newValue: { clientId: data.clientId, name: data.name },
  });
  return { id };
}

export async function listClientOrders(clientId?: string) {
  await ensureOpsTables();
  type OrderRow = {
    id: string;
    number: string;
    client_id: string;
    engagement_id: string | null;
    value: unknown;
    utilized: unknown;
    status: string;
    client: string | null;
    project: string | null;
    follow_up_at: Date | null;
    benchmark_amount: unknown;
    billed: unknown;
    collected: unknown;
  };
  const mapRow = (o: OrderRow) => {
    const value = n(o.value);
    const billed = n(o.billed);
    const collected = n(o.collected);
    const bench = n(o.benchmark_amount) || value;
    return {
      ...o,
      value,
      utilized: n(o.utilized),
      billed,
      collected,
      remaining: value - billed,
      payment: poPaymentStatus({ value, billed, collected }),
      followUp: o.follow_up_at ? new Date(o.follow_up_at).toISOString().slice(0, 10) : "—",
      bench,
      vsBench: vsBench(billed, bench),
      client: o.client,
      project: o.project,
    };
  };
  try {
    const rows = clientId
      ? await prisma.$queryRaw<OrderRow[]>`
        SELECT o.id, o.number, o.client_id, o.engagement_id, o.value, o.utilized, o.status, c.name AS client, e.name AS project,
          o.follow_up_at, o.benchmark_amount,
          COALESCE((SELECT SUM(i.total) FROM invoices i WHERE i.engagement_id = o.engagement_id AND i.kind <> 'QUOTE' AND i.status <> 'VOID'), 0) AS billed,
          COALESCE((SELECT SUM(i.paid) FROM invoices i WHERE i.engagement_id = o.engagement_id AND i.kind <> 'QUOTE' AND i.status <> 'VOID'), 0) AS collected
        FROM client_orders o
        LEFT JOIN clients c ON c.id = o.client_id
        LEFT JOIN engagements e ON e.id = o.engagement_id
        WHERE o.client_id = ${clientId}
        ORDER BY o.created_at DESC
      `
      : await prisma.$queryRaw<OrderRow[]>`
        SELECT o.id, o.number, o.client_id, o.engagement_id, o.value, o.utilized, o.status, c.name AS client, e.name AS project,
          o.follow_up_at, o.benchmark_amount,
          COALESCE((SELECT SUM(i.total) FROM invoices i WHERE i.engagement_id = o.engagement_id AND i.kind <> 'QUOTE' AND i.status <> 'VOID'), 0) AS billed,
          COALESCE((SELECT SUM(i.paid) FROM invoices i WHERE i.engagement_id = o.engagement_id AND i.kind <> 'QUOTE' AND i.status <> 'VOID'), 0) AS collected
        FROM client_orders o
        LEFT JOIN clients c ON c.id = o.client_id
        LEFT JOIN engagements e ON e.id = o.engagement_id
        ORDER BY o.created_at DESC
        LIMIT 80
      `;
    return rows.map(mapRow);
  } catch {
    const rows = clientId
      ? await prisma.$queryRaw<OrderRow[]>`
        SELECT o.id, o.number, o.client_id, o.engagement_id, o.value, o.utilized, o.status, c.name AS client, e.name AS project,
          NULL::date AS follow_up_at, o.value AS benchmark_amount, o.utilized AS billed, 0 AS collected
        FROM client_orders o
        LEFT JOIN clients c ON c.id = o.client_id
        LEFT JOIN engagements e ON e.id = o.engagement_id
        WHERE o.client_id = ${clientId}
        ORDER BY o.created_at DESC
      `
      : await prisma.$queryRaw<OrderRow[]>`
        SELECT o.id, o.number, o.client_id, o.engagement_id, o.value, o.utilized, o.status, c.name AS client, e.name AS project,
          NULL::date AS follow_up_at, o.value AS benchmark_amount, o.utilized AS billed, 0 AS collected
        FROM client_orders o
        LEFT JOIN clients c ON c.id = o.client_id
        LEFT JOIN engagements e ON e.id = o.engagement_id
        ORDER BY o.created_at DESC
        LIMIT 80
      `;
    return rows.map(mapRow);
  }
}

export async function createClientOrder(actor: AuthUser, input: z.infer<typeof clientOrderSchema>) {
  await ensureOpsTables();
  const data = clientOrderSchema.parse(input);
  const id = crypto.randomUUID();
  const asDate = (value?: string) => (value ? new Date(`${value.slice(0, 10)}T00:00:00.000Z`) : null);
  await prisma.$executeRaw`
    INSERT INTO client_orders (id, number, client_id, engagement_id, value, tax_pct, ordered_at, valid_until, document_url, notes, status, follow_up_at, benchmark_amount)
    VALUES (
      ${id},
      ${data.number},
      ${data.clientId},
      ${data.engagementId || null},
      ${data.value},
      ${data.taxPct ?? 18},
      ${asDate(data.orderedAt)}::date,
      ${asDate(data.validUntil)}::date,
      ${data.documentUrl || null},
      ${data.notes || null},
      'RECEIVED',
      ${asDate(data.followUpAt)}::date,
      ${data.benchmarkAmount ?? data.value}
    )
  `;
  if (data.engagementId) {
    await prisma.$executeRaw`UPDATE engagements SET po_value = ${data.value} WHERE id = ${data.engagementId}`;
    if (data.documentUrl) {
      await prisma.attachment.create({
        data: {
          entityType: "engagement",
          entityId: data.engagementId,
          filename: `PO ${data.number}`,
          url: data.documentUrl,
          uploadedBy: actor.id,
        },
      }).catch(() => undefined);
    }
  }
  await writeAudit({
    userId: actor.id,
    action: "client_order.created",
    entityType: "client_order",
    entityId: id,
    newValue: { number: data.number, value: data.value },
  });
  return { id };
}
