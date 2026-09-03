import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { seedBpoAndLeads } from "./sample-floor";
import { seedRealEstate } from "./sample-real-estate";

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
    "campaign.read",
    "campaign.write",
    "lead.read",
    "report.read",
    "report.export",
  ],
  client: ["campaign.read", "lead.read", "report.read"],
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
  { key: "NURTURE", name: "Nurture", color: "#6d28d9", isFinal: false, sortOrder: 210, description: "Long-term nurture" },
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
    { eventKey: "invalid", points: -30, description: "Invalid lead" },
  ];
  for (const rule of scoring) {
    await prisma.scoringRule.upsert({
      where: { eventKey: rule.eventKey },
      update: rule,
      create: rule,
    });
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
  await seedRealEstate(prisma);
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
