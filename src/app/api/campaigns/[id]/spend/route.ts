import { NextRequest, NextResponse } from "next/server";
import { jsonError, requirePermission } from "@/lib/session";
import { addCampaignSpend } from "@/modules/campaigns/service";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requirePermission("campaign.write");
    const { id } = await context.params;
    const spend = await addCampaignSpend(actor, id, await request.json());
    return NextResponse.json({ spend }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
