import { NextRequest, NextResponse } from "next/server";
import { jsonError, requirePermission } from "@/lib/session";
import { updateUser } from "@/modules/users/service";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requirePermission("user.write");
    const { id } = await context.params;
    const body = await request.json();
    const user = await updateUser(actor.id, id, body);
    return NextResponse.json({ user });
  } catch (error) {
    return jsonError(error);
  }
}
