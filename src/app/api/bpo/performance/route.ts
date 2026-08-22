import { NextRequest, NextResponse } from "next/server";
import { jsonError, requirePermission } from "@/lib/session";
import { listCallerPerformance } from "@/modules/bpo/service";

export async function GET(request: NextRequest) {
  try {
    const actor = await requirePermission("lead.read");
    const q = request.nextUrl.searchParams.get("q") ?? "";
    const callers = await listCallerPerformance(actor, q);
    return NextResponse.json({ callers });
  } catch (error) {
    return jsonError(error);
  }
}
