import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { seedBpoAndLeads } from "./sample-floor";
import { shapeDemoFloor } from "./shape-demo-floor";

const prisma = new PrismaClient();

const PERMISSIONS = [
  { key: "user.read", description: "View users" },
  { key: "user.write", description: "Create and update users" },
  { key: "client.read", description: "View clients" },
  { key: "client.write", description: "Create and update clients" },
  { key: "campaign.read", description: "View campaigns" },
  { key: "campaign.write", description: "Create and update campaigns" },
  { key: "lead.read", description: "View leads" },
  { key: "lead.write", description: "Update leads" },
  { key: "lead.assign", description: "Assign leads" },
  { key: "report.read", description: "View reports" },
  { key: "report.export", description: "Export reports" },
  { key: "settings.write", description: "Manage system settings" },
] as const;

const ROLE_PERMISSIONS: Record<string, string[] | "*"> = {
  super_admin: "*",
  crm_manager: [
    "user.read",
    "client.read",
    "client.write",
    "campaign.read",
    "campaign.write",
    "lead.read",
    "lead.write",
    "lead.assign",
    "report.read",
    "report.export",
  ],
  bpo_leader: [
    "lead.read",
    "lead.write",
    "lead.assign",
    "report.read",
  ],
  bpo_executive: ["lead.read", "lead.write"],
  marketing_manager: [
    "client.read",
    "client.write",
    "campaign.read",
    "campaign.write",
    "lead.read",
    "report.read",
    "report.export",
  ],
  client: ["campaign.read", "lead.read", "report.read"],
  sales_manager: [
    "client.read",
    "campaign.read",
    "lead.read",
    "lead.write",
    "lead.assign",
    "report.read",
    "report.export",
  ],
  project_manager: ["lead.read", "client.read", "report.read"],
  accounts: ["client.read", "report.read", "report.export"],
  hr_admin: ["user.read", "client.read", "report.read"],
  employee: ["lead.read"],
};

