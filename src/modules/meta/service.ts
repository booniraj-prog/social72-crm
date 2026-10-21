import { z } from "zod";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { DuplicateLeadError, HttpError } from "@/lib/session";
import type { AuthUser } from "@/lib/rbac";
import { createLeadWithDuplicateInfo } from "@/modules/leads/service";
import { fetchGraphLead, parseMetaLeadFields, type LeadgenValue } from "@/lib/meta-ingest";

const formMapSchema = z.object({
  formId: z.string().trim().min(3).max(40),
  campaignId: z.string().uuid(),
  assignedUserId: z.string().uuid().optional().or(z.literal("")),
});

export const metaSettingsSchema = z.object({
  verifyToken: z.string().trim().max(120).optional(),
  appSecret: z.string().trim().max(200).optional(),
  pageAccessToken: z.string().trim().max(500).optional(),
  pageId: z.string().trim().max(40).optional(),
  graphVersion: z.string().trim().max(12).optional(),
  forms: z.array(formMapSchema).max(40).optional(),
});

export type MetaConfig = {
  verifyToken: string;
  appSecret: string;
  pageAccessToken: string;
  pageId: string;
  graphVersion: string;
  forms: Array<{ formId: string; campaignId: string; assignedUserId: string }>;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export async function loadMetaConfig(): Promise<MetaConfig> {
  const row = await prisma.setting.findUnique({ where: { key: "meta" } });
  const stored = asRecord(row?.value);
  const formsRaw = Array.isArray(stored.forms) ? stored.forms : [];
  const forms = formsRaw
    .map((item) => {
      const rec = asRecord(item);
      return {
        formId: String(rec.formId ?? "").trim(),
        campaignId: String(rec.campaignId ?? "").trim(),
        assignedUserId: String(rec.assignedUserId ?? "").trim(),
      };
    })
    .filter((item) => item.formId && item.campaignId);

  return {
    verifyToken: process.env.META_VERIFY_TOKEN || String(stored.verifyToken ?? ""),
    appSecret: process.env.META_APP_SECRET || String(stored.appSecret ?? ""),
    pageAccessToken: process.env.META_PAGE_ACCESS_TOKEN || String(stored.pageAccessToken ?? ""),
    pageId: process.env.META_PAGE_ID || String(stored.pageId ?? ""),
    graphVersion: String(stored.graphVersion ?? "v21.0") || "v21.0",
    forms,
  };
}

export function publicMetaConfig(config: MetaConfig) {
  return {
    verifyToken: config.verifyToken,
    pageId: config.pageId,
    graphVersion: config.graphVersion,
    forms: config.forms,
    appSecretSet: Boolean(config.appSecret),
    pageAccessTokenSet: Boolean(config.pageAccessToken),
    envSecrets: Boolean(process.env.META_APP_SECRET || process.env.META_PAGE_ACCESS_TOKEN || process.env.META_VERIFY_TOKEN),
  };
}

export async function saveMetaConfig(actor: AuthUser, input: z.infer<typeof metaSettingsSchema>) {
  const data = metaSettingsSchema.parse(input);
  const current = await loadMetaConfig();
  const next = {
    verifyToken: data.verifyToken !== undefined ? data.verifyToken : current.verifyToken,
    appSecret: data.appSecret ? data.appSecret : current.appSecret,
    pageAccessToken: data.pageAccessToken ? data.pageAccessToken : current.pageAccessToken,
    pageId: data.pageId !== undefined ? data.pageId : current.pageId,
    graphVersion: data.graphVersion || current.graphVersion || "v21.0",
    forms: (data.forms ?? current.forms).map((form) => ({
      formId: form.formId,
      campaignId: form.campaignId,
      assignedUserId: form.assignedUserId || "",
    })),
  };
  await prisma.setting.upsert({
    where: { key: "meta" },
    update: { value: next },
    create: { key: "meta", value: next },
  });
  await writeAudit({
    userId: actor.id,
    action: "settings.meta_updated",
    entityType: "setting",
    entityId: "meta",
    newValue: { pageId: next.pageId, forms: next.forms.length, graphVersion: next.graphVersion },
  });
  return publicMetaConfig(await loadMetaConfig());
}

async function ingestActor(): Promise<AuthUser> {
  const actorUser = await prisma.user.findFirst({
    where: { isActive: true, role: { key: "super_admin" } },
  });
  if (!actorUser) throw new HttpError(500, "No ingest actor", "NO_ACTOR");
  return {
    id: actorUser.id,
    name: actorUser.name,
    email: actorUser.email,
    roleKey: "super_admin",
    roleName: "Super Admin",
    permissions: [],
    isActive: true,
    clientId: actorUser.clientId,
  };
}

export async function ingestLeadgenEvent(event: LeadgenValue, config: MetaConfig) {
  const leadgenId = String(event.leadgen_id ?? "").trim();
  const formId = String(event.form_id ?? "").trim();
  if (!leadgenId) return { status: "skipped" as const, reason: "missing_leadgen_id" };

  const existing = await prisma.lead.findFirst({
    where: { adId: leadgenId, deletedAt: null },
    select: { id: true, leadNumber: true },
  });
  if (existing) return { status: "duplicate" as const, leadId: existing.id, leadNumber: existing.leadNumber };

  const map = config.forms.find((form) => form.formId === formId);
  if (!map) return { status: "skipped" as const, reason: "unmapped_form", formId };

  if (config.pageId && event.page_id && String(event.page_id) !== config.pageId) {
    return { status: "skipped" as const, reason: "page_mismatch" };
  }

  const campaign = await prisma.campaign.findUnique({
    where: { id: map.campaignId },
    select: { id: true, clientId: true, ownerUserId: true, isActive: true, name: true },
  });
  if (!campaign || campaign.isActive === false) {
    return { status: "skipped" as const, reason: "inactive_campaign" };
  }
  if (!config.pageAccessToken) {
    throw new HttpError(500, "Meta page access token is not set", "META_TOKEN");
  }

  const graph = await fetchGraphLead(leadgenId, config.pageAccessToken, config.graphVersion);
  const parsed = parseMetaLeadFields(graph.field_data ?? []);
  if (!parsed.mobile) return { status: "skipped" as const, reason: "no_phone", leadgenId };

  const source = await prisma.leadSource.upsert({
    where: { id: "seed-source-meta" },
    update: { name: "Meta Ads", isActive: true },
    create: { id: "seed-source-meta", name: "Meta Ads", platform: "meta_ads" },
  });

  const actor = await ingestActor();
  const assignedUserId = map.assignedUserId || campaign.ownerUserId || actor.id;

  try {
    const lead = await createLeadWithDuplicateInfo(actor, {
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      fullName: parsed.fullName,
      mobile: parsed.mobile,
      email: parsed.email,
      city: parsed.city,
      state: parsed.state,
      pincode: parsed.pincode,
      clientId: campaign.clientId,
      campaignId: campaign.id,
      assignedUserId,
      sourceId: source.id,
      sourcePlatform: "meta_ads",
      captureChannel: "social",
      utmSource: "facebook",
      utmMedium: "lead_form",
      utmCampaign: campaign.name,
      adId: leadgenId,
      adSet: formId,
    });
    return { status: "created" as const, lead };
  } catch (error) {
    if (error instanceof DuplicateLeadError) {
      return { status: "duplicate" as const, existing: error.details };
    }
    throw error;
  }
}
