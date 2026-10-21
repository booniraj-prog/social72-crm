import { prisma } from "@/lib/db";
import type { AuthUser } from "@/lib/rbac";
import { playbookFor, type WorkflowQueue } from "@/lib/workflow";
import { canApprove } from "@/lib/approvals";
import { leadScopeWhere } from "@/lib/scope";
import { addIstDays, istRange, startOfIstDay, ymdInIst } from "@/lib/time";
import { ensureOpsTables } from "@/lib/ops-tables";

function money(n: unknown) {
  return Number(n ?? 0);
}

async function commercialFollowups() {
  await ensureOpsTables();
  try {
    return await prisma.$queryRaw<Array<{ id: string; title: string; href: string; meta: string; follow_up_at: Date }>>`
      SELECT i.id, i.number AS title, CAST('/invoices' AS text) AS href, c.name AS meta, i.follow_up_at
      FROM invoices i
      JOIN clients c ON c.id = i.client_id
      WHERE i.follow_up_at IS NOT NULL AND i.kind <> 'QUOTE' AND i.status <> 'VOID'
      UNION ALL
      SELECT f.id, f.title, CAST('/documents' AS text), COALESCE(c.name, ''), f.follow_up_at
      FROM crm_files f
      LEFT JOIN clients c ON c.id = f.client_id
      WHERE f.follow_up_at IS NOT NULL
      UNION ALL
      SELECT o.id, o.number, CAST('/orders' AS text), COALESCE(c.name, ''), o.follow_up_at
      FROM client_orders o
      LEFT JOIN clients c ON c.id = o.client_id
      WHERE o.follow_up_at IS NOT NULL
    `;
  } catch {
    return [];
  }
}

export async function todayBoard(actor: AuthUser) {
  const scope = await leadScopeWhere(actor);
  const today = istRange("today");
  const overdue = istRange("overdue");
  const now = new Date();
  const mine = actor.roleKey === "bpo_executive" || actor.roleKey === "employee";

  const [followupsToday, followupsOverdue, callsDue, tasksToday, tasksOverdue, deliverables, meetings, moneyFollowups] =
    await Promise.all([
      prisma.lead.findMany({
        where: { AND: [scope, { status: { isFinal: false }, nextFollowupAt: { gte: today.gte, lt: today.lt } }] },
        take: 20,
        orderBy: { nextFollowupAt: "asc" },
        select: { id: true, fullName: true, nextAction: true, nextFollowupAt: true, client: { select: { name: true } } },
      }),
      prisma.lead.findMany({
        where: { AND: [scope, { status: { isFinal: false }, nextFollowupAt: { lt: overdue.lt } }] },
        take: 20,
        orderBy: { nextFollowupAt: "asc" },
        select: { id: true, fullName: true, nextAction: true, nextFollowupAt: true, client: { select: { name: true } } },
      }),
      prisma.lead.findMany({
        where: {
          AND: [
            scope,
            { status: { isFinal: false } },
            {
              OR: [
                { nextFollowupAt: { gte: today.gte, lt: today.lt } },
                { nextAction: { contains: "call", mode: "insensitive" } },
              ],
            },
          ],
        },
        take: 20,
        select: { id: true, fullName: true, nextAction: true, client: { select: { name: true } } },
      }),
      prisma.task.findMany({
        where: {
          status: { notIn: ["DONE", "CANCELLED"] },
          dueAt: { gte: today.gte, lt: today.lt },
          ...(mine ? { assignedTo: actor.id } : {}),
        },
        take: 20,
        include: { assignee: { select: { name: true } } },
      }),
      prisma.task.findMany({
        where: {
          status: { notIn: ["DONE", "CANCELLED"] },
          dueAt: { lt: now },
          ...(mine ? { assignedTo: actor.id } : {}),
        },
        take: 20,
        include: { assignee: { select: { name: true } } },
      }),
      prisma.deliverable.findMany({
        where: {
          status: { notIn: ["COMPLETED", "APPROVED"] },
          dueDate: { lte: addIstDays(startOfIstDay(), 7) },
        },
        take: 20,
        include: { engagement: { select: { name: true } } },
      }),
      prisma.lead.findMany({
        where: {
          AND: [scope, { status: { isFinal: false }, nextAction: { contains: "meet", mode: "insensitive" } }],
        },
        take: 10,
        select: { id: true, fullName: true, nextFollowupAt: true, nextAction: true },
      }),
      commercialFollowups(),
    ]);

  const todayKey = ymdInIst(new Date());
  const moneyItems = moneyFollowups.map((row) => ({
    id: row.id,
    title: row.title,
    href: row.href,
    meta: row.meta,
    day: ymdInIst(new Date(row.follow_up_at)),
  }));

  return {
    followupsToday: [
      ...followupsToday.map(serializeItem),
      ...moneyItems.filter((row) => row.day === todayKey).map(({ day: _day, ...row }) => row),
    ],
    followupsOverdue: [
      ...followupsOverdue.map(serializeItem),
      ...moneyItems.filter((row) => row.day < todayKey).map(({ day: _day, ...row }) => row),
    ],
    callsDue: callsDue.map(serializeItem),
    meetings: meetings.map(serializeItem),
    tasksToday: tasksToday.map((t) => ({
      id: t.id,
      title: t.title,
      href: "/work-tasks",
      meta: t.assignee?.name ?? "",
    })),
    tasksOverdue: tasksOverdue.map((t) => ({
      id: t.id,
      title: t.title,
      href: "/work-tasks",
      meta: t.assignee?.name ?? "",
    })),
    deliverables: deliverables.map((d) => ({
      id: d.id,
      title: d.title,
      href: "/engagements",
      meta: d.engagement.name,
    })),
  };
}

