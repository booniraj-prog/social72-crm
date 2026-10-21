import { redirect } from "next/navigation";
import { canDeleteRecords, canCreateProposal, canTagProposal } from "@/lib/rbac";
import { canApprove } from "@/lib/approvals";
import { getAuthUser } from "@/lib/session";
import { listClients } from "@/modules/clients/service";
import { listEngagements, listProposals } from "@/modules/platform/service";
import { ProposalBoard } from "./proposal-board";

export default async function ProposalsPage() {
  const actor = await getAuthUser();
  if (!actor) redirect("/login");
  const [clients, proposals, projects, approver] = await Promise.all([
    listClients(),
    listProposals(),
    listEngagements(),
    canApprove(actor, "proposal"),
  ]);
  return (
    <ProposalBoard
      canDelete={canDeleteRecords(actor)}
      canCreate={canCreateProposal(actor)}
      canTag={canTagProposal(actor)}
      canApprove={approver}
      clients={clients.map((c) => ({
        id: c.id,
        name: c.name,
        gstin: c.gstin,
        contactName: c.contactName,
      }))}
      projects={projects
        .filter((p) => p.approvalStatus !== "PENDING" && p.approvalStatus !== "REJECTED")
        .map((p) => ({
        id: p.id,
        name: p.name,
        clientId: p.clientId,
        client: p.client.name,
      }))}
      proposals={proposals}
    />
  );
}
