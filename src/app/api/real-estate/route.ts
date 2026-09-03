import { NextRequest, NextResponse } from "next/server";
import { jsonError, requirePermission } from "@/lib/session";
import { listRealEstateBoard } from "@/modules/real-estate/service";

export async function GET(request: NextRequest) {
  try {
    const actor = await requirePermission("lead.read");
    const q = request.nextUrl.searchParams.get("q") ?? "";
    const statusKey = request.nextUrl.searchParams.get("statusKey") ?? "";
    const visit = request.nextUrl.searchParams.get("visit") ?? "";
    const board = await listRealEstateBoard(actor, { q, statusKey, visit });
    return NextResponse.json(board);
  } catch (error) {
    return jsonError(error);
  }
}
