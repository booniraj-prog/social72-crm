import { NextRequest, NextResponse } from "next/server";
import { jsonError, requirePermission } from "@/lib/session";
import { listRealEstateInventory } from "@/modules/real-estate/service";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("lead.read");
    const clientId = request.nextUrl.searchParams.get("clientId") ?? undefined;
    const inventory = await listRealEstateInventory(clientId || undefined);
    return NextResponse.json(inventory);
  } catch (error) {
    return jsonError(error);
  }
}
