import { prisma } from "@/lib/db";
import { formatIst } from "@/lib/time";

export async function writeAudit(input: {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
}) {
  await prisma.auditLog.create({
    data: {
      userId: input.userId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      oldValue: input.oldValue === undefined ? undefined : (input.oldValue as object),
      newValue: input.newValue === undefined ? undefined : (input.newValue as object),
    },
  });
}

export async function auditTips(entityType: string, ids: string[]) {
  if (ids.length === 0) return {} as Record<string, string>;
  const logs = await prisma.auditLog.findMany({
    where: { entityType, entityId: { in: ids } },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: Math.min(800, ids.length * 8),
  });
  const buckets: Record<string, string[]> = {};
  for (const log of logs) {
    const id = log.entityId;
    if (!id) continue;
    buckets[id] ??= [];
    if (buckets[id].length >= 6) continue;
    buckets[id].push(`${formatIst(log.createdAt)} · ${log.user?.name ?? "System"} · ${log.action}`);
  }
  return Object.fromEntries(Object.entries(buckets).map(([id, lines]) => [id, `Edit history\n${lines.join("\n")}`]));
}