type QueueItem = { id: string; title: string; href: string; meta: string };

export async function roleInbox(actor: AuthUser) {
  const playbook = playbookFor(actor);
  const board = await todayBoard(actor);
  const needed = new Set(playbook.queues);
  const [peopleOk, projectOk, invoiceOk, proposalOk] = await Promise.all([
    canApprove(actor, "people"),
    canApprove(actor, "project"),
    canApprove(actor, "invoice"),
    canApprove(actor, "proposal"),
  ]);
  if (peopleOk) needed.add("people");
  if (projectOk) needed.add("projects");
  if (invoiceOk) needed.add("invoices");
  if (proposalOk) needed.add("quotes");
  const extra = await extraQueues(actor, needed);
  const queues: Array<{ key: WorkflowQueue; title: string; href: string; danger?: boolean; items: QueueItem[] }> = [];
  if (needed.has("unassigned")) queues.push({ key: "unassigned", title: "Unassigned leads", href: "/leads", items: extra.unassigned });
  if (needed.has("calls")) queues.push({ key: "calls", title: "Calls", href: "/calling", items: board.callsDue });
  if (needed.has("followups")) {
    queues.push({ key: "followups", title: "Follow-ups due", href: "/follow-ups?bucket=today", items: board.followupsToday });
    queues.push({ key: "followups", title: "Overdue follow-ups", href: "/follow-ups?bucket=overdue", items: board.followupsOverdue, danger: true });
  }
  if (needed.has("quotes")) queues.push({ key: "quotes", title: "Draft proposals", href: "/proposals", items: extra.quotes });
  if (needed.has("untagged")) queues.push({ key: "untagged", title: "Won quotes to tag", href: "/proposals", items: extra.untagged });
  if (needed.has("invoices")) queues.push({ key: "invoices", title: "Invoices to approve", href: "/invoices", items: extra.invoices });
  if (needed.has("spend")) queues.push({ key: "spend", title: "Spend to approve", href: "/spend", items: extra.spend });
  if (needed.has("people")) queues.push({ key: "people", title: "People to approve", href: "/people", items: extra.people });
  if (needed.has("projects")) queues.push({ key: "projects", title: "Projects to approve", href: "/engagements", items: extra.projects });
  if (needed.has("tasks")) {
    queues.push({ key: "tasks", title: "Tasks due today", href: "/work-tasks", items: board.tasksToday });
    queues.push({ key: "tasks", title: "Overdue tasks", href: "/work-tasks", items: board.tasksOverdue, danger: true });
  }
  if (needed.has("deliverables")) queues.push({ key: "deliverables", title: "Deliverables this week", href: "/engagements", items: board.deliverables });
  const due = queues.filter((q) => !q.danger).reduce((n, q) => n + q.items.length, 0);
  const overdue = queues.filter((q) => q.danger).reduce((n, q) => n + q.items.length, 0);
  return { playbook, queues, due, overdue };
}

