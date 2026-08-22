import { NextRequest, NextResponse } from "next/server";
import { jsonError, requirePermission } from "@/lib/session";
import { updateClient } from "@/modules/clients/service";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requirePermission("client.write");
    const { id } = await context.params;
    const body = await request.json();
    const client = await updateClient(actor.id, id, body);
    return NextResponse.json({ client });
  } catch (error) {
    return jsonError(error);
  }
}
