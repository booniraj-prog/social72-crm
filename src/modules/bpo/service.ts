import type { AuthUser } from "@/lib/rbac";
import { leadScopeWhere } from "@/lib/scope";
import { prisma } from "@/lib/db";

export async function listCallerPerformance(actor: AuthUser, q?: string) {
  const scope = await leadScopeWhere(actor);
  const query = q?.trim().toLowerCase() ?? "";

  const callers = await prisma.user.findMany({
    where: {
      isActive: true,
      role: { key: { in: ["bpo_executive", "bpo_leader"] } },
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: { role: { select: { key: true, name: true } } },
    orderBy: { name: "asc" },
  });

  const rows = await Promise.all(
    callers.map(async (user) => {
      const owned = { AND: [scope, { assignedUserId: user.id }] };
      const [leadsAssigned, qualified, closedWon, callsMade, connectedCalls, revenueAgg] =
        await Promise.all([
          prisma.lead.count({ where: owned }),
          prisma.lead.count({
            where: { AND: [owned, { status: { key: { in: ["QUALIFIED", "INTERESTED", "FOLLOW_UP", "CAMPUS_VISIT", "SITE_VISIT", "MEETING", "NEGOTIATION", "DOCUMENTATION", "PAYMENT_PENDING"] } } }] },
          }),
          prisma.lead.count({ where: { AND: [owned, { status: { key: "CLOSED_WON" } }] } }),
          prisma.callLog.count({
            where: { userId: user.id, lead: scope },
          }),
          prisma.callLog.count({
            where: {
              userId: user.id,
              lead: scope,
              disposition: { key: { in: ["CONNECTED", "INTERESTED", "NOT_INTERESTED", "CALL_BACK", "FOLLOW_UP_REQUIRED", "SITE_VISIT_AGREED", "CAMPUS_VISIT_AGREED", "CLOSED_WON"] } },
            },
          }),
          prisma.lead.aggregate({
            where: { AND: [owned, { status: { key: "CLOSED_WON" } }] },
            _sum: { actualRevenue: true },
          }),
        ]);
      const connectionRate = callsMade === 0 ? 0 : Math.round((connectedCalls / callsMade) * 100);
      const conversionRate = leadsAssigned === 0 ? 0 : Math.round((closedWon / leadsAssigned) * 100);
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role.name,
        leadsAssigned,
        callsMade,
        connectedCalls,
        connectionRate,
        qualified,
        closedWon,
        conversionRate,
        revenue: Number(revenueAgg._sum.actualRevenue ?? 0),
      };
    }),
  );

  return rows.sort((a, b) => b.connectedCalls - a.connectedCalls || b.leadsAssigned - a.leadsAssigned);
}