const STATUSES: Array<{
  key: string;
  name: string;
  color: string;
  isFinal: boolean;
  sortOrder: number;
  description: string;
}> = [
  { key: "NEW", name: "New", color: "#64748b", isFinal: false, sortOrder: 10, description: "Unworked inbound lead" },
  { key: "ASSIGNED", name: "Assigned", color: "#2563eb", isFinal: false, sortOrder: 20, description: "Has an owner" },
  { key: "CALL_NOT_ATTEMPTED", name: "Call not attempted", color: "#7c3aed", isFinal: false, sortOrder: 30, description: "Assigned but not dialled" },
  { key: "CALL_ATTEMPTED", name: "Call attempted", color: "#0891b2", isFinal: false, sortOrder: 40, description: "Dialled, not yet connected" },
  { key: "CONNECTED", name: "Connected", color: "#0f766e", isFinal: false, sortOrder: 50, description: "Spoke with the lead" },
  { key: "PARENT_CONNECTED", name: "Parent connected", color: "#0f766e", isFinal: false, sortOrder: 55, description: "Spoke with a parent or guardian" },
  { key: "NOT_INTERESTED", name: "Not interested", color: "#b45309", isFinal: false, sortOrder: 60, description: "Declined the offer" },
  { key: "INTERESTED", name: "Interested", color: "#15803d", isFinal: false, sortOrder: 70, description: "Expressed interest" },
  { key: "QUALIFIED", name: "Qualified", color: "#166534", isFinal: false, sortOrder: 80, description: "Meets qualification criteria" },
  { key: "PROPERTY_SHARED", name: "Property shared", color: "#1d4ed8", isFinal: false, sortOrder: 85, description: "Inventory sent to the lead" },
  { key: "FOLLOW_UP", name: "Follow-up", color: "#c2410c", isFinal: false, sortOrder: 90, description: "Callback scheduled" },
  { key: "SITE_VISIT", name: "Site visit planned", color: "#1d4ed8", isFinal: false, sortOrder: 100, description: "Property site visit scheduled" },
  { key: "SITE_VISIT_COMPLETED", name: "Site visit completed", color: "#0f766e", isFinal: false, sortOrder: 102, description: "Buyer visited the site" },
  { key: "COUNSELLING", name: "Counselling", color: "#4338ca", isFinal: false, sortOrder: 105, description: "Admission counselling" },
  { key: "CAMPUS_VISIT", name: "Campus visit", color: "#1d4ed8", isFinal: false, sortOrder: 110, description: "Campus visit" },
  { key: "APPLICATION", name: "Application", color: "#0f766e", isFinal: false, sortOrder: 115, description: "Application in progress" },
  { key: "MEETING", name: "Meeting", color: "#4338ca", isFinal: false, sortOrder: 120, description: "In-person or virtual meeting" },
  { key: "NEGOTIATION", name: "Negotiation", color: "#a16207", isFinal: false, sortOrder: 130, description: "Commercial discussion" },
  { key: "BOOKING", name: "Booking", color: "#15803d", isFinal: false, sortOrder: 132, description: "Token / booking taken" },
  { key: "DOCUMENTATION", name: "Documentation", color: "#0f766e", isFinal: false, sortOrder: 140, description: "Paperwork in progress" },
  { key: "REGISTRATION", name: "Registration", color: "#0f766e", isFinal: false, sortOrder: 142, description: "Registration in progress" },
  { key: "FEE_DISCUSSION", name: "Fee discussion", color: "#a16207", isFinal: false, sortOrder: 145, description: "Fee / scholarship discussion" },
  { key: "PAYMENT_PENDING", name: "Payment pending", color: "#b45309", isFinal: false, sortOrder: 150, description: "Awaiting payment" },
  { key: "ADMISSION_CONFIRMED", name: "Admission confirmed", color: "#15803d", isFinal: false, sortOrder: 155, description: "Seat confirmed, pending closure" },
  { key: "CLOSED_WON", name: "Closed won", color: "#15803d", isFinal: true, sortOrder: 160, description: "Converted" },
  { key: "CLOSED_LOST", name: "Closed lost", color: "#b91c1c", isFinal: true, sortOrder: 170, description: "Lost" },
  { key: "DUPLICATE", name: "Duplicate", color: "#57534d", isFinal: true, sortOrder: 180, description: "Merged or duplicate" },
  { key: "INVALID", name: "Invalid", color: "#57534d", isFinal: true, sortOrder: 190, description: "Bad data" },
  { key: "DO_NOT_CALL", name: "Do not call", color: "#7f1d1d", isFinal: true, sortOrder: 200, description: "DNC / opted out" },
  { key: "WRONG_NUMBER", name: "Wrong number", color: "#b91c1c", isFinal: true, sortOrder: 191, description: "Number belongs to someone else or is incorrect" },
  { key: "UNWANTED", name: "Unwanted", color: "#7c2d12", isFinal: true, sortOrder: 201, description: "Do not pursue — junk or out of market" },
  { key: "NURTURE", name: "Nurture", color: "#6d28d9", isFinal: false, sortOrder: 210, description: "Long-term nurture" },
  { key: "REQUIREMENT", name: "Requirement", color: "#1d4ed8", isFinal: false, sortOrder: 220, description: "Service requirement gathering" },
  { key: "PROPOSAL_SENT", name: "Proposal sent", color: "#4338ca", isFinal: false, sortOrder: 230, description: "Proposal / quotation shared" },
  { key: "IN_DELIVERY", name: "In delivery", color: "#0f766e", isFinal: false, sortOrder: 240, description: "Won job in delivery" },
  { key: "PROJECT_STARTED", name: "Project started", color: "#0f766e", isFinal: false, sortOrder: 250, description: "Won and project kicked off" },
  { key: "NO_RESPONSE", name: "No response", color: "#57534d", isFinal: false, sortOrder: 260, description: "Unreachable / no response" },
  { key: "NOT_AVAILABLE", name: "Not available", color: "#b45309", isFinal: false, sortOrder: 261, description: "Busy, switched off, or asked to try later" },
  { key: "FUTURE_REQUIREMENT", name: "Future requirement", color: "#6d28d9", isFinal: false, sortOrder: 270, description: "Nurture for later" },
];

