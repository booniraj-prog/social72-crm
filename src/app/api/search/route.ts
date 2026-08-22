import { NextRequest, NextResponse } from "next/server";
import { jsonError, requirePermission } from "@/lib/session";
import { listLeads } from "@/modules/leads/service";

export async function GET(request: NextRequest) {
  try {
    const actor = await requirePermission("lead.read");
    const q = request.nextUrl.searchParams.get("q") ?? "";
    if (!q.trim()) return NextResponse.json({ leads: [] });
    const result = await listLeads(actor, { q: q.trim(), pageSize: "10", page: "1" });
    return NextResponse.json({ leads: result.leads });
  } catch (error) {
    return jsonError(error);
  }
}
