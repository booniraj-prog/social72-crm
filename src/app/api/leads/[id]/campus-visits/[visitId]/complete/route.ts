import { NextRequest, NextResponse } from "next/server";
import { jsonError, requirePermission } from "@/lib/session";
import { completeCampusVisit } from "@/modules/education/service";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; visitId: string }> },
) {
  try {
    const actor = await requirePermission("lead.write");
    const { id, visitId } = await context.params;
    const visit = await completeCampusVisit(actor, id, visitId, await request.json().catch(() => ({})));
    return NextResponse.json({ visit });
  } catch (error) {
    return jsonError(error);
  }
}
