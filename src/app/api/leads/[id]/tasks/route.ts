import { NextRequest, NextResponse } from "next/server";
import { jsonError, requirePermission } from "@/lib/session";
import { addTask } from "@/modules/calling/service";
import { z } from "zod";

const schema = z.object({
  title: z.string().trim().min(1).max(200),
  dueAt: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requirePermission("lead.write");
    const { id } = await context.params;
    const body = schema.parse(await request.json());
    const task = await addTask(actor, id, body.title, body.dueAt);
    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
