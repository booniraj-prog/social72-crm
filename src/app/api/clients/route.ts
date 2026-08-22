import { NextRequest, NextResponse } from "next/server";
import { jsonError, requirePermission } from "@/lib/session";
import { createClient, listClients } from "@/modules/clients/service";

export async function GET() {
  try {
    await requirePermission("client.read");
    const clients = await listClients();
    return NextResponse.json({ clients });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requirePermission("client.write");
    const body = await request.json();
    const client = await createClient(actor.id, body);
    return NextResponse.json({ client }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
