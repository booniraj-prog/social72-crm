import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireUser } from "@/lib/session";
import { listLeads } from "@/modules/leads/service";
import { platformSearch } from "@/modules/platform/service";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireUser();
    const q = request.nextUrl.searchParams.get("q") ?? "";
    if (!q.trim()) return NextResponse.json({ leads: [], extra: {} });
    const [leads, extra] = await Promise.all([
      listLeads(actor, { q: q.trim(), pageSize: "8", page: "1" }),
      platformSearch(q.trim()),
    ]);
    return NextResponse.json({ leads: leads.leads, extra });
  } catch (error) {
    return jsonError(error);
  }
}
