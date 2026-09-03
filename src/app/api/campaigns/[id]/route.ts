import { NextRequest, NextResponse } from "next/server";
import { jsonError, requirePermission } from "@/lib/session";
import { updateCampaign } from "@/modules/campaigns/service";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requirePermission("campaign.write");
    const { id } = await context.params;
    const campaign = await updateCampaign(actor, id, await request.json());
    return NextResponse.json({ campaign });
  } catch (error) {
    return jsonError(error);
  }
}
