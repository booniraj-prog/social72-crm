import { NextRequest, NextResponse } from "next/server";
import { jsonError, requirePermission } from "@/lib/session";
import { upsertRealEstateDetails } from "@/modules/real-estate/service";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requirePermission("lead.write");
    const { id } = await context.params;
    const details = await upsertRealEstateDetails(actor, id, await request.json());
    return NextResponse.json({ details });
  } catch (error) {
    return jsonError(error);
  }
}
