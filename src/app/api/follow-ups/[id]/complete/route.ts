import { NextRequest, NextResponse } from "next/server";
import { jsonError, requirePermission } from "@/lib/session";
import { completeFollowup } from "@/modules/followups/service";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requirePermission("lead.write");
    const { id } = await context.params;
    const followUp = await completeFollowup(actor, id);
    return NextResponse.json({ followUp });
  } catch (error) {
    return jsonError(error);
  }
}