async function extraQueues(actor: AuthUser, needed: Set<WorkflowQueue>) {
  const empty: QueueItem[] = [];
  const [unassigned, quotes, invoices, spend, people, projects] = await Promise.all([
    needed.has("unassigned")
      ? prisma.lead.findMany({
          where: { deletedAt: null, assignedUserId: null, status: { isFinal: false } },
          take: 20,
          orderBy: { createdAt: "desc" },
          select: { id: true, fullName: true, client: { select: { name: true } } },
        })
      : Promise.resolve([]),
    needed.has("quotes") || needed.has("untagged")
      ? prisma.invoice.findMany({
          where: { kind: "QUOTE", status: { not: "VOID" } },
          take: 40,
          orderBy: { createdAt: "desc" },
          select: { id: true, number: true, status: true, engagementId: true, client: { select: { name: true } } },
        })
      : Promise.resolve([]),
    needed.has("invoices")
      ? prisma.invoice.findMany({
          where: { kind: { not: "QUOTE" }, status: "DRAFT" },
          take: 20,
          select: { id: true, number: true, client: { select: { name: true } } },
        })
      : Promise.resolve([]),
    needed.has("spend")
      ? Promise.all([
          prisma.expense.findMany({
            where: { status: "SUBMITTED", ...(canSeeAllSpend(actor) ? {} : { claimantId: actor.id }) },
            take: 15,
            select: { id: true, category: true, amount: true, claimant: { select: { name: true } } },
          }),
          prisma.purchaseOrder.findMany({
            where: { status: "REQUESTED", ...(canSeeAllSpend(actor) ? {} : { ownerUserId: actor.id }) },
            take: 15,
            select: { id: true, number: true, title: true },
          }),
        ])
      : Promise.resolve([[], []] as const),
    needed.has("people")
      ? prisma.$queryRaw<Array<{ id: string; name: string; email: string }>>`
          SELECT id, name, email FROM "user" WHERE approval_status = 'PENDING' ORDER BY created_at DESC LIMIT 20
        `.catch(() => [] as Array<{ id: string; name: string; email: string }>)
      : Promise.resolve([]),
    needed.has("projects")
      ? prisma
          .$queryRaw<Array<{ id: string; name: string; client: string | null }>>`
            SELECT e.id, e.name, c.name AS client
            FROM engagements e
            LEFT JOIN clients c ON c.id = e.client_id
            WHERE COALESCE(e.approval_status, 'APPROVED') = 'PENDING'
            ORDER BY e.created_at DESC
            LIMIT 20
          `
          .catch(() => [] as Array<{ id: string; name: string; client: string | null }>)
      : Promise.resolve([]),
  ]);
  const quoteRows = Array.isArray(quotes) ? quotes : [];
  const [expenseRows, purchaseRows] = Array.isArray(spend) ? spend : [[], []];
  return {
    unassigned: unassigned.map((l) => ({
      id: l.id,
      title: l.fullName,
      href: `/leads/${l.id}`,
      meta: l.client.name,
    })),
    quotes: quoteRows
      .filter((q) => q.status === "DRAFT")
      .map((q) => ({ id: q.id, title: q.number, href: `/invoices/${q.id}`, meta: q.client.name })),
    untagged: quoteRows
      .filter((q) => !q.engagementId)
      .map((q) => ({ id: q.id, title: q.number, href: "/proposals", meta: `${q.client.name} · tag project` })),
    invoices: invoices.map((i) => ({ id: i.id, title: i.number, href: `/invoices/${i.id}`, meta: i.client.name })),
    spend: [
      ...expenseRows.map((e) => ({
        id: e.id,
        title: e.category,
        href: "/spend",
        meta: `${e.claimant.name} · pending`,
      })),
      ...purchaseRows.map((p) => ({
        id: p.id,
        title: p.number,
        href: "/spend",
        meta: p.title,
      })),
    ],
    people: people.map((u) => ({ id: u.id, title: u.name, href: "/people", meta: u.email })),
    projects: projects.map((p) => ({ id: p.id, title: p.name, href: "/engagements", meta: p.client ?? "" })),
    empty,
  };
}

