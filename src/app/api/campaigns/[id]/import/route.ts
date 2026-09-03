import { NextRequest, NextResponse } from "next/server";
import { jsonError, requirePermission } from "@/lib/session";
import { importCampaignLeads } from "@/modules/campaigns/service";
import { z } from "zod";

const schema = z.object({
  rows: z
    .array(
      z.object({
        fullName: z.string().optional(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        mobile: z.string().optional(),
        email: z.string().optional(),
        city: z.string().optional(),
      }),
    )
    .min(1)
    .max(500),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requirePermission("campaign.write");
    const { id } = await context.params;
    const body = schema.parse(await request.json());
    const summary = await importCampaignLeads(actor, id, body.rows);
    return NextResponse.json(summary);
  } catch (error) {
    return jsonError(error);
  }
}
