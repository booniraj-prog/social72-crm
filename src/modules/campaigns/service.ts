import { z } from "zod";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { HttpError } from "@/lib/session";
import type { AuthUser } from "@/lib/rbac";

export const createCampaignSchema = z.object({
  name: z.string().trim().min(2).max(160),
  clientId: z.string().uuid(),
  platform: z.string().trim().max(40).optional().or(z.literal("")),
  campaignType: z.string().trim().max(40).optional().or(z.literal("")),
});

export async function listCampaigns(clientId?: string) {
  return prisma.campaign.findMany({
    where: {
      isActive: true,
      ...(clientId ? { clientId } : {}),
    },
    orderBy: { name: "asc" },
    include: { client: { select: { id: true, name: true } }, industry: true },
  });
}

export async function createCampaign(actor: AuthUser, input: z.infer<typeof createCampaignSchema>) {
  const data = createCampaignSchema.parse(input);
  const client = await prisma.client.findUnique({ where: { id: data.clientId } });
  if (!client) throw new HttpError(400, "Client not found", "INVALID_CLIENT");
  if (!client.industryId) {
    throw new HttpError(400, "Assign an industry to the client first", "CLIENT_NO_INDUSTRY");
  }

  const pipeline = await prisma.pipeline.findFirst({
    where: { industryId: client.industryId, isDefault: true },
  });

  const campaign = await prisma.campaign.create({
    data: {
      name: data.name,
      clientId: client.id,
      industryId: client.industryId,
      pipelineId: pipeline?.id,
      platform: data.platform || null,
      campaignType: data.campaignType || null,
      ownerUserId: actor.id,
    },
    include: { client: { select: { id: true, name: true } }, industry: true },
  });

  await writeAudit({
    userId: actor.id,
    action: "campaign.created",
    entityType: "campaign",
    entityId: campaign.id,
    newValue: { name: campaign.name, clientId: client.id },
  });

  return campaign;
}
