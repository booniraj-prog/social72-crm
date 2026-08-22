import { NextRequest, NextResponse } from "next/server";
import { jsonError, requirePermission, HttpError } from "@/lib/session";
import { canCreateLeads } from "@/lib/scope";
import { createLeadWithDuplicateInfo, listLeads } from "@/modules/leads/service";

export async function GET(request: NextRequest) {
  try {
    const actor = await requirePermission("lead.read");
    const params = Object.fromEntries(request.nextUrl.searchParams.entries());
    const result = await listLeads(actor, params);
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requirePermission("lead.write");
    if (!canCreateLeads(actor)) {
      throw new HttpError(403, "You cannot create leads", "FORBIDDEN");
    }
    const body = await request.json();
    const lead = await createLeadWithDuplicateInfo(actor, body);
    return NextResponse.json({ lead }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
