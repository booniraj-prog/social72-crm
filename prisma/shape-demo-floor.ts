import type { PrismaClient } from "@prisma/client";

const KEEP_CLIENT_IDS = [
  "seed-client-gm-global",
  "seed-client-horizon-homes",
  "seed-client-northstar",
  "seed-client-atelier",
] as const;

const KEEP_CAMPAIGN_IDS = [
  "seed-campaign-class-11",
  "seed-campaign-riverfront",
  "seed-campaign-northstar-meta",
  "seed-campaign-atelier-search",
] as const;

const KEEP_LEAD_IDS = [
  "demo-lead-gm-01",
  "demo-lead-gm-02",
  "demo-lead-gm-03",
  "demo-lead-gm-04",
  "demo-lead-hz-01",
  "demo-lead-hz-02",
  "demo-lead-hz-03",
  "demo-lead-hz-04",
  "demo-lead-hz-05",
  "demo-lead-hz-06",
  "demo-lead-ns-01",
  "demo-lead-ns-02",
  "demo-lead-ns-03",
  "demo-lead-ns-04",
  "demo-lead-ns-05",
  "demo-lead-ns-06",
  "demo-lead-ns-07",
  "demo-lead-ns-08",
  "demo-lead-at-01",
  "demo-lead-at-02",
  "demo-lead-at-03",
  "demo-lead-at-04",
  "demo-lead-at-05",
  "demo-lead-at-06",
] as const;

const FLOOR_EMAILS = [
  "rahul.desai@social72.local",
  "meera.kulkarni@social72.local",
  "amit.sharma@social72.local",
  "pooja.verma@social72.local",
];

async function nextLeadNumber(prisma: PrismaClient) {
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

async function moneyLockedIds(prisma: PrismaClient) {
  const invoices = await prisma.invoice.findMany({
    select: { clientId: true, leadId: true },
  });
  const pos = await prisma.purchaseOrder.findMany({
    select: { clientId: true },
  });
  const expenses = await prisma.expense.findMany({
    select: { clientId: true },
  });
  const clientIds = new Set<string>();
  const leadIds = new Set<string>();
  for (const row of invoices) {
    clientIds.add(row.clientId);
    if (row.leadId) leadIds.add(row.leadId);
  }
  for (const row of pos) {
    if (row.clientId) clientIds.add(row.clientId);
  }
  for (const row of expenses) {
    if (row.clientId) clientIds.add(row.clientId);
  }
  return { clientIds, leadIds };
}

async function hideBulkVolume(prisma: PrismaClient) {
  const locked = await moneyLockedIds(prisma);
  const now = new Date();

  const csvCampaigns = await prisma.campaign.findMany({
    where: { name: { startsWith: "CSV import" } },
    select: { id: true, clientId: true },
  });
  const csvIds = csvCampaigns.map((c) => c.id);

  const protectedLeadIds = [...KEEP_LEAD_IDS, ...locked.leadIds];

  if (csvIds.length) {
    await prisma.lead.updateMany({
      where: {
        campaignId: { in: csvIds },
        deletedAt: null,
        id: { notIn: protectedLeadIds },
      },
      data: { deletedAt: now, isActive: false },
    });
    await prisma.campaign.updateMany({
      where: { id: { in: csvIds } },
      data: { isActive: false },
    });
  }

  await prisma.lead.updateMany({
    where: {
      deletedAt: null,
      id: { notIn: protectedLeadIds },
      campaignId: { notIn: [...KEEP_CAMPAIGN_IDS] },
    },
    data: { deletedAt: now, isActive: false },
  });

  await prisma.lead.updateMany({
    where: {
      deletedAt: null,
      campaignId: { in: [...KEEP_CAMPAIGN_IDS] },
      id: { notIn: protectedLeadIds },
    },
    data: { deletedAt: now, isActive: false },
  });

  const extraClients = await prisma.client.findMany({
    where: { id: { notIn: [...KEEP_CLIENT_IDS] }, isActive: true },
    select: { id: true },
  });
  for (const client of extraClients) {
    if (locked.clientIds.has(client.id)) continue;
    await prisma.client.update({ where: { id: client.id }, data: { isActive: false } });
  }

  await prisma.campaign.updateMany({
    where: { id: { notIn: [...KEEP_CAMPAIGN_IDS] }, isActive: true },
    data: { isActive: false },
  });
}

type DemoLead = {
  id: string;
  firstName: string;
  lastName: string;
  mobile: string;
  status: string;
  score: number;
  temperature: "HOT" | "WARM" | "COLD" | "UNQUALIFIED";
  followHours?: number | null;
  assigned?: boolean;
  paused?: boolean;
  city: string;
  state: string;
};

async function upsertCampaignSpend(
  prisma: PrismaClient,
  campaignId: string,
  lines: Array<{ id: string; spendDate: Date; amount: number; platform: string }>,
) {
  for (const line of lines) {
    await prisma.marketingSpend.upsert({
      where: { id: line.id },
      update: { amount: line.amount, spendDate: line.spendDate, platform: line.platform },
      create: { ...line, campaignId, notes: "Demo media spend" },
    });
  }
  const spendSum = await prisma.marketingSpend.aggregate({
    where: { campaignId },
    _sum: { amount: true },
  });
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { actualSpend: Number(spendSum._sum.amount ?? 0) },
  });
}

