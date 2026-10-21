import { prisma } from "@/lib/db";

export const TRASH_DAYS = 30;

export type TrashKind = "expense" | "purchase" | "license" | "invoice" | "person";

export type TrashPayload = Record<string, unknown>;

export type TrashRow = {
  id: string;
  entityType: TrashKind;
  entityId: string;
  title: string;
  summary: string | null;
  payload: TrashPayload;
  deletedBy: string;
  deletedAt: Date;
  purgeAt: Date;
  restoredAt: Date | null;
};

let ensured = false;

export async function ensureTrashTable() {
  if (ensured) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS trash_items (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT,
      payload TEXT NOT NULL,
      deleted_by TEXT NOT NULL,
      deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      purge_at TIMESTAMPTZ NOT NULL,
      restored_at TIMESTAMPTZ
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS trash_items_active_idx ON trash_items (restored_at, purge_at)`,
  );
  ensured = true;
}

export function jsonSafe(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "object" && value !== null && "toNumber" in value && typeof (value as { toNumber: () => number }).toNumber === "function") {
    return (value as { toNumber: () => number }).toNumber();
  }
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (typeof value === "object") {
    const skip = new Set([
      "client",
      "claimant",
      "approver",
      "engagement",
      "vendor",
      "owner",
      "lead",
      "role",
      "department",
      "employee",
    ]);
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (skip.has(key)) continue;
      out[key] = jsonSafe(nested);
    }
    return out;
  }
  return value;
}

export async function putInTrash(input: {
  entityType: TrashKind;
  entityId: string;
  title: string;
  summary?: string;
  payload: unknown;
  deletedBy: string;
}) {
  await ensureTrashTable();
  const id = crypto.randomUUID();
  const deletedAt = new Date();
  const purgeAt = new Date(deletedAt.getTime() + TRASH_DAYS * 86400000);
  const payload = JSON.stringify(jsonSafe(input.payload));
  await prisma.$executeRaw`
    INSERT INTO trash_items (id, entity_type, entity_id, title, summary, payload, deleted_by, deleted_at, purge_at)
    VALUES (
      ${id},
      ${input.entityType},
      ${input.entityId},
      ${input.title},
      ${input.summary ?? null},
      ${payload},
      ${input.deletedBy},
      ${deletedAt},
      ${purgeAt}
    )
  `;
  return { id, purgeAt };
}

export async function purgeExpiredTrash() {
  await ensureTrashTable();
  await prisma.$executeRaw`DELETE FROM trash_items WHERE restored_at IS NULL AND purge_at < NOW()`;
}

export async function listTrashItems(): Promise<TrashRow[]> {
  await ensureTrashTable();
  await purgeExpiredTrash();
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      entity_type: string;
      entity_id: string;
      title: string;
      summary: string | null;
      payload: string;
      deleted_by: string;
      deleted_at: Date;
      purge_at: Date;
      restored_at: Date | null;
    }>
  >`
    SELECT id, entity_type, entity_id, title, summary, payload, deleted_by, deleted_at, purge_at, restored_at
    FROM trash_items
    WHERE restored_at IS NULL
    ORDER BY deleted_at DESC
  `;
  return rows.map((row) => ({
    id: row.id,
    entityType: row.entity_type as TrashKind,
    entityId: row.entity_id,
    title: row.title,
    summary: row.summary,
    payload: JSON.parse(row.payload) as TrashPayload,
    deletedBy: row.deleted_by,
    deletedAt: new Date(row.deleted_at),
    purgeAt: new Date(row.purge_at),
    restoredAt: row.restored_at ? new Date(row.restored_at) : null,
  }));
}

export async function getTrashItem(id: string) {
  await ensureTrashTable();
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      entity_type: string;
      entity_id: string;
      title: string;
      summary: string | null;
      payload: string;
      deleted_by: string;
      deleted_at: Date;
      purge_at: Date;
      restored_at: Date | null;
    }>
  >`
    SELECT id, entity_type, entity_id, title, summary, payload, deleted_by, deleted_at, purge_at, restored_at
    FROM trash_items
    WHERE id = ${id}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    entityType: row.entity_type as TrashKind,
    entityId: row.entity_id,
    title: row.title,
    summary: row.summary,
    payload: JSON.parse(row.payload) as TrashPayload,
    deletedBy: row.deleted_by,
    deletedAt: new Date(row.deleted_at),
    purgeAt: new Date(row.purge_at),
    restoredAt: row.restored_at ? new Date(row.restored_at) : null,
  } satisfies TrashRow;
}

export async function markTrashRestored(id: string) {
  await prisma.$executeRaw`UPDATE trash_items SET restored_at = NOW() WHERE id = ${id}`;
}

export function asDate(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function asText(value: unknown) {
  if (value == null) return null;
  const text = String(value);
  return text ? text : null;
}

export function asMoney(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}
