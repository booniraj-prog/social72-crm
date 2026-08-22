import { NextResponse } from "next/server";
import { jsonError, requirePermission } from "@/lib/session";
import { claimLead } from "@/modules/leads/service";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requirePermission("lead.write");
    const { id } = await context.params;
    const lead = await claimLead(actor, id);
    return NextResponse.json({ lead });
  } catch (error) {
    return jsonError(error);
  }
}
