import { NextRequest, NextResponse } from "next/server";
import { jsonError, requirePermission } from "@/lib/session";
import { changeStatus } from "@/modules/leads/service";
import { z } from "zod";
import { requiredId } from "@/lib/ids";

const schema = z.object({
  statusId: requiredId("a status"),
  reason: z.string().trim().max(400).optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requirePermission("lead.write");
    const { id } = await context.params;
    const body = schema.parse(await request.json());
    const lead = await changeStatus(actor, id, body.statusId, body.reason);
    return NextResponse.json({ lead });
  } catch (error) {
    return jsonError(error);
  }
}
