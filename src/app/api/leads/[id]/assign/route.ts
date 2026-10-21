import { NextRequest, NextResponse } from "next/server";
import { jsonError, requirePermission } from "@/lib/session";
import { assignLead } from "@/modules/leads/service";
import { z } from "zod";
import { emptyToUndef } from "@/lib/ids";

const schema = z.object({
  assignedUserId: z.preprocess(emptyToUndef, z.string({ required_error: "Select an employee" }).uuid("Select an employee")),
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
