import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ensureOpsTables } from "@/lib/ops-tables";

export async function setLeadActiveFlag(id: string, active: boolean) {
  await ensureOpsTables();
  await prisma.$executeRaw`
    UPDATE leads SET is_active = ${active}, last_activity_at = NOW(), updated_at = NOW() WHERE id = ${id}
  `;
}

export async function pausedLeadIds() {
  await ensureOpsTables();
  const rows = await prisma
    .$queryRaw<Array<{ id: string }>>`SELECT id FROM leads WHERE is_active = false`
    .catch(() => [] as Array<{ id: string }>);
  return rows.map((row) => row.id);
}

export function excludePausedLeads(ids: string[]): Prisma.LeadWhereInput {
  return ids.length > 0 ? { id: { notIn: ids } } : {};
}

export async function attachLeadActive<T extends { id: string }>(rows: T[]) {
  if (rows.length === 0) return [] as Array<T & { isActive: boolean }>;
  await ensureOpsTables();
  const flags = await prisma
    .$queryRaw<Array<{ id: string; is_active: boolean }>>`
      SELECT id, is_active FROM leads WHERE id IN (${Prisma.join(rows.map((row) => row.id))})
    `
    .catch(() => [] as Array<{ id: string; is_active: boolean }>);
  const map = Object.fromEntries(flags.map((row) => [row.id, row.is_active !== false]));
  return rows.map((row) => ({ ...row, isActive: map[row.id] !== false }));
}
