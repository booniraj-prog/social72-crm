import { NextRequest, NextResponse } from "next/server";
import { jsonError, requirePermission } from "@/lib/session";
import { patchApprovalMatrix } from "@/modules/settings/service";

export async function PATCH(request: NextRequest) {
  try {
    const actor = await requirePermission("settings.write");
    const approvals = await patchApprovalMatrix(actor, await request.json());
    return NextResponse.json({ approvals });
  } catch (error) {
    return jsonError(error);
  }
}
