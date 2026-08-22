import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";

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
  { key: "NOT_INTERESTED", name: "Not interested", color: "#b45309", isFinal: false, sortOrder: 60, description: "Declined the offer" },
  { key: "INTERESTED", name: "Interested", color: "#15803d", isFinal: false, sortOrder: 70, description: "Expressed interest" },
  { key: "QUALIFIED", name: "Qualified", color: "#166534", isFinal: false, sortOrder: 80, description: "Meets qualification criteria" },
  { key: "FOLLOW_UP", name: "Follow-up", color: "#c2410c", isFinal: false, sortOrder: 90, description: "Callback scheduled" },
  { key: "SITE_VISIT", name: "Site visit", color: "#1d4ed8", isFinal: false, sortOrder: 100, description: "Property site visit" },
  { key: "CAMPUS_VISIT", name: "Campus visit", color: "#1d4ed8", isFinal: false, sortOrder: 110, description: "Campus visit" },
  { key: "MEETING", name: "Meeting", color: "#4338ca", isFinal: false, sortOrder: 120, description: "In-person or virtual meeting" },
  { key: "NEGOTIATION", name: "Negotiation", color: "#a16207", isFinal: false, sortOrder: 130, description: "Commercial discussion" },
  { key: "DOCUMENTATION", name: "Documentation", color: "#0f766e", isFinal: false, sortOrder: 140, description: "Paperwork in progress" },
  { key: "PAYMENT_PENDING", name: "Payment pending", color: "#b45309", isFinal: false, sortOrder: 150, description: "Awaiting payment" },
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
    "CAMPUS_VISIT_AGREED",
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
