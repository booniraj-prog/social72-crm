import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requirePermission } from "@/lib/session";
import { optionalId } from "@/lib/ids";
import { collapseDuplicateLeads } from "@/modules/leads/service";

const schema = z.object({
  clientId: optionalId,
});

export async function POST(request: NextRequest) {
  try {
    const actor = await requirePermission("lead.write");
    const body = schema.parse(await request.json().catch(() => ({})));
    const summary = await collapseDuplicateLeads(actor, body.clientId);
    return NextResponse.json(summary);
  } catch (error) {
    return jsonError(error);
  }
}
