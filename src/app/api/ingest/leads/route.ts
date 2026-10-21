import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError, HttpError } from "@/lib/session";
import { createLeadWithDuplicateInfo } from "@/modules/leads/service";
import type { AuthUser } from "@/lib/rbac";

export async function POST(request: NextRequest) {
  try {
    const setting = await prisma.setting.findUnique({ where: { key: "ingest" } });
    const expected =
      setting && typeof setting.value === "object" && setting.value && "key" in setting.value
        ? String((setting.value as { key?: string }).key ?? "")
        : process.env.LEAD_INGEST_KEY ?? "";
    const provided = request.headers.get("x-ingest-key") ?? "";
    if (!expected || provided !== expected) {
      throw new HttpError(401, "Invalid ingest key", "UNAUTHORIZED");
    }
    const actorUser = await prisma.user.findFirst({
      where: { isActive: true, role: { key: "super_admin" } },
    });
    if (!actorUser) throw new HttpError(500, "No ingest actor", "NO_ACTOR");
    const actor: AuthUser = {
      id: actorUser.id,
      name: actorUser.name,
      email: actorUser.email,
      roleKey: "super_admin",
      roleName: "Super Admin",
      permissions: [],
      isActive: true,
      clientId: actorUser.clientId,
    };
    const body = await request.json();
    const lead = await createLeadWithDuplicateInfo(actor, {
      ...body,
      captureChannel: body.captureChannel ?? body.sourcePlatform ?? "website",
      assignedUserId: body.assignedUserId || actor.id,
    });
    return NextResponse.json({ lead }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
