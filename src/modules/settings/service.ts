import { z } from "zod";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import type { AuthUser, RoleKey } from "@/lib/rbac";
import {
  ASSIGNABLE_APPROVER_ROLES,
  getApprovalMatrix,
  saveApprovalMatrix,
} from "@/lib/approvals";
import { loadMetaConfig, publicMetaConfig } from "@/modules/meta/service";

export const scoringPatchSchema = z.object({
  points: z.coerce.number().int().min(-100).max(100).optional(),
  isActive: z.boolean().optional(),
  description: z.string().trim().max(200).optional(),
});

export const slaPatchSchema = z.object({
  thresholdMinutes: z.coerce.number().int().min(1).max(10080).optional(),
  isActive: z.boolean().optional(),
  name: z.string().trim().min(2).max(80).optional(),
});

export async function listSettingsBoard() {
  const [scoring, sla, locale, roles, approvals, campaigns, people, metaRow] = await Promise.all([
    prisma.scoringRule.findMany({ orderBy: { eventKey: "asc" } }),
    prisma.slaRule.findMany({ orderBy: { key: "asc" } }),
    prisma.setting.findUnique({ where: { key: "locale" } }),
    prisma.role.findMany({ orderBy: { name: "asc" } }),
    getApprovalMatrix(),
    prisma.campaign.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, client: { select: { name: true } } },
    }),
    prisma.user.findMany({
      where: {
        isActive: true,
        role: {
          key: {
            in: ["super_admin", "bpo_executive", "bpo_leader", "crm_manager", "sales_manager", "marketing_manager"],
          },
        },
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.setting.findUnique({ where: { key: "meta" } }),
  ]);
  const meta = publicMetaConfig(await loadMetaConfig());
  return {
    scoring,
    sla,
    locale: locale?.value ?? { timezone: "Asia/Kolkata", currency: "INR" },
    roles,
    approvals,
    campaigns: campaigns.map((c) => ({ id: c.id, name: `${c.name} · ${c.client.name}` })),
    people,
    meta,
    metaStored: Boolean(metaRow),
  };
}

export async function patchScoring(actor: AuthUser, id: string, input: z.infer<typeof scoringPatchSchema>) {
  const data = scoringPatchSchema.parse(input);
  const rule = await prisma.scoringRule.update({ where: { id }, data });
  await writeAudit({
    userId: actor.id,
    action: "settings.scoring_updated",
    entityType: "scoring_rule",
    entityId: id,
    newValue: data,
  });
  return rule;
}

export const roleAlertSchema = z.object({
  alertEmail: z.string().trim().email().optional().or(z.literal("")),
  alertPhone: z.string().trim().max(20).optional().or(z.literal("")),
  notifyEmail: z.boolean().optional(),
  notifySms: z.boolean().optional(),
});

export async function patchRoleAlerts(actor: AuthUser, id: string, input: z.infer<typeof roleAlertSchema>) {
  const data = roleAlertSchema.parse(input);
  const role = await prisma.role.update({
    where: { id },
    data: {
      alertEmail: data.alertEmail === undefined ? undefined : data.alertEmail || null,
      alertPhone: data.alertPhone === undefined ? undefined : data.alertPhone || null,
      notifyEmail: data.notifyEmail,
      notifySms: data.notifySms,
    },
  });
  await writeAudit({
    userId: actor.id,
    action: "settings.role_alerts_updated",
    entityType: "role",
    entityId: id,
    newValue: data,
  });
  return role;
}

export async function patchSla(actor: AuthUser, id: string, input: z.infer<typeof slaPatchSchema>) {
  const data = slaPatchSchema.parse(input);
  const rule = await prisma.slaRule.update({ where: { id }, data });
  await writeAudit({
    userId: actor.id,
    action: "settings.sla_updated",
    entityType: "sla_rule",
    entityId: id,
    newValue: data,
  });
  return rule;
}

const approverRole = z
  .string()
  .refine((key): key is RoleKey => (ASSIGNABLE_APPROVER_ROLES as string[]).includes(key), "Unknown role");

export const approvalMatrixSchema = z.object({
  people: z.array(approverRole).min(1),
  project: z.array(approverRole).min(1),
  proposal: z.array(approverRole).min(1),
  invoice: z.array(approverRole).min(1),
});

export async function patchApprovalMatrix(actor: AuthUser, input: unknown) {
  const data = approvalMatrixSchema.parse(input);
  const value = await saveApprovalMatrix(data);
  await writeAudit({
    userId: actor.id,
    action: "settings.approvals_updated",
    entityType: "setting",
    entityId: "approval_authorities",
    newValue: value,
  });
  return value;
}
