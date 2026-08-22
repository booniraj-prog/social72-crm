import { NextRequest, NextResponse } from "next/server";
import { jsonError, requirePermission } from "@/lib/session";
import { createCampaign, listCampaigns } from "@/modules/campaigns/service";

export async function GET(request: NextRequest) {
  try {
    await requirePermission("lead.read");
    const clientId = request.nextUrl.searchParams.get("clientId") ?? undefined;
    const campaigns = await listCampaigns(clientId);
    return NextResponse.json({ campaigns });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requirePermission("campaign.write");
    const body = await request.json();
    const campaign = await createCampaign(actor, body);
    return NextResponse.json({ campaign }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
