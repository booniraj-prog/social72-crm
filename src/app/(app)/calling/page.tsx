import { redirect } from "next/navigation";
import { hasAnyRole, hasPermission } from "@/lib/rbac";
import { canPickLeads } from "@/lib/scope";
import { getAuthUser } from "@/lib/session";
import { HttpError } from "@/lib/session";
import { listCallingQueue, listDispositions } from "@/modules/calling/service";
import { getLead, listAssignees, listLeadSources, listLeadStatuses } from "@/modules/leads/service";
import { CallingDesk } from "./calling-desk";
import type { LeadDetail, LeadRow } from "@/modules/leads/types";

export default async function CallingPage({
  searchParams,
}: {
  searchParams: Promise<{ leadId?: string }>;
}) {
  const actor = await getAuthUser();
  if (!actor || !hasPermission(actor, "lead.read")) redirect("/dashboard");
  if (
    !hasAnyRole(actor, ["bpo_executive", "bpo_leader", "crm_manager"]) &&
    actor.roleKey !== "super_admin"
  ) {
    redirect("/leads");
  }

  const { leadId } = await searchParams;
  const [queue, statuses, sources, assignees, dispositions] = await Promise.all([
    listCallingQueue(actor),
    listLeadStatuses(),
    listLeadSources(),
    listAssignees(),
    listDispositions(),
  ]);

  const selectedId = leadId || (queue[0] as { id?: string } | undefined)?.id;
  let lead: LeadDetail | null = null;
  if (selectedId) {
    try {
      lead = (await getLead(actor, selectedId)) as unknown as LeadDetail;
    } catch (error) {
      if (!(error instanceof HttpError && error.status === 404)) throw error;
    }
  }

  return (
    <CallingDesk
      key={lead?.id ?? "empty"}
      queue={queue as unknown as LeadRow[]}
      lead={lead}
      canPick={canPickLeads(actor)}
      currentUserId={actor.id}
      options={{
        statuses,
        sources,
        assignees,
        dispositions,
        temperatures: ["HOT", "WARM", "COLD", "UNQUALIFIED"],
      }}
    />
  );
}
