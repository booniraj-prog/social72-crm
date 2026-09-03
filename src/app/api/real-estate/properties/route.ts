import { NextRequest, NextResponse } from "next/server";
import { jsonError, requirePermission } from "@/lib/session";
import { createProperty } from "@/modules/real-estate/service";

export async function POST(request: NextRequest) {
  try {
    const actor = await requirePermission("campaign.write");
    const property = await createProperty(actor.id, await request.json());
    return NextResponse.json({ property });
  } catch (error) {
    return jsonError(error);
  }
}