async function upsertDemoLead(
  prisma: PrismaClient,
  input: {
    lead: DemoLead;
    clientId: string;
    campaignId: string;
    industryId: string;
    sourceId: string;
    statusId: string;
    ownerId: string | null;
    teamId: string | null;
    adminId: string;
    utmCampaign: string;
    sourcePlatform: string;
  },
) {
  const now = new Date();
  const follow =
    input.lead.followHours == null
      ? null
      : new Date(now.getTime() + input.lead.followHours * 3600_000);
  const existing = await prisma.lead.findUnique({ where: { id: input.lead.id } });
  const payload = {
    statusId: input.statusId,
    assignedUserId: input.lead.assigned === false ? null : input.ownerId,
    assignedTeamId: input.teamId,
    assignedAt: input.lead.assigned === false ? null : now,
    temperature: input.lead.temperature,
    leadScore: input.lead.score,
    expectedValue: 85000,
    probabilityPct: input.lead.score >= 20 ? 40 : 15,
    expectedRevenue: input.lead.score >= 20 ? 34000 : 12750,
    nextFollowupAt: follow,
    nextAction: follow ? "Callback" : input.lead.status === "NEW" ? "First call" : null,
    city: input.lead.city,
    state: input.lead.state,
    country: "India",
    isActive: !input.lead.paused,
    deletedAt: null,
    lastActivityAt: now,
    generatedAt: new Date(now.getTime() - 90 * 60_000),
    sourcePlatform: input.sourcePlatform,
    utmSource: input.sourcePlatform === "meta_ads" ? "facebook" : "google",
    utmMedium: "cpc",
    utmCampaign: input.utmCampaign,
  };

  if (existing) {
    await prisma.lead.update({ where: { id: existing.id }, data: payload });
    return existing.id;
  }

  await prisma.lead.create({
    data: {
      id: input.lead.id,
      ...payload,
      leadNumber: await nextLeadNumber(prisma),
      clientId: input.clientId,
      campaignId: input.campaignId,
      industryId: input.industryId,
      sourceId: input.sourceId,
      createdById: input.adminId,
      firstName: input.lead.firstName,
      lastName: input.lead.lastName,
      fullName: `${input.lead.firstName} ${input.lead.lastName}`,
      mobileE164: input.lead.mobile,
      email: `${input.lead.firstName.toLowerCase()}.${input.lead.lastName.toLowerCase()}@demo.social72.local`,
    },
  });
  return input.lead.id;
}

