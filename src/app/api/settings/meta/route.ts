import { NextRequest, NextResponse } from "next/server";
import { jsonError, requirePermission } from "@/lib/session";
import { saveMetaConfig } from "@/modules/meta/service";

export async function PATCH(request: NextRequest) {
  try {
    const actor = await requirePermission("settings.write");
    const meta = await saveMetaConfig(actor, await request.json());
    return NextResponse.json({ meta });
  } catch (error) {
    return jsonError(error);
  }
}
