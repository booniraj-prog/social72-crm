import { NextResponse } from "next/server";
import { jsonError, requirePermission } from "@/lib/session";
import { listRoles } from "@/modules/users/service";

export async function GET() {
  try {
    await requirePermission("user.read");
    const roles = await listRoles();
    return NextResponse.json({ roles });
  } catch (error) {
    return jsonError(error);
  }
}