async function ensureInvoice(
  prisma: PrismaClient,
  id: string,
  clientId: string,
  ownerId: string,
  number: string,
  total: number,
) {
  const existing = await prisma.invoice.findUnique({ where: { id } });
  if (existing) return;
  const clash = await prisma.invoice.findUnique({ where: { number } });
  if (clash) return;
  const gst = Math.round(total * 0.18);
  await prisma.invoice.create({
    data: {
      id,
      number,
      clientId,
      ownerUserId: ownerId,
      kind: "INVOICE",
      status: "SENT",
      issueDate: new Date("2026-09-01"),
      dueDate: new Date("2026-09-15"),
      subtotal: total,
      gstPct: 18,
      total: total + gst,
      paid: Math.round((total + gst) * 0.4),
      notes: "Demo retainer — keep with financial records",
    },
  });
}

export async function shapeDemoFloor(prisma: PrismaClient) {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "nathan.k@example.net";
  const admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!admin) {
    console.log("Demo floor skipped — no super admin");
    return;
  }

  const moneyBefore = {
    invoices: await prisma.invoice.count(),
    pos: await prisma.purchaseOrder.count(),
    spend: await prisma.marketingSpend.count(),
    expenses: await prisma.expense.count(),
  };

  const floor = await prisma.user.findMany({
    where: { email: { in: FLOOR_EMAILS } },
    orderBy: { email: "asc" },
  });
  const team = await prisma.team.upsert({
    where: { id: "seed-team-admissions-floor" },
    update: { name: "Social72 outbound" },
    create: {
      id: "seed-team-admissions-floor",
      name: "Social72 outbound",
      leaderId: floor[0]?.id ?? admin.id,
    },
  });

  const education = await prisma.industry.findUniqueOrThrow({ where: { key: "education" } });
  const realEstate = await prisma.industry.findUnique({ where: { key: "real_estate" } });
  const services = await prisma.industry.findUniqueOrThrow({ where: { key: "services" } });
  const eduPipe = await prisma.pipeline.findFirst({
    where: { industryId: education.id, isDefault: true },
  });
  const rePipe = realEstate
    ? await prisma.pipeline.findFirst({ where: { industryId: realEstate.id, isDefault: true } })
    : null;
  const svcPipe = await prisma.pipeline.findFirst({
    where: { industryId: services.id, isDefault: true },
  });

  const statuses = Object.fromEntries((await prisma.leadStatus.findMany()).map((s) => [s.key, s]));
  const meta = await prisma.leadSource.upsert({
    where: { id: "seed-source-meta" },
    update: { name: "Meta Ads", isActive: true },
    create: { id: "seed-source-meta", name: "Meta Ads", platform: "meta_ads" },
  });
  const google = await prisma.leadSource.upsert({
    where: { id: "seed-source-google" },
    update: { name: "Google Ads", isActive: true },
    create: { id: "seed-source-google", name: "Google Ads", platform: "google_ads" },
  });

  const gm = await prisma.client.upsert({
    where: { id: "seed-client-gm-global" },
    update: {
      name: "GM Global School",
      isActive: true,
      contactName: "Admissions desk",
      contactPhone: "+919800000001",
    },
    create: {
      id: "seed-client-gm-global",
      name: "GM Global School",
      industryId: education.id,
      contactName: "Admissions desk",
      contactEmail: "admissions@gmglobal.example",
      contactPhone: "+919800000001",
    },
  });
  await prisma.campaign.upsert({
    where: { id: "seed-campaign-class-11" },
    update: { name: "Class 11 Intake", isActive: true, clientId: gm.id },
    create: {
      id: "seed-campaign-class-11",
      clientId: gm.id,
      industryId: education.id,
      pipelineId: eduPipe?.id,
      name: "Class 11 Intake",
      campaignType: "lead_gen",
      platform: "meta_ads",
      budget: 250000,
      ownerUserId: admin.id,
    },
  });

  if (realEstate) {
    const horizon = await prisma.client.upsert({
      where: { id: "seed-client-horizon-homes" },
      update: { name: "Horizon Homes", isActive: true, contactName: "Sales desk" },
      create: {
        id: "seed-client-horizon-homes",
        name: "Horizon Homes",
        industryId: realEstate.id,
        contactName: "Sales desk",
        contactEmail: "sales@horizonhomes.example",
        contactPhone: "+919800000010",
      },
    });
    await prisma.campaign.upsert({
      where: { id: "seed-campaign-riverfront" },
      update: { name: "Riverfront Residences", isActive: true, clientId: horizon.id },
      create: {
        id: "seed-campaign-riverfront",
        clientId: horizon.id,
        industryId: realEstate.id,
        pipelineId: rePipe?.id,
        name: "Riverfront Residences",
        campaignType: "lead_gen",
        platform: "google_ads",
        budget: 400000,
        ownerUserId: admin.id,
      },
    });
  }

  const northstar = await prisma.client.upsert({
    where: { id: "seed-client-northstar" },
    update: {
      name: "Northstar Clinics",
      isActive: true,
      contactName: "Dr. Rhea Mehta",
      contactPhone: "+919800000021",
    },
    create: {
      id: "seed-client-northstar",
      name: "Northstar Clinics",
      industryId: services.id,
      contactName: "Dr. Rhea Mehta",
      contactEmail: "rhea@northstarclinics.example",
      contactPhone: "+919800000021",
      gstin: "27AABCN1234P1Z5",
    },
  });
  await prisma.campaign.upsert({
    where: { id: "seed-campaign-northstar-meta" },
    update: { name: "Health leads · Sep", isActive: true, clientId: northstar.id },
    create: {
      id: "seed-campaign-northstar-meta",
      clientId: northstar.id,
      industryId: services.id,
      pipelineId: svcPipe?.id,
      name: "Health leads · Sep",
      campaignType: "lead_gen",
      platform: "meta_ads",
      budget: 180000,
      ownerUserId: admin.id,
    },
  });
  await upsertCampaignSpend(prisma, "seed-campaign-northstar-meta", [
    { id: "seed-spend-ns-1", spendDate: new Date("2026-09-01"), amount: 42000, platform: "meta_ads" },
    { id: "seed-spend-ns-2", spendDate: new Date("2026-09-15"), amount: 38000, platform: "meta_ads" },
  ]);

  const atelier = await prisma.client.upsert({
    where: { id: "seed-client-atelier" },
    update: {
      name: "Atelier Interiors",
      isActive: true,
      contactName: "Kabir Anand",
      contactPhone: "+919800000031",
    },
    create: {
      id: "seed-client-atelier",
      name: "Atelier Interiors",
      industryId: services.id,
      contactName: "Kabir Anand",
      contactEmail: "kabir@atelierinteriors.example",
      contactPhone: "+919800000031",
      gstin: "27AABCA9876Q1Z2",
    },
  });
  await prisma.campaign.upsert({
    where: { id: "seed-campaign-atelier-search" },
    update: { name: "Home studio search", isActive: true, clientId: atelier.id },
    create: {
      id: "seed-campaign-atelier-search",
      clientId: atelier.id,
      industryId: services.id,
      pipelineId: svcPipe?.id,
      name: "Home studio search",
      campaignType: "lead_gen",
      platform: "google_ads",
      budget: 120000,
      ownerUserId: admin.id,
    },
  });
  await upsertCampaignSpend(prisma, "seed-campaign-atelier-search", [
    { id: "seed-spend-at-1", spendDate: new Date("2026-09-04"), amount: 28000, platform: "google_ads" },
  ]);

  await ensureInvoice(prisma, "demo-inv-northstar-1", northstar.id, admin.id, "INV-S72-NS-001", 150000);
  await ensureInvoice(prisma, "demo-inv-atelier-1", atelier.id, admin.id, "INV-S72-AT-001", 95000);

  const owner = (i: number) => floor[i % Math.max(floor.length, 1)]?.id ?? admin.id;

  const packs: Array<{
    clientId: string;
    campaignId: string;
    industryId: string;
    sourceId: string;
    utm: string;
    platform: string;
    leads: DemoLead[];
  }> = [
    {
      clientId: gm.id,
      campaignId: "seed-campaign-class-11",
      industryId: education.id,
      sourceId: meta.id,
      utm: "class-11-intake",
      platform: "meta_ads",
      leads: [
        { id: "demo-lead-gm-01", firstName: "Rohan", lastName: "Mehta", mobile: "+919876510001", status: "NEW", score: 0, temperature: "WARM", assigned: false, city: "Mumbai", state: "Maharashtra" },
        { id: "demo-lead-gm-02", firstName: "Priya", lastName: "Nair", mobile: "+919876510002", status: "FOLLOW_UP", score: 10, temperature: "WARM", followHours: 4, city: "Pune", state: "Maharashtra" },
        { id: "demo-lead-gm-03", firstName: "Vikram", lastName: "Singh", mobile: "+919876510003", status: "INTERESTED", score: 22, temperature: "HOT", followHours: 20, city: "Jaipur", state: "Rajasthan" },
        { id: "demo-lead-gm-04", firstName: "Sneha", lastName: "Iyer", mobile: "+919876510004", status: "WRONG_NUMBER", score: -30, temperature: "UNQUALIFIED", city: "Chennai", state: "Tamil Nadu" },
      ],
    },
    {
      clientId: northstar.id,
      campaignId: "seed-campaign-northstar-meta",
      industryId: services.id,
      sourceId: meta.id,
      utm: "health-leads-sep",
      platform: "meta_ads",
      leads: [
        { id: "demo-lead-ns-01", firstName: "Arjun", lastName: "Patel", mobile: "+919820010001", status: "INTERESTED", score: 25, temperature: "HOT", followHours: 2, city: "Ahmedabad", state: "Gujarat" },
        { id: "demo-lead-ns-02", firstName: "Kavya", lastName: "Reddy", mobile: "+919820010002", status: "NEW", score: 0, temperature: "WARM", assigned: false, city: "Hyderabad", state: "Telangana" },
        { id: "demo-lead-ns-03", firstName: "Imran", lastName: "Khan", mobile: "+919820010003", status: "CALL_ATTEMPTED", score: 0, temperature: "WARM", city: "Lucknow", state: "Uttar Pradesh" },
        { id: "demo-lead-ns-04", firstName: "Ananya", lastName: "Sharma", mobile: "+919820010004", status: "QUALIFIED", score: 35, temperature: "HOT", followHours: 8, city: "Delhi", state: "Delhi" },
        { id: "demo-lead-ns-05", firstName: "Neha", lastName: "Joshi", mobile: "+919820010005", status: "DO_NOT_CALL", score: -25, temperature: "UNQUALIFIED", city: "Bengaluru", state: "Karnataka" },
        { id: "demo-lead-ns-06", firstName: "Farhan", lastName: "Ali", mobile: "+919820010006", status: "UNWANTED", score: -25, temperature: "UNQUALIFIED", city: "Kolkata", state: "West Bengal" },
        { id: "demo-lead-ns-07", firstName: "Aditi", lastName: "Kulkarni", mobile: "+919820010007", status: "NURTURE", score: 8, temperature: "COLD", followHours: 72, city: "Pune", state: "Maharashtra" },
        { id: "demo-lead-ns-08", firstName: "Sanjay", lastName: "Gupta", mobile: "+919820010008", status: "CONNECTED", score: 10, temperature: "WARM", followHours: -6, city: "Mumbai", state: "Maharashtra", paused: true },
      ],
    },
    {
      clientId: atelier.id,
      campaignId: "seed-campaign-atelier-search",
      industryId: services.id,
      sourceId: google.id,
      utm: "home-studio-search",
      platform: "google_ads",
      leads: [
        { id: "demo-lead-at-01", firstName: "Ritika", lastName: "Malhotra", mobile: "+919830010001", status: "NEW", score: 0, temperature: "WARM", city: "Mumbai", state: "Maharashtra" },
        { id: "demo-lead-at-02", firstName: "Dev", lastName: "Choudhary", mobile: "+919830010002", status: "FOLLOW_UP", score: 12, temperature: "WARM", followHours: -2, city: "Jaipur", state: "Rajasthan" },
        { id: "demo-lead-at-03", firstName: "Ishita", lastName: "Bansal", mobile: "+919830010003", status: "PROPOSAL_SENT", score: 28, temperature: "HOT", followHours: 12, city: "Delhi", state: "Delhi" },
        { id: "demo-lead-at-04", firstName: "Kunal", lastName: "Jain", mobile: "+919830010004", status: "NOT_INTERESTED", score: -20, temperature: "COLD", city: "Ahmedabad", state: "Gujarat" },
        { id: "demo-lead-at-05", firstName: "Ayesha", lastName: "Qureshi", mobile: "+919830010005", status: "WRONG_NUMBER", score: -30, temperature: "UNQUALIFIED", city: "Hyderabad", state: "Telangana" },
        { id: "demo-lead-at-06", firstName: "Nikhil", lastName: "Rao", mobile: "+919830010006", status: "MEETING", score: 18, temperature: "HOT", followHours: 30, city: "Bengaluru", state: "Karnataka" },
      ],
    },
  ];

  if (realEstate) {
    const horizon = await prisma.client.findUniqueOrThrow({ where: { id: "seed-client-horizon-homes" } });
    packs.push({
      clientId: horizon.id,
      campaignId: "seed-campaign-riverfront",
      industryId: realEstate.id,
      sourceId: google.id,
      utm: "riverfront-residences",
      platform: "google_ads",
      leads: [
        { id: "demo-lead-hz-01", firstName: "Aarav", lastName: "Kapoor", mobile: "+919840010001", status: "NEW", score: 0, temperature: "WARM", assigned: false, city: "Pune", state: "Maharashtra" },
        { id: "demo-lead-hz-02", firstName: "Nisha", lastName: "Bansal", mobile: "+919840010002", status: "SITE_VISIT", score: 20, temperature: "HOT", followHours: 10, city: "Mumbai", state: "Maharashtra" },
        { id: "demo-lead-hz-03", firstName: "Kabir", lastName: "Malhotra", mobile: "+919840010003", status: "QUALIFIED", score: 15, temperature: "WARM", followHours: 5, city: "Pune", state: "Maharashtra" },
        { id: "demo-lead-hz-04", firstName: "Riya", lastName: "Khanna", mobile: "+919840010004", status: "FOLLOW_UP", score: 8, temperature: "WARM", followHours: -10, city: "Mumbai", state: "Maharashtra" },
        { id: "demo-lead-hz-05", firstName: "Sameer", lastName: "Joshi", mobile: "+919840010005", status: "DO_NOT_CALL", score: -25, temperature: "UNQUALIFIED", city: "Pune", state: "Maharashtra" },
        { id: "demo-lead-hz-06", firstName: "Pooja", lastName: "Ahuja", mobile: "+919840010006", status: "CLOSED_WON", score: 40, temperature: "HOT", city: "Mumbai", state: "Maharashtra" },
      ],
    });
  }

  let i = 0;
  for (const pack of packs) {
    for (const lead of pack.leads) {
      const status = statuses[lead.status];
      if (!status) continue;
      await upsertDemoLead(prisma, {
        lead,
        clientId: pack.clientId,
        campaignId: pack.campaignId,
        industryId: pack.industryId,
        sourceId: pack.sourceId,
        statusId: status.id,
        ownerId: owner(i),
        teamId: team.id,
        adminId: admin.id,
        utmCampaign: pack.utm,
        sourcePlatform: pack.platform,
      });
      i += 1;
    }
  }

  await hideBulkVolume(prisma);

  const moneyAfter = {
    invoices: await prisma.invoice.count(),
    pos: await prisma.purchaseOrder.count(),
    spend: await prisma.marketingSpend.count(),
    expenses: await prisma.expense.count(),
  };
  const liveLeads = await prisma.lead.count({ where: { deletedAt: null, isActive: true } });
  const liveClients = await prisma.client.count({ where: { isActive: true } });
  const liveCampaigns = await prisma.campaign.count({ where: { isActive: true } });

  console.log(
    `Demo floor: ${liveClients} clients, ${liveCampaigns} campaigns, ${liveLeads} live leads. Money invoices ${moneyBefore.invoices}→${moneyAfter.invoices}, POs ${moneyBefore.pos}→${moneyAfter.pos}, spend lines ${moneyBefore.spend}→${moneyAfter.spend}, expenses ${moneyBefore.expenses}→${moneyAfter.expenses}.`,
  );
}

