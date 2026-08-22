import { notFound, redirect } from "next/navigation";
import { hasPermission } from "@/lib/rbac";
import { canAssignLeads, canPickLeads } from "@/lib/scope";
import { getAuthUser } from "@/lib/session";
import { HttpError } from "@/lib/session";
import { getLead, listAssignees, listLeadSources, listLeadStatuses } from "@/modules/leads/service";
import { LeadWorkspace } from "./lead-workspace";
import type { LeadDetail } from "@/modules/leads/types";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await getAuthUser();
  if (!actor || !hasPermission(actor, "lead.read")) redirect("/dashboard");
  const { id } = await params;

  try {
    const [lead, statuses, sources, assignees] = await Promise.all([
      getLead(actor, id),
      listLeadStatuses(),
      listLeadSources(),
      listAssignees(),
    ]);

    return (
      <LeadWorkspace
        lead={lead as unknown as LeadDetail}
        canAssign={canAssignLeads(actor)}
        canPick={canPickLeads(actor)}
        currentUserId={actor.id}
        options={{
          statuses,
          sources,
          assignees,
          temperatures: ["HOT", "WARM", "COLD", "UNQUALIFIED"],
        }}
      />
    );
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) notFound();
    throw error;
  }
}
