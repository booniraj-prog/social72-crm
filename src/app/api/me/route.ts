import { NextResponse } from "next/server";
import { jsonError, requireUser } from "@/lib/session";

export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json({ user });
  } catch (error) {
    return jsonError(error);
  }
}
