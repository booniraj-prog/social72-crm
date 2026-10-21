import type { PrismaClient } from "@prisma/client";

const PEOPLE = [
  ["Aarav", "Kapoor"],
  ["Mehul", "Shah"],
  ["Nisha", "Bansal"],
  ["Kabir", "Malhotra"],
  ["Riya", "Khanna"],
  ["Sameer", "Joshi"],
  ["Pooja", "Ahuja"],
  ["Vivek", "Nair"],
  ["Anjali", "Mehra"],
  ["Rohit", "Bajaj"],
  ["Snehal", "Patil"],
  ["Karan", "Sethi"],
  ["Divya", "Rao"],
  ["Harsh", "Goyal"],
  ["Isha", "Tandon"],
  ["Nikhil", "Verma"],
  ["Tara", "Lal"],
  ["Yusuf", "Khan"],
  ["Mira", "Das"],
  ["Aditya", "Bhatt"],
];

const RE_CYCLE = [
  "NEW",
  "CONNECTED",
  "QUALIFIED",
  "INTERESTED",
  "PROPERTY_SHARED",
  "SITE_VISIT",
  "SITE_VISIT_COMPLETED",
  "NEGOTIATION",
  "BOOKING",
  "DOCUMENTATION",
  "REGISTRATION",
  "CLOSED_WON",
  "CLOSED_LOST",
  "FOLLOW_UP",
  "NURTURE",
  "CALL_ATTEMPTED",
  "NOT_INTERESTED",
  "SITE_VISIT",
  "BOOKING",
  "PROPERTY_SHARED",
] as const;

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