function canSeeAllSpend(actor: AuthUser) {
  return ["super_admin", "crm_manager", "accounts", "hr_admin"].includes(actor.roleKey);
}

function serializeItem(row: {
  id: string;
  fullName: string;
  nextAction?: string | null;
  nextFollowupAt?: Date | null;
  client?: { name: string } | null;
}) {
  return {
    id: row.id,
    title: row.fullName,
    href: `/leads/${row.id}`,
    meta: [row.client?.name, row.nextAction].filter(Boolean).join(" · "),
  };
}

export async function exceptionBoard() {
  const now = new Date();
  const week = addIstDays(startOfIstDay(), 7);
  const [overdueFollowups, overdueTasks, overdueInvoices, overdueDeliverables, licenses] = await Promise.all([
    prisma.lead.count({
      where: { deletedAt: null, status: { isFinal: false }, nextFollowupAt: { lt: startOfIstDay() } },
    }),
    prisma.task.count({ where: { status: { notIn: ["DONE", "CANCELLED"] }, dueAt: { lt: now } } }),
    prisma.invoice.count({ where: { status: { in: ["OVERDUE", "SENT", "PARTIAL"] }, dueDate: { lt: now } } }),
    prisma.deliverable.count({
      where: { status: { notIn: ["COMPLETED", "APPROVED"] }, dueDate: { lt: now } },
    }),
    prisma.toolLicense.count({
      where: { expiryDate: { lte: week } },
    }),
  ]);

  const campaigns = await prisma.campaign.findMany({
    where: { isActive: true },
    select: { id: true, name: true, budget: true, actualSpend: true },
    take: 50,
  });
  const overspend = campaigns.filter((c) => money(c.actualSpend) > money(c.budget) && money(c.budget) > 0);

  const invoices = await prisma.invoice.findMany({
    where: { status: { in: ["SENT", "PARTIAL", "OVERDUE"] } },
    select: { id: true, number: true, total: true, paid: true, client: { select: { name: true } } },
    take: 20,
  });
  const largeOutstanding = invoices
    .map((i) => ({
      id: i.id,
      title: i.number,
      href: "/invoices",
      meta: `${i.client.name} · ₹${Math.round(money(i.total) - money(i.paid)).toLocaleString("en-IN")}`,
      amount: money(i.total) - money(i.paid),
    }))
    .filter((i) => i.amount >= 10000)
    .sort((a, b) => b.amount - a.amount);

  return {
    counts: {
      overdueFollowups,
      overdueTasks,
      overdueInvoices,
      overdueDeliverables,
      licensesDue: licenses,
      campaignsOverBudget: overspend.length,
    },
    campaignsOverBudget: overspend.map((c) => ({
      id: c.id,
      title: c.name,
      href: "/campaigns",
      meta: `Spend ₹${Math.round(money(c.actualSpend)).toLocaleString("en-IN")} / budget ₹${Math.round(money(c.budget)).toLocaleString("en-IN")}`,
    })),
    largeOutstanding,
  };
}

