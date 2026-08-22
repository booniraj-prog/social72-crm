import { NextRequest, NextResponse } from "next/server";
import { jsonError, requirePermission } from "@/lib/session";
import { logCall } from "@/modules/calling/service";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requirePermission("lead.write");
    const { id } = await context.params;
    const body = await request.json();
    const call = await logCall(actor, id, body);
    return NextResponse.json({ call }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
