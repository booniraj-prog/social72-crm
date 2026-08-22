import { NextRequest, NextResponse } from "next/server";
import { jsonError, requirePermission } from "@/lib/session";
import { assignLead } from "@/modules/leads/service";
import { z } from "zod";

const schema = z.object({
  assignedUserId: z.string().uuid().nullable(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requirePermission("lead.assign");
    const { id } = await context.params;
    const body = schema.parse(await request.json());
    const lead = await assignLead(actor, id, body.assignedUserId);
    return NextResponse.json({ lead });
  } catch (error) {
    return jsonError(error);
  }
}
