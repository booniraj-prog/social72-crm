import { z } from "zod";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { HttpError } from "@/lib/session";

const blankToNull = z.union([z.string().uuid(), z.literal(""), z.null()]).optional();

export const createClientSchema = z.object({
  name: z.string().trim().min(2).max(160),
  industryId: blankToNull,
  contactName: z.string().trim().max(120).optional().or(z.literal("")),
  contactEmail: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine((value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), "Invalid email"),
  contactPhone: z.string().trim().max(20).optional().or(z.literal("")),
  isActive: z.boolean().optional(),
});

export const updateClientSchema = createClientSchema.partial();

export async function listClients() {
  return prisma.client.findMany({
    orderBy: { name: "asc" },
    include: { industry: true, _count: { select: { campaigns: true } } },
  });
}

export async function listIndustries() {
  return prisma.industry.findMany({ orderBy: { name: "asc" } });
}

export async function createClient(actorId: string, input: z.infer<typeof createClientSchema>) {
  const data = createClientSchema.parse(input);
  const client = await prisma.client.create({
    data: {
      name: data.name,
      industryId: data.industryId || null,
      contactName: data.contactName || null,
      contactEmail: data.contactEmail || null,
      contactPhone: data.contactPhone || null,
      isActive: data.isActive ?? true,
    },
    include: { industry: true, _count: { select: { campaigns: true } } },
  });

  await writeAudit({
    userId: actorId,
    action: "client.created",
    entityType: "client",
    entityId: client.id,
    newValue: { name: client.name },
  });

  return client;
}

export async function updateClient(
  actorId: string,
  id: string,
  input: z.infer<typeof updateClientSchema>,
) {
  const data = updateClientSchema.parse(input);
  const existing = await prisma.client.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Client not found", "NOT_FOUND");

  const client = await prisma.client.update({
    where: { id },
    data: {
      name: data.name,
      industryId: data.industryId === undefined ? undefined : data.industryId || null,
      contactName: data.contactName === undefined ? undefined : data.contactName || null,
      contactEmail: data.contactEmail === undefined ? undefined : data.contactEmail || null,
      contactPhone: data.contactPhone === undefined ? undefined : data.contactPhone || null,
      isActive: data.isActive,
    },
    include: { industry: true, _count: { select: { campaigns: true } } },
  });

  await writeAudit({
    userId: actorId,
    action: "client.updated",
    entityType: "client",
    entityId: id,
    oldValue: { name: existing.name, isActive: existing.isActive },
    newValue: { name: client.name, isActive: client.isActive },
  });

  return client;
}
