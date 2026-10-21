import type { AuthUser } from "@/lib/rbac";
import { canDeleteRecords } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { HttpError } from "@/lib/session";
import { leadScopeWhere } from "@/lib/scope";
import { canApprove } from "@/lib/approvals";
import { ensureOpsTables } from "@/lib/ops-tables";
import { setLeadActiveFlag } from "@/lib/lead-active";
import { LIFECYCLE_ENTITIES, type LifecycleEntity } from "@/modules/lifecycle/types";

export { LIFECYCLE_ENTITIES, type LifecycleEntity };

export async function setRecordActive(
  actor: AuthUser,
  entity: LifecycleEntity,
  id: string,
  active: boolean,
) {
  await ensureOpsTables();
  if (entity === "client") {
    const row = await prisma.client.update({ where: { id }, data: { isActive: active } });
    await writeAudit({
      userId: actor.id,
      action: active ? "client.activated" : "client.deactivated",
      entityType: "client",
      entityId: id,
    });
    return row;
  }
  if (entity === "campaign") {
    const row = await prisma.campaign.update({ where: { id }, data: { isActive: active } });
    await writeAudit({
      userId: actor.id,
      action: active ? "campaign.activated" : "campaign.deactivated",
      entityType: "campaign",
      entityId: id,
    });
    return row;
  }
  if (entity === "engagement" || entity === "project") {
    const status = active ? "OPEN" : "ON_HOLD";
    await prisma.$executeRaw`
      UPDATE engagements SET is_active = ${active}, status = ${status} WHERE id = ${id}
    `;
    await prisma.engagement.update({ where: { id }, data: { status } }).catch(() => undefined);
    await writeAudit({
      userId: actor.id,
      action: active ? "engagement.activated" : "engagement.deactivated",
      entityType: "engagement",
      entityId: id,
    });
    return prisma.engagement.findUnique({ where: { id } });
  }
  if (entity === "lead") {
    const scope = await leadScopeWhere(actor, { includeDeleted: true });
    const existing = await prisma.lead.findFirst({ where: { id, AND: [scope] } });
    if (!existing) throw new HttpError(404, "Lead not found", "NOT_FOUND");
    await setLeadActiveFlag(id, active);
    const row = await prisma.lead.findUnique({ where: { id } });
    await writeAudit({
      userId: actor.id,
      action: active ? "lead.activated" : "lead.deactivated",
      entityType: "lead",
      entityId: id,
    });
    return row;
  }
  if (id === actor.id) throw new HttpError(400, "You cannot deactivate your own account", "FORBIDDEN");
  const target = await prisma.user.findUnique({ where: { id }, include: { role: true } });
  if (!target) throw new HttpError(404, "Employee not found", "NOT_FOUND");
  if (target.role.key === "super_admin" && actor.roleKey !== "super_admin") {
    throw new HttpError(403, "Cannot change a super admin", "FORBIDDEN");
  }
  if (!active && !(await canApprove(actor, "people")) && !canDeleteRecords(actor)) {
    throw new HttpError(403, "Not allowed to deactivate this person", "FORBIDDEN");
  }
  const row = await prisma.user.update({
    where: { id },
    data: { isActive: active },
  });
  if (active) {
    await prisma.$executeRaw`UPDATE "user" SET approval_status = 'APPROVED' WHERE id = ${id}`.catch(() => undefined);
  } else {
    await prisma.session.deleteMany({ where: { userId: id } }).catch(() => undefined);
  }
  await writeAudit({
    userId: actor.id,
    action: active ? "user.activated" : "user.deactivated",
    entityType: "user",
    entityId: id,
  });
  return row;
}
