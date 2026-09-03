import { NextRequest, NextResponse } from "next/server";
import { jsonError, requirePermission } from "@/lib/session";
import { createProject } from "@/modules/real-estate/service";

export async function POST(request: NextRequest) {
  try {
    const actor = await requirePermission("campaign.write");
    const project = await createProject(actor.id, await request.json());
    return NextResponse.json({ project });
  } catch (error) {
    return jsonError(error);
  }
}
