import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

/** Close open follow-ups and create the one next action. Lead.nextFollowupAt stays in lockstep. */
export async function replaceOpenFollowup(
  tx: Tx,
  params: {
    leadId: string;
    ownerUserId: string;
    actorId: string;
    dueAt: Date;
    action: string | null;
  },
) {
  await tx.followUp.updateMany({
    where: { leadId: params.leadId, completedAt: null },
    data: { completedAt: new Date(), completedBy: params.actorId },
  });
  await tx.followUp.create({
    data: {
      leadId: params.leadId,
      userId: params.ownerUserId,
      dueAt: params.dueAt,
      action: params.action,
    },
  });
}

export async function earliestOpenFollowup(tx: Tx, leadId: string) {
  return tx.followUp.findFirst({
    where: { leadId, completedAt: null },
    orderBy: { dueAt: "asc" },
  });
}
