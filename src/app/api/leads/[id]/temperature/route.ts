import { NextRequest, NextResponse } from "next/server";
import { jsonError, requirePermission } from "@/lib/session";
import { changeTemperature } from "@/modules/leads/service";
import { z } from "zod";

const schema = z.object({
  temperature: z.enum(["HOT", "WARM", "COLD", "UNQUALIFIED"]),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requirePermission("lead.write");
    const { id } = await context.params;
    const body = schema.parse(await request.json());
    const lead = await changeTemperature(actor, id, body.temperature);
    return NextResponse.json({ lead });
  } catch (error) {
    return jsonError(error);
  }
}
