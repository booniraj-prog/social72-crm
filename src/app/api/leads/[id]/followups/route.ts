import { NextRequest, NextResponse } from "next/server";
import { jsonError, requirePermission } from "@/lib/session";
import { scheduleFollowup } from "@/modules/leads/service";
import { z } from "zod";

const schema = z.object({
  dueAt: z.string().min(1),
  action: z.string().trim().max(200).optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requirePermission("lead.write");
    const { id } = await context.params;
    const body = schema.parse(await request.json());
    const lead = await scheduleFollowup(actor, id, body.dueAt, body.action);
    return NextResponse.json({ lead });
  } catch (error) {
    return jsonError(error);
  }
}
