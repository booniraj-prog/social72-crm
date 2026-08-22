import { NextRequest, NextResponse } from "next/server";
import { jsonError, requirePermission } from "@/lib/session";
import { updateQualification } from "@/modules/calling/service";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requirePermission("lead.write");
    const { id } = await context.params;
    const body = await request.json();
    const lead = await updateQualification(actor, id, body);
    return NextResponse.json({ lead });
  } catch (error) {
    return jsonError(error);
  }
}
