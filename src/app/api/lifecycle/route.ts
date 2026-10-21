import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requirePermission } from "@/lib/session";
import { requiredId } from "@/lib/ids";
import { LIFECYCLE_ENTITIES, setRecordActive } from "@/modules/lifecycle/service";

const schema = z.object({
  entity: z.enum(LIFECYCLE_ENTITIES),
  id: requiredId("a record"),
  active: z.boolean(),
});

const PERMISSION: Record<(typeof LIFECYCLE_ENTITIES)[number], string> = {
  client: "client.write",
  campaign: "campaign.write",
  engagement: "lead.write",
  project: "lead.write",
  lead: "lead.write",
  employee: "user.read",
};

export async function POST(request: NextRequest) {
  try {
    const body = schema.parse(await request.json());
    const actor = await requirePermission(PERMISSION[body.entity]);
    const row = await setRecordActive(actor, body.entity, body.id, body.active);
    return NextResponse.json({ row });
  } catch (error) {
    return jsonError(error);
  }
}