export async function seedRealEstate(prisma: PrismaClient) {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "nathan.k@example.net";
  const admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!admin) return;

  const floor = await prisma.user.findMany({
    where: {
      email: {
        in: [
          "rahul.desai@social72.local",
          "meera.kulkarni@social72.local",
          "amit.sharma@social72.local",
          "pooja.verma@social72.local",
        ],
      },
    },
    orderBy: { email: "asc" },
  });
  if (floor.length === 0) return;

  const team = await prisma.team.findUnique({ where: { id: "seed-team-admissions-floor" } });
  const industry = await prisma.industry.findUniqueOrThrow({ where: { key: "real_estate" } });
  const pipeline = await prisma.pipeline.findFirst({
    where: { industryId: industry.id, isDefault: true },
  });

  const client = await prisma.client.upsert({
    where: { id: "seed-client-horizon-homes" },
    update: { name: "Horizon Homes", isActive: true },
    create: {
      id: "seed-client-horizon-homes",
      name: "Horizon Homes",
      industryId: industry.id,
      contactName: "Sales desk",
      contactEmail: "sales@horizonhomes.example",
      contactPhone: "+919800000010",
    },
  });

  const campaign = await prisma.campaign.upsert({
    where: { id: "seed-campaign-riverfront" },
    update: { name: "Riverfront Residences", isActive: true },
    create: {
      id: "seed-campaign-riverfront",
      clientId: client.id,
      industryId: industry.id,
      pipelineId: pipeline?.id,
      name: "Riverfront Residences",
      campaignType: "lead_gen",
      platform: "google_ads",
      budget: 400000,
      actualSpend: 162000,
      ownerUserId: admin.id,
    },
  });
  const spendLines = [
    { id: "seed-spend-river-1", spendDate: new Date("2026-07-05"), amount: 54000, platform: "google_ads" },
    { id: "seed-spend-river-2", spendDate: new Date("2026-08-12"), amount: 108000, platform: "google_ads" },
  ];
  for (const line of spendLines) {
    await prisma.marketingSpend.upsert({
      where: { id: line.id },
      update: { amount: line.amount, spendDate: line.spendDate, platform: line.platform },
      create: { ...line, campaignId: campaign.id, notes: "Seeded media spend" },
    });
  }
  const spendSum = await prisma.marketingSpend.aggregate({
    where: { campaignId: campaign.id },
    _sum: { amount: true },
  });
  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { actualSpend: Number(spendSum._sum.amount ?? 0) },
  });

  const riverfront = await prisma.project.upsert({
    where: { id: "seed-project-riverfront" },
    update: { name: "Riverfront Residences", location: "Pune", isActive: true },
    create: {
      id: "seed-project-riverfront",
      clientId: client.id,
      name: "Riverfront Residences",
      location: "Pune",
    },
  });
  const oakwood = await prisma.project.upsert({
    where: { id: "seed-project-oakwood" },
    update: { name: "Oakwood Heights", location: "Mumbai", isActive: true },
    create: {
      id: "seed-project-oakwood",
      clientId: client.id,
      name: "Oakwood Heights",
      location: "Mumbai",
    },
  });

  const properties = [
    {
      id: "seed-prop-2bhk-a",
      projectId: riverfront.id,
      name: "2 BHK Tower A",
      propertyType: "Apartment",
      configuration: "2BHK",
      location: "Wakad, Pune",
      value: 7800000,
    },
    {
      id: "seed-prop-3bhk-b",
      projectId: riverfront.id,
      name: "3 BHK Tower B",
      propertyType: "Apartment",
      configuration: "3BHK",
      location: "Wakad, Pune",
      value: 11200000,
    },
    {
      id: "seed-prop-plot-12",
      projectId: oakwood.id,
      name: "Plot 12",
      propertyType: "Plot",
      configuration: "Plot",
      location: "Andheri, Mumbai",
      value: 15000000,
    },
    {
      id: "seed-prop-villa-4",
      projectId: oakwood.id,
      name: "Villa 4",
      propertyType: "Villa",
      configuration: "4BHK",
      location: "Andheri, Mumbai",
      value: 24500000,
    },
  ];
  for (const property of properties) {
    await prisma.property.upsert({
      where: { id: property.id },
      update: {
        name: property.name,
        propertyType: property.propertyType,
        configuration: property.configuration,
        location: property.location,
        value: property.value,
      },
      create: { ...property, clientId: client.id },
    });
  }

  const google = await prisma.leadSource.upsert({
    where: { id: "seed-source-google" },
    update: { name: "Google Ads", isActive: true },
    create: { id: "seed-source-google", name: "Google Ads", platform: "google_ads" },
  });

  const statuses = Object.fromEntries((await prisma.leadStatus.findMany()).map((s) => [s.key, s]));
  const now = new Date();
  let created = 0;

  for (let i = 0; i < 2; i++) {
    const [firstName, lastName] = PEOPLE[i];
    const statusKey = RE_CYCLE[i % RE_CYCLE.length];
    const status = statuses[statusKey];
    if (!status) continue;
    const owner = floor[i % floor.length];
    const property = properties[i % properties.length];
    const project = property.projectId === riverfront.id ? riverfront : oakwood;
    const mobile = `+91987652${String(i + 1).padStart(4, "0")}`;
    const expectedValue = Number(property.value);
    const probabilityPct =
      statusKey === "CLOSED_WON" ? 100 : statusKey === "CLOSED_LOST" ? 0 : 20 + (i * 4) % 70;
    const visitPlanned = ["SITE_VISIT", "SITE_VISIT_COMPLETED", "NEGOTIATION", "BOOKING", "DOCUMENTATION", "REGISTRATION", "CLOSED_WON"].includes(statusKey);
    const visitDone = ["SITE_VISIT_COMPLETED", "NEGOTIATION", "BOOKING", "DOCUMENTATION", "REGISTRATION", "CLOSED_WON"].includes(statusKey);
    const visitDate = visitPlanned
      ? new Date(now.getTime() + (visitDone ? -2 : 2) * 86400_000)
      : null;

    const existingLead = await prisma.lead.findFirst({
      where: { clientId: client.id, mobileE164: mobile, deletedAt: null },
    });

    const payload = {
      statusId: status.id,
      assignedUserId: owner.id,
      assignedTeamId: team?.id,
      assignedAt: now,
      temperature: i % 4 === 0 ? "HOT" : i % 4 === 1 ? "WARM" : "COLD",
      expectedValue,
      probabilityPct,
      expectedRevenue: (expectedValue * probabilityPct) / 100,
      nextFollowupAt: status.isFinal ? null : new Date(now.getTime() + ((i % 4) - 1) * 86400_000),
      nextAction: status.isFinal ? null : visitPlanned ? "Site visit follow-up" : "Share inventory",
      city: project.location,
      state: project.location === "Pune" ? "Maharashtra" : "Maharashtra",
      converted: statusKey === "CLOSED_WON",
      actualRevenue: statusKey === "CLOSED_WON" ? expectedValue : 0,
      lastActivityAt: now,
    } as const;

    let leadId: string;
    if (existingLead) {
      await prisma.lead.update({ where: { id: existingLead.id }, data: payload });
      leadId = existingLead.id;
    } else {
      const lead = await prisma.lead.create({
        data: {
          ...payload,
          leadNumber: await nextLeadNumber(prisma),
          clientId: client.id,
          campaignId: campaign.id,
          industryId: industry.id,
          sourceId: google.id,
          createdById: admin.id,
          firstName,
          lastName,
          fullName: `${firstName} ${lastName}`,
          mobileE164: mobile,
          email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}.re${i}@example.com`,
          country: "India",
          sourcePlatform: "google_ads",
          utmSource: "google",
          utmMedium: "cpc",
          utmCampaign: "riverfront-residences",
          generatedAt: now,
        },
      });
      leadId = lead.id;
      created += 1;
    }

    const details = {
      propertyId: property.id,
      projectId: project.id,
      location: property.location,
      propertyType: property.propertyType,
      configuration: property.configuration,
      budget: expectedValue,
      preferredLocation: property.location,
      purpose: i % 3 === 0 ? "Investment" : "Buy",
      useType: i % 3 === 0 ? "Investment" : "End use",
      possessionRequirement: i % 2 === 0 ? "Ready" : "12 months",
      loanRequired: i % 2 === 0,
      siteVisitDate: visitDate,
      siteVisitStatus: visitDone ? "Completed" : visitPlanned ? "Planned" : null,
      negotiationStatus: ["NEGOTIATION", "BOOKING", "DOCUMENTATION", "REGISTRATION", "CLOSED_WON"].includes(statusKey)
        ? "Open"
        : null,
      bookingAmount: ["BOOKING", "DOCUMENTATION", "REGISTRATION", "CLOSED_WON"].includes(statusKey)
        ? Math.round(expectedValue * 0.1)
        : null,
      expectedRegistrationDate: ["REGISTRATION", "CLOSED_WON"].includes(statusKey)
        ? new Date(now.getTime() + 20 * 86400_000)
        : null,
      registrationStatus: statusKey === "CLOSED_WON" ? "Registered" : statusKey === "REGISTRATION" ? "In progress" : "Not started",
      propertyValue: expectedValue,
    };

    await prisma.realEstateDetails.upsert({
      where: { leadId },
      update: details,
      create: { leadId, ...details },
    });

    await prisma.siteVisit.deleteMany({ where: { leadId } });
    if (visitDate) {
      await prisma.siteVisit.create({
        data: {
          leadId,
          propertyId: property.id,
          scheduledAt: visitDate,
          completedAt: visitDone ? visitDate : null,
          outcome: visitDone ? "Visited site — sample" : null,
        },
      });
    }
  }

  console.log(`Real estate sample ready (${created} created). Client: Horizon Homes.`);
}
