import { NextRequest, NextResponse } from "next/server";
import { jsonError, requirePermission } from "@/lib/session";
import { createUser, listUsers } from "@/modules/users/service";

export async function GET() {
  try {
    await requirePermission("user.read");
    const users = await listUsers();
    return NextResponse.json({ users });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requirePermission("user.write");
    const body = await request.json();
    const user = await createUser(actor.id, body);
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
