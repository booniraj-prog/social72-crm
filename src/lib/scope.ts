import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { AuthUser } from "@/lib/rbac";

export async function leadScopeWhere(
  user: AuthUser,
  opts?: { includeDeleted?: boolean },
): Promise<Prisma.LeadWhereInput> {
  const base: Prisma.LeadWhereInput = opts?.includeDeleted ? {} : { deletedAt: null };

  if (user.roleKey === "super_admin" || user.roleKey === "crm_manager") {
    return base;
  }

  if (user.roleKey === "marketing_manager") {
    return base;
  }

  if (user.roleKey === "client") {
    return { ...base, clientId: user.clientId ?? "__none__" };
  }

  if (user.roleKey === "bpo_executive") {
    return {
      ...base,
      OR: [{ assignedUserId: user.id }, { assignedUserId: null }],
    };
  }

  if (user.roleKey === "bpo_leader") {
    const teams = await prisma.team.findMany({
      where: { OR: [{ leaderId: user.id }, { members: { some: { userId: user.id } } }] },
      include: { members: true },
    });
    const memberIds = new Set<string>([user.id]);
    const teamIds: string[] = [];
    for (const team of teams) {
      teamIds.push(team.id);
      for (const member of team.members) memberIds.add(member.userId);
      if (team.leaderId) memberIds.add(team.leaderId);
    }
    if (teams.length === 0) {
      return {
        ...base,
        OR: [{ assignedUserId: user.id }, { assignedUserId: null }],
      };
    }
    return {
      ...base,
      OR: [
        { assignedUserId: { in: [...memberIds] } },
        { assignedTeamId: { in: teamIds } },
        { assignedUserId: null },
      ],
    };
  }

  return { ...base, assignedUserId: user.id };
}

export function canCreateLeads(user: AuthUser) {
  return (
    user.roleKey === "super_admin" ||
    user.roleKey === "crm_manager" ||
    user.roleKey === "marketing_manager" ||
    user.roleKey === "bpo_leader"
  );
}

export function canAssignLeads(user: AuthUser) {
  return user.roleKey === "super_admin" || user.roleKey === "crm_manager" || user.roleKey === "bpo_leader";
}

export function canPickLeads(user: AuthUser) {
  return (
    user.roleKey === "bpo_executive" ||
    user.roleKey === "bpo_leader" ||
    user.roleKey === "crm_manager" ||
    user.roleKey === "super_admin"
  );
}