export async function profitability() {
  const [invoices, expenses, spend, licenses, purchases] = await Promise.all([
    prisma.invoice.aggregate({
      where: { status: { notIn: ["VOID", "DRAFT"] }, kind: { not: "QUOTE" } },
      _sum: { total: true, paid: true },
    }),
    prisma.expense.aggregate({ where: { status: { in: ["APPROVED", "REIMBURSED", "SUBMITTED"] } }, _sum: { amount: true } }),
    prisma.marketingSpend.aggregate({ _sum: { amount: true } }),
    prisma.toolLicense.aggregate({ _sum: { amount: true } }),
    prisma.purchaseOrder.aggregate({ where: { status: { not: "REJECTED" } }, _sum: { amount: true } }),
  ]);
  const revenue = money(invoices._sum.paid);
  const billed = money(invoices._sum.total);
  const adSpend = money(spend._sum.amount);
  const vendorCost = money(purchases._sum.amount);
  const toolCost = money(licenses._sum.amount);
  const other = money(expenses._sum.amount);
  const direct = adSpend + vendorCost + toolCost;
  const cost = direct + other;
  const gross = revenue - direct;
  const profit = revenue - cost;
  const grossPct = revenue > 0 ? Math.round((gross / revenue) * 1000) / 10 : 0;
  const margin = revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : 0;

  const byClient = await prisma.invoice.groupBy({
    by: ["clientId"],
    where: { status: { notIn: ["VOID", "DRAFT"] }, kind: { not: "QUOTE" } },
    _sum: { total: true, paid: true },
  });
  const clients = await prisma.client.findMany({
    where: { id: { in: byClient.map((g) => g.clientId) } },
    select: { id: true, name: true },
  });
  const names = Object.fromEntries(clients.map((c) => [c.id, c.name]));
  const clientRows = byClient
    .map((g) => ({
      clientId: g.clientId,
      client: names[g.clientId] ?? g.clientId,
      billed: money(g._sum.total),
      collected: money(g._sum.paid),
    }))
    .sort((a, b) => b.collected - a.collected)
    .slice(0, 12);

  const campaigns = await prisma.campaign.findMany({
    take: 12,
    orderBy: { actualSpend: "desc" },
    select: { id: true, name: true, budget: true, actualSpend: true, client: { select: { name: true } } },
  });

  return {
    billed,
    revenue,
    adSpend,
    vendorCost,
    toolCost,
    other,
    cost,
    gross,
    grossPct,
    profit,
    margin,
    clientRows,
    campaigns: campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      client: c.client.name,
      budget: money(c.budget),
      spend: money(c.actualSpend),
    })),
  };
}

export async function listNurtureTemplates() {
  try {
    return await prisma.nurtureTemplate.findMany({
      where: { isActive: true },
      orderBy: [{ journey: "asc" }, { dayOffset: "asc" }],
    });
  } catch {
    return [];
  }
}

export async function createNurtureTemplate(input: {
  name: string;
  channel?: string;
  journey?: string;
  dayOffset?: number;
  body: string;
}) {
  return prisma.nurtureTemplate.create({
    data: {
      name: input.name,
      channel: input.channel || "whatsapp",
      journey: input.journey || "general",
      dayOffset: Number(input.dayOffset) || 0,
      body: input.body,
    },
  });
}

export async function logNurture(actor: AuthUser, leadId: string, templateId: string) {
  const template = await prisma.nurtureTemplate.findUnique({ where: { id: templateId } });
  if (!template) return null;
  await prisma.activity.create({
    data: {
      leadId,
      userId: actor.id,
      type: template.channel,
      title: `${template.channel} · ${template.name}`,
      body: template.body,
    },
  });
  return template;
}
