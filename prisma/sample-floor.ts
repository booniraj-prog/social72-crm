import type { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";

const FLOOR_PASSWORD = "Floor@12345";

export const BPO_MEMBERS = [
  { email: "rahul.desai@social72.local", name: "Rahul Desai", role: "bpo_leader", mobile: "+919811100001" },
  { email: "meera.kulkarni@social72.local", name: "Meera Kulkarni", role: "bpo_executive", mobile: "+919811100002" },
  { email: "amit.sharma@social72.local", name: "Amit Sharma", role: "bpo_executive", mobile: "+919811100003" },
  { email: "pooja.verma@social72.local", name: "Pooja Verma", role: "bpo_executive", mobile: "+919811100004" },
] as const;

const STATUS_CYCLE = [
  "NEW",
  "ASSIGNED",
  "CALL_NOT_ATTEMPTED",
  "CALL_ATTEMPTED",
  "CONNECTED",
  "NOT_INTERESTED",
  "INTERESTED",
  "QUALIFIED",
  "FOLLOW_UP",
  "CAMPUS_VISIT",
  "MEETING",
  "NEGOTIATION",
  "DOCUMENTATION",
  "PAYMENT_PENDING",
  "CLOSED_WON",
  "CLOSED_LOST",
  "NURTURE",
  "SITE_VISIT",
  "INVALID",
  "DO_NOT_CALL",
] as const;

const PEOPLE = [
  ["Rohan", "Mehta"],
  ["Priya", "Nair"],
  ["Vikram", "Singh"],
  ["Sneha", "Iyer"],
  ["Arjun", "Patel"],
  ["Kavya", "Reddy"],
  ["Imran", "Khan"],
  ["Ananya", "Sharma"],
  ["Neha", "Joshi"],
  ["Farhan", "Ali"],
  ["Aditi", "Kulkarni"],
  ["Sanjay", "Gupta"],
  ["Ritika", "Malhotra"],
  ["Dev", "Choudhary"],
  ["Ishita", "Bansal"],
  ["Kunal", "Jain"],
  ["Ayesha", "Qureshi"],
  ["Nikhil", "Rao"],
  ["Tara", "Menon"],
  ["Harsh", "Trivedi"],
  ["Simran", "Kaur"],
  ["Yash", "Agarwal"],
  ["Diya", "Kapoor"],
  ["Mohit", "Saxena"],
  ["Nandini", "Pillai"],
  ["Ravi", "Thakur"],
  ["Pooja", "Bhatt"],
  ["Karthik", "Nambiar"],
  ["Leela", "Krishnan"],
  ["Omar", "Sheikh"],
  ["Gauri", "Deshmukh"],
  ["Varun", "Batra"],
  ["Sana", "Farooqi"],
  ["Manish", "Yadav"],
  ["Jhanvi", "Shah"],
  ["Abhay", "Mishra"],
  ["Reema", "Dutta"],
  ["Sohail", "Ansari"],
  ["Tanvi", "Kale"],
  ["Gaurav", "Bose"],
];

const CITIES: Array<[string, string]> = [
  ["Mumbai", "Maharashtra"],
  ["Pune", "Maharashtra"],
  ["Jaipur", "Rajasthan"],
  ["Chennai", "Tamil Nadu"],
  ["Ahmedabad", "Gujarat"],
  ["Hyderabad", "Telangana"],
  ["Lucknow", "Uttar Pradesh"],
  ["Delhi", "Delhi"],
  ["Bengaluru", "Karnataka"],
  ["Kolkata", "West Bengal"],
];

const TEMPS = ["HOT", "WARM", "COLD", "UNQUALIFIED"] as const;

async function ensureUser(
  prisma: PrismaClient,
  input: { email: string; name: string; roleKey: string; mobile: string },
) {
  const role = await prisma.role.findUniqueOrThrow({ where: { key: input.roleKey } });
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: { name: input.name, roleId: role.id, mobile: input.mobile, isActive: true },
    });
  }
  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword(FLOOR_PASSWORD);
  return prisma.user.create({
    data: {
      id: userId,
      name: input.name,
      email: input.email,
      emailVerified: true,
      roleId: role.id,
      mobile: input.mobile,
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
}

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

export async function seedBpoAndLeads(prisma: PrismaClient) {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "nathan.k@example.net";
  const admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!admin) return;

  const floor = [];
  for (const member of BPO_MEMBERS) {
    floor.push(
      await ensureUser(prisma, {
        email: member.email,
        name: member.name,
        roleKey: member.role,
        mobile: member.mobile,
      }),
    );
  }

  const leader = floor[0];
  const team = await prisma.team.upsert({
    where: { id: "seed-team-admissions-floor" },
    update: { name: "Admissions Floor", leaderId: leader.id },
    create: { id: "seed-team-admissions-floor", name: "Admissions Floor", leaderId: leader.id },
  });
  await prisma.teamMember.deleteMany({ where: { teamId: team.id } });
  await prisma.teamMember.createMany({
    data: floor.map((user) => ({ teamId: team.id, userId: user.id })),
  });

  const education = await prisma.industry.findUniqueOrThrow({ where: { key: "education" } });
  const pipeline = await prisma.pipeline.findFirst({
    where: { industryId: education.id, isDefault: true },
  });
  const client = await prisma.client.upsert({
    where: { id: "seed-client-gm-global" },
    update: { name: "GM Global School", isActive: true },
    create: {
      id: "seed-client-gm-global",
      name: "GM Global School",
      industryId: education.id,
      contactName: "Admissions desk",
      contactEmail: "admissions@gmglobal.example",
      contactPhone: "+919800000001",
    },
  });
  const campaign = await prisma.campaign.upsert({
    where: { id: "seed-campaign-class-11" },
    update: { name: "Class 11 Intake", isActive: true },
    create: {
      id: "seed-campaign-class-11",
      clientId: client.id,
      industryId: education.id,
      pipelineId: pipeline?.id,
      name: "Class 11 Intake",
      campaignType: "lead_gen",
      platform: "meta_ads",
      budget: 250000,
      actualSpend: 118000,
      ownerUserId: admin.id,
    },
  });
  const meta = await prisma.leadSource.upsert({
    where: { id: "seed-source-meta" },
    update: { name: "Meta Ads", isActive: true },
    create: { id: "seed-source-meta", name: "Meta Ads", platform: "meta_ads" },
  });

  const statuses = Object.fromEntries((await prisma.leadStatus.findMany()).map((s) => [s.key, s]));
  const dispositions = Object.fromEntries((await prisma.disposition.findMany()).map((d) => [d.key, d]));
  const now = new Date();

  let created = 0;
  for (let i = 0; i < 40; i++) {
    const [firstName, lastName] = PEOPLE[i];
    const [city, state] = CITIES[i % CITIES.length];
    const statusKey = STATUS_CYCLE[i % STATUS_CYCLE.length];
    const status = statuses[statusKey];
    if (!status) continue;
    const owner = floor[i % 4];
    const mobile = `+91987651${String(i + 1).padStart(4, "0")}`;
    const temperature = TEMPS[i % TEMPS.length];
    const expectedValue = 120000 + (i % 10) * 15000;
    const probabilityPct = statusKey === "CLOSED_WON" ? 100 : statusKey === "CLOSED_LOST" ? 0 : (i * 7) % 80;
    const attempts = statusKey === "NEW" || statusKey === "ASSIGNED" || statusKey === "CALL_NOT_ATTEMPTED" ? 0 : 1 + (i % 5);
    const connected =
      ["CONNECTED", "INTERESTED", "QUALIFIED", "FOLLOW_UP", "CAMPUS_VISIT", "MEETING", "NEGOTIATION", "DOCUMENTATION", "PAYMENT_PENDING", "CLOSED_WON", "SITE_VISIT", "NURTURE"].includes(
        statusKey,
      )
        ? Math.max(1, Math.floor(attempts / 2))
        : 0;
    const follow =
      status.isFinal || statusKey === "NEW"
        ? null
        : new Date(now.getTime() + ((i % 5) - 2) * 24 * 60 * 60 * 1000);

    const existingLead = await prisma.lead.findFirst({
      where: { clientId: client.id, mobileE164: mobile, deletedAt: null },
    });

    const payload = {
      statusId: status.id,
      assignedUserId: owner.id,
      assignedTeamId: team.id,
      assignedAt: now,
      temperature,
      expectedValue,
      probabilityPct,
      expectedRevenue: (expectedValue * probabilityPct) / 100,
      nextFollowupAt: follow,
      nextAction: status.isFinal ? null : "Outbound follow-up",
      callAttempts: attempts,
      connectedCalls: connected,
      leadScore: connected * 10 - (statusKey === "NOT_INTERESTED" ? 20 : 0),
      city,
      state,
      converted: statusKey === "CLOSED_WON",
      actualRevenue: statusKey === "CLOSED_WON" ? expectedValue : 0,
      closureDate: statusKey.startsWith("CLOSED_") ? now : null,
      lastActivityAt: now,
      firstContactAt: connected ? now : null,
      lastContactAt: connected ? now : attempts ? now : null,
    };

    let leadId: string;
    if (existingLead) {
      await prisma.lead.update({ where: { id: existingLead.id }, data: payload });
      leadId = existingLead.id;
      await prisma.callLog.deleteMany({ where: { leadId } });
    } else {
      const lead = await prisma.lead.create({
        data: {
          ...payload,
          leadNumber: await nextLeadNumber(prisma),
          clientId: client.id,
          campaignId: campaign.id,
          industryId: education.id,
          sourceId: meta.id,
          createdById: admin.id,
          firstName,
          lastName,
          fullName: `${firstName} ${lastName}`,
          mobileE164: mobile,
          email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@example.com`,
          country: "India",
          sourcePlatform: "meta_ads",
          utmSource: "facebook",
          utmMedium: "cpc",
          utmCampaign: "class-11-intake",
          generatedAt: now,
        },
      });
      leadId = lead.id;
      created += 1;
      await prisma.activity.create({
        data: {
          leadId,
          userId: owner.id,
          type: "created",
          title: "Lead created",
          body: `Sample ${status.name} · assigned to ${owner.name}`,
        },
      });
    }

    const missed = dispositions.NOT_ANSWERED;
    const connectedDisp = dispositions.CONNECTED;
    if (missed && attempts > connected) {
      for (let c = 0; c < attempts - connected; c++) {
        await prisma.callLog.create({
          data: {
            leadId,
            userId: owner.id,
            startedAt: new Date(now.getTime() - (c + 1) * 3600_000),
            durationSec: 0,
            dispositionId: missed.id,
            notes: "No answer — sample outbound attempt",
          },
        });
      }
    }
    if (connectedDisp && connected > 0) {
      for (let c = 0; c < connected; c++) {
        await prisma.callLog.create({
          data: {
            leadId,
            userId: owner.id,
            startedAt: new Date(now.getTime() - c * 1800_000),
            durationSec: 90 + c * 15,
            dispositionId: connectedDisp.id,
            notes: "Connected — sample outbound conversation",
          },
        });
      }
    }
  }

  console.log(`BPO floor ready (${floor.length} callers). Sample leads ready (${created} created, others updated).`);
  console.log(`BPO login password for all four: ${FLOOR_PASSWORD}`);
}
