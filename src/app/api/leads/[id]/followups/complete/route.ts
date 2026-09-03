import { NextRequest, NextResponse } from "next/server";
import { jsonError, requirePermission } from "@/lib/session";
import { completeCurrentFollowup } from "@/modules/followups/service";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requirePermission("lead.write");
    const { id } = await context.params;
    const followUp = await completeCurrentFollowup(actor, id);
    return NextResponse.json({ followUp });
  } catch (error) {
    return jsonError(error);
  }
}
