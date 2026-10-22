import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError, requirePermission } from "@/lib/session";
import { leadScopeWhere } from "@/lib/scope";
import { buildFollowupIcs } from "@/lib/ics";
import { GMEET_NEW, touchPointDuration, touchPointLabel } from "@/lib/touch-points";
import { ensureOpsTables } from "@/lib/ops-tables";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission("lead.read");
    const { id } = await context.params;
    await ensureOpsTables();
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        due_at: Date;
        action: string | null;
        kind: string | null;
        meet_url: string | null;
        location: string | null;
        lead_id: string;
        full_name: string;
        lead_number: string;
        client_name: string;
      }>
    >`
      SELECT f.id, f.due_at, f.action, f.kind, f.meet_url, f.location,
             l.id AS lead_id, l.full_name, l.lead_number, c.name AS client_name
      FROM follow_ups f
      JOIN leads l ON l.id = f.lead_id
      JOIN clients c ON c.id = l.client_id
      WHERE f.id = ${id}
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) return NextResponse.json({ error: { message: "Follow-up not found" } }, { status: 404 });
    const scope = await leadScopeWhere(actor);
    const visible = await prisma.lead.findFirst({ where: { id: row.lead_id, AND: [scope] }, select: { id: true } });
    if (!visible) return NextResponse.json({ error: { message: "Follow-up not found" } }, { status: 404 });

    const kind = row.kind || "call";
    const meet = row.meet_url || (kind === "gmeet" ? GMEET_NEW : null);
    const ics = buildFollowupIcs({
      id: row.id,
      title: `${touchPointLabel(kind)} · ${row.full_name}`,
      description: [row.action, row.client_name, meet].filter(Boolean).join("\n"),
      location: row.location || meet || undefined,
      url: meet || undefined,
      start: new Date(row.due_at),
      durationMin: touchPointDuration(kind),
    });
    const filename = `social72-${row.lead_number}-${kind}.ics`;
    return new NextResponse(ics, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
