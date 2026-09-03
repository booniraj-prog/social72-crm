import { z } from "zod";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import type { AuthUser } from "@/lib/rbac";

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
  const [scoring, sla, locale] = await Promise.all([
    prisma.scoringRule.findMany({ orderBy: { eventKey: "asc" } }),
    prisma.slaRule.findMany({ orderBy: { key: "asc" } }),
    prisma.setting.findUnique({ where: { key: "locale" } }),
  ]);
  return { scoring, sla, locale: locale?.value ?? { timezone: "Asia/Kolkata", currency: "INR" } };
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