async function main() {
  const permissions = await Promise.all(
    PERMISSIONS.map((p) =>
      prisma.permission.upsert({
        where: { key: p.key },
        update: { description: p.description },
        create: p,
      }),
    ),
  );
  const permissionByKey = Object.fromEntries(permissions.map((p) => [p.key, p]));

  const roles = [
    { key: "super_admin", name: "Super Admin", description: "Full system access" },
    { key: "crm_manager", name: "Business / CRM Manager", description: "Campaign and BPO oversight" },
    { key: "bpo_leader", name: "BPO Team Leader", description: "Team assignment and KPIs" },
    { key: "bpo_executive", name: "BPO Executive", description: "Assigned leads only" },
    { key: "marketing_manager", name: "Digital Marketing Manager", description: "Campaigns and import" },
    { key: "client", name: "Client", description: "Future portal — own client data only" },
    { key: "sales_manager", name: "Sales Manager", description: "Sales and conversion" },
    { key: "project_manager", name: "Project Manager", description: "Delivery projects and tasks" },
    { key: "accounts", name: "Accounts", description: "Invoices, purchases, expenses" },
    { key: "hr_admin", name: "HR / Admin", description: "People, licenses, expenses" },
    { key: "employee", name: "Employee", description: "Own tasks and expenses" },
  ];

  for (const role of roles) {
    const saved = await prisma.role.upsert({
      where: { key: role.key },
      update: { name: role.name, description: role.description },
      create: role,
    });
    const keys = ROLE_PERMISSIONS[role.key];
    const selected = keys === "*" ? permissions : keys.map((k) => permissionByKey[k]);
    await prisma.rolePermission.deleteMany({ where: { roleId: saved.id } });
    await prisma.rolePermission.createMany({
      data: selected.map((p) => ({ roleId: saved.id, permissionId: p.id })),
    });
  }

  const education = await prisma.industry.upsert({
    where: { key: "education" },
    update: { name: "Education Admissions" },
    create: { key: "education", name: "Education Admissions" },
  });
  const realEstate = await prisma.industry.upsert({
    where: { key: "real_estate" },
    update: { name: "Real Estate" },
    create: { key: "real_estate", name: "Real Estate" },
  });
  const services = await prisma.industry.upsert({
    where: { key: "services" },
    update: { name: "Services" },
    create: { key: "services", name: "Services" },
  });

  const { ensureIndustries } = await import("../src/modules/clients/service");
  await ensureIndustries();

  await prisma.pipeline.upsert({
    where: { id: "seed-pipeline-education" },
    update: { name: "Education admissions", isDefault: true },
    create: {
      id: "seed-pipeline-education",
      industryId: education.id,
      name: "Education admissions",
      isDefault: true,
    },
  });
  await prisma.pipeline.upsert({
    where: { id: "seed-pipeline-real-estate" },
    update: { name: "Real estate sales", isDefault: true },
    create: {
      id: "seed-pipeline-real-estate",
      industryId: realEstate.id,
      name: "Real estate sales",
      isDefault: true,
    },
  });
  await prisma.pipeline.upsert({
    where: { id: "seed-pipeline-services" },
    update: { name: "Service delivery", isDefault: true, industryId: services.id },
    create: {
      id: "seed-pipeline-services",
      industryId: services.id,
      name: "Service delivery",
      isDefault: true,
    },
  });

  for (const status of STATUSES) {
    await prisma.leadStatus.upsert({
      where: { key: status.key },
      update: {
        name: status.name,
        color: status.color,
        isFinal: status.isFinal,
        sortOrder: status.sortOrder,
        description: status.description,
      },
      create: status,
    });
  }

  const educationStages = [
    { name: "Lead", key: "NEW", sortOrder: 10 },
    { name: "Contacted", key: "CONNECTED", sortOrder: 20 },
    { name: "Parent connected", key: "PARENT_CONNECTED", sortOrder: 30 },
    { name: "Qualified", key: "QUALIFIED", sortOrder: 40 },
    { name: "Interested", key: "INTERESTED", sortOrder: 50 },
    { name: "Counselling", key: "COUNSELLING", sortOrder: 60 },
    { name: "Campus visit", key: "CAMPUS_VISIT", sortOrder: 70 },
    { name: "Application", key: "APPLICATION", sortOrder: 80 },
    { name: "Documentation", key: "DOCUMENTATION", sortOrder: 90 },
    { name: "Fee discussion", key: "FEE_DISCUSSION", sortOrder: 100 },
    { name: "Payment", key: "PAYMENT_PENDING", sortOrder: 110 },
    { name: "Admission confirmed", key: "ADMISSION_CONFIRMED", sortOrder: 120 },
    { name: "Closed won", key: "CLOSED_WON", sortOrder: 130 },
  ];
  await prisma.pipelineStage.deleteMany({ where: { pipelineId: "seed-pipeline-education" } });
  for (const stage of educationStages) {
    const status = await prisma.leadStatus.findUnique({ where: { key: stage.key } });
    if (!status) continue;
    await prisma.pipelineStage.create({
      data: {
        pipelineId: "seed-pipeline-education",
        statusId: status.id,
        name: stage.name,
        sortOrder: stage.sortOrder,
      },
    });
  }

  const realEstateStages = [
    { name: "Lead", key: "NEW", sortOrder: 10 },
    { name: "Contacted", key: "CONNECTED", sortOrder: 20 },
    { name: "Qualified", key: "QUALIFIED", sortOrder: 30 },
    { name: "Interested", key: "INTERESTED", sortOrder: 40 },
    { name: "Property shared", key: "PROPERTY_SHARED", sortOrder: 50 },
    { name: "Site visit planned", key: "SITE_VISIT", sortOrder: 60 },
    { name: "Site visit completed", key: "SITE_VISIT_COMPLETED", sortOrder: 70 },
    { name: "Negotiation", key: "NEGOTIATION", sortOrder: 80 },
    { name: "Booking", key: "BOOKING", sortOrder: 90 },
    { name: "Documentation", key: "DOCUMENTATION", sortOrder: 100 },
    { name: "Registration", key: "REGISTRATION", sortOrder: 110 },
    { name: "Closed won", key: "CLOSED_WON", sortOrder: 120 },
    { name: "Closed lost", key: "CLOSED_LOST", sortOrder: 130 },
  ];
  await prisma.pipelineStage.deleteMany({ where: { pipelineId: "seed-pipeline-real-estate" } });
  for (const stage of realEstateStages) {
    const status = await prisma.leadStatus.findUnique({ where: { key: stage.key } });
    if (!status) continue;
    await prisma.pipelineStage.create({
      data: {
        pipelineId: "seed-pipeline-real-estate",
        statusId: status.id,
        name: stage.name,
        sortOrder: stage.sortOrder,
      },
    });
  }

  const serviceStages = [
    { name: "Lead", key: "NEW", sortOrder: 10 },
    { name: "Requirement", key: "REQUIREMENT", sortOrder: 20 },
    { name: "Proposal", key: "PROPOSAL_SENT", sortOrder: 30 },
    { name: "Negotiation", key: "NEGOTIATION", sortOrder: 40 },
    { name: "Won", key: "CLOSED_WON", sortOrder: 50 },
    { name: "Delivery", key: "IN_DELIVERY", sortOrder: 60 },
    { name: "Payment", key: "PAYMENT_PENDING", sortOrder: 70 },
  ];
  await prisma.pipelineStage.deleteMany({ where: { pipelineId: "seed-pipeline-services" } });
  for (const stage of serviceStages) {
    const status = await prisma.leadStatus.findUnique({ where: { key: stage.key } });
    if (!status) continue;
    await prisma.pipelineStage.create({
      data: {
        pipelineId: "seed-pipeline-services",
        statusId: status.id,
        name: stage.name,
        sortOrder: stage.sortOrder,
      },
    });
  }

  const dispositions = [
    "CONNECTED",
    "NOT_ANSWERED",
    "BUSY",
    "SWITCHED_OFF",
    "INVALID_NUMBER",
    "CALL_BACK",
    "INTERESTED",
    "NOT_INTERESTED",
    "WRONG_NUMBER",
    "LANGUAGE_ISSUE",
    "BUDGET_ISSUE",
    "COMPETITOR",
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
  ];
  for (const [i, key] of dispositions.entries()) {
    await prisma.disposition.upsert({
      where: { key },
      update: { name: key.replaceAll("_", " "), sortOrder: (i + 1) * 10 },
      create: { key, name: key.replaceAll("_", " "), sortOrder: (i + 1) * 10 },
    });
  }

  const sources = [
    ["Website", "website"],
    ["Google", "google"],
    ["Facebook", "facebook"],
    ["Instagram", "instagram"],
    ["LinkedIn", "linkedin"],
    ["WhatsApp", "whatsapp"],
    ["Phone", "phone"],
    ["Referral", "referral"],
    ["BNI", "bni"],
    ["Existing Customer", "existing_customer"],
    ["Campaign", "campaign"],
    ["YouTube", "youtube"],
    ["Other", "other"],
  ] as const;
  for (const [name, platform] of sources) {
    const id = `seed-source-${platform}`;
    await prisma.leadSource.upsert({
      where: { id },
      update: { name, platform, isActive: true },
      create: { id, name, platform, isActive: true },
    });
  }

  const categories: Array<{ group: string; name: string }> = [
    { group: "Digital Marketing", name: "Social Media Marketing" },
    { group: "Digital Marketing", name: "SEO" },
    { group: "Digital Marketing", name: "Google Ads" },
    { group: "Digital Marketing", name: "Meta Ads" },
    { group: "Digital Marketing", name: "Lead Generation" },
    { group: "Digital Marketing", name: "Branding" },
    { group: "Digital Marketing", name: "Creative Services" },
    { group: "Technology", name: "Website Design" },
    { group: "Technology", name: "Website Development" },
    { group: "Technology", name: "Software Development" },
    { group: "Technology", name: "Mobile App Development" },
    { group: "Technology", name: "CRM Development" },
    { group: "Technology", name: "Custom Software" },
  ];
  for (const [i, cat] of categories.entries()) {
    await prisma.leadCategory.upsert({
      where: { group_name: { group: cat.group, name: cat.name } },
      update: { isActive: true, sortOrder: (i + 1) * 10 },
      create: { ...cat, sortOrder: (i + 1) * 10 },
    });
  }

  const scoring = [
    { eventKey: "responded", points: 10, description: "Lead responded" },
    { eventKey: "interested", points: 10, description: "Interested" },
    { eventKey: "budget_confirmed", points: 15, description: "Budget confirmed" },
    { eventKey: "decision_maker_confirmed", points: 15, description: "Decision maker confirmed" },
    { eventKey: "visit_agreed", points: 10, description: "Site/campus visit agreed" },
    { eventKey: "visit_completed", points: 20, description: "Site/campus visit completed" },
    { eventKey: "documentation_started", points: 20, description: "Documentation started" },
    { eventKey: "not_reachable", points: -10, description: "Not reachable repeatedly" },
    { eventKey: "low_budget", points: -15, description: "Low budget" },
    { eventKey: "not_interested", points: -20, description: "Not interested" },
    { eventKey: "invalid", points: -30, description: "Invalid or wrong number" },
    { eventKey: "do_not_call", points: -25, description: "Asked not to call" },
    { eventKey: "unwanted", points: -25, description: "Unwanted / out of market" },
  ];
  for (const rule of scoring) {
    await prisma.scoringRule.upsert({
      where: { eventKey: rule.eventKey },
      update: rule,
      create: rule,
    });
  }

  const journeys = [
    { name: "Day 1 intro", journey: "general", dayOffset: 1, body: "Hi {{name}}, thanks for enquiring with Social72. We will share a brief shortly." },
    { name: "Day 3 brochure", journey: "general", dayOffset: 3, body: "Hi {{name}}, here is more on how Social72 runs campaigns and calling." },
    { name: "Day 7 follow-up", journey: "general", dayOffset: 7, body: "Hi {{name}}, checking if you would like a 15-min call this week." },
    { name: "Day 14 offer", journey: "general", dayOffset: 14, body: "Hi {{name}}, we can lock a start date this month if the brief is ready." },
    { name: "Day 30 re-engage", journey: "general", dayOffset: 30, body: "Hi {{name}}, circling back in case the requirement is active again." },
  ];
  for (const tpl of journeys) {
    const exists = await prisma.nurtureTemplate.findFirst({ where: { name: tpl.name, journey: tpl.journey } });
    if (!exists) {
      await prisma.nurtureTemplate.create({ data: { ...tpl, channel: "whatsapp" } });
    }
  }

  await prisma.slaRule.upsert({
    where: { key: "assign_new_lead" },
    update: { name: "Assign new lead", thresholdMinutes: 15, escalateTo: "team_leader" },
    create: {
      key: "assign_new_lead",
      name: "Assign new lead",
      thresholdMinutes: 15,
      escalateTo: "team_leader",
    },
  });
  await prisma.slaRule.upsert({
    where: { key: "first_call" },
    update: { name: "First call after assignment", thresholdMinutes: 10, escalateTo: "team_leader" },
    create: {
      key: "first_call",
      name: "First call after assignment",
      thresholdMinutes: 10,
      escalateTo: "team_leader",
    },
  });

  await prisma.setting.upsert({
    where: { key: "locale" },
    update: { value: { timezone: "Asia/Kolkata", currency: "INR", language: "en" } },
    create: {
      key: "locale",
      value: { timezone: "Asia/Kolkata", currency: "INR", language: "en" },
    },
  });

  await prisma.setting.upsert({
    where: { key: "ingest" },
    update: {},
    create: { key: "ingest", value: { key: "change-me-ingest" } },
  });

  await prisma.setting.upsert({
    where: { key: "meta" },
    update: {},
    create: {
      key: "meta",
      value: { verifyToken: "", pageId: "", graphVersion: "v21.0", forms: [] },
    },
  });

  const superAdmin = await prisma.role.findUniqueOrThrow({ where: { key: "super_admin" } });
  const email = process.env.SEED_ADMIN_EMAIL ?? "nathan.k@example.net";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe!Social72";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    const userId = crypto.randomUUID();
    const passwordHash = await hashPassword(password);
    await prisma.user.create({
      data: {
        id: userId,
        name: "Super Admin",
        email,
        emailVerified: true,
        roleId: superAdmin.id,
        isActive: true,
        accounts: {
          create: {
            id: crypto.randomUUID(),
            accountId: userId,
            providerId: "credential",
            issuer: "local:credential",
            password: passwordHash,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      },
    });
    console.log(`Created super admin ${email}`);
  } else {
    console.log(`Super admin ${email} already exists`);
  }

  await seedBpoAndLeads(prisma);
  await shapeDemoFloor(prisma);
}


main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
