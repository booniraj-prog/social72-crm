import { NextResponse } from "next/server";
import { jsonError, requireUser } from "@/lib/session";
import { markNotificationsRead } from "@/modules/ops/service";

export async function POST() {
  try {
    const user = await requireUser();
    await markNotificationsRead(user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
