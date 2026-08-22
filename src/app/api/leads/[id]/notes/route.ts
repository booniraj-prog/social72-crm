import { NextRequest, NextResponse } from "next/server";
import { jsonError, requirePermission } from "@/lib/session";
import { addNote } from "@/modules/leads/service";
import { z } from "zod";

const schema = z.object({
  body: z.string().trim().min(1).max(4000),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requirePermission("lead.write");
    const { id } = await context.params;
    const body = schema.parse(await request.json());
    const note = await addNote(actor, id, body.body);
    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
