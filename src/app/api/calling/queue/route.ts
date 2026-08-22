import { NextResponse } from "next/server";
import { jsonError, requirePermission } from "@/lib/session";
import { listCallingQueue } from "@/modules/calling/service";

export async function GET() {
  try {
    const actor = await requirePermission("lead.read");
    const leads = await listCallingQueue(actor);
    return NextResponse.json({ leads });
  } catch (error) {
    return jsonError(error);
  }
}
