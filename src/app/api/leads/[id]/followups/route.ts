import { NextRequest, NextResponse } from "next/server";
import { jsonError, requirePermission } from "@/lib/session";
import { scheduleFollowup } from "@/modules/leads/service";
import { z } from "zod";

const schema = z.object({
  dueAt: z.string().min(1),
  action: z.string().trim().max(200).optional(),
  kind: z.string().trim().max(40).optional(),
  meetUrl: z.string().trim().max(400).optional().or(z.literal("")),
  location: z.string().trim().max(200).optional().or(z.literal("")),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requirePermission("lead.write");
    const { id } = await context.params;
    const body = schema.parse(await request.json());
    const result = await scheduleFollowup(actor, id, body.dueAt, body.action, {
      kind: body.kind,
      meetUrl: body.meetUrl,
      location: body.location,
    });
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
