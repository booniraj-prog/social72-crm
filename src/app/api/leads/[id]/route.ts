import { NextRequest, NextResponse } from "next/server";
import { jsonError, requirePermission } from "@/lib/session";
import { getLead, updateLead } from "@/modules/leads/service";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requirePermission("lead.read");
    const { id } = await context.params;
    const lead = await getLead(actor, id);
    return NextResponse.json({ lead });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requirePermission("lead.write");
    const { id } = await context.params;
    const body = await request.json();
    const lead = await updateLead(actor, id, body);
    return NextResponse.json({ lead });
  } catch (error) {
    return jsonError(error);
  }
}
