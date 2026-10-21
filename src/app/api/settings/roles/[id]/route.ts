import { NextRequest, NextResponse } from "next/server";
import { jsonError, requirePermission } from "@/lib/session";
import { patchRoleAlerts } from "@/modules/settings/service";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requirePermission("settings.write");
    const { id } = await context.params;
    const role = await patchRoleAlerts(actor, id, await request.json());
    return NextResponse.json({ role });
  } catch (error) {
    return jsonError(error);
  }
}
