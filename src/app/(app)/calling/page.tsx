import { redirect } from "next/navigation";
import { hasAnyRole, hasPermission } from "@/lib/rbac";
import { canPickLeads } from "@/lib/scope";
import { getAuthUser } from "@/lib/session";
import { HttpError } from "@/lib/session";
import { listCallingQueue, listDispositions, callingTodayStats } from "@/modules/calling/service";
import { getLead, listAssignees, listLeadSources, listLeadStatuses } from "@/modules/leads/service";
import { CallingDesk } from "./calling-desk";
import type { LeadDetail, LeadRow } from "@/modules/leads/types";

export default async function CallingPage({
  searchParams,
}: {
  searchParams: Promise<{ leadId?: string; clientId?: string }>;
}) {
  const actor = await getAuthUser();
  if (!actor || !hasPermission(actor, "lead.read")) redirect("/dashboard");
  if (
    !hasAnyRole(actor, ["bpo_executive", "bpo_leader", "crm_manager", "sales_manager"]) &&
    actor.roleKey !== "super_admin"
  ) {
    redirect("/leads");
  }

  const { leadId, clientId: rawClientId } = await searchParams;
  const clientId = rawClientId && /^[0-9a-f-]{36}$/i.test(rawClientId) ? rawClientId : undefined;
  const [queue, statuses, sources, assignees, dispositions, stats] = await Promise.all([
    listCallingQueue(actor, clientId),
    listLeadStatuses(),
    listLeadSources(),
    listAssignees(),
    listDispositions(),
    callingTodayStats(actor, clientId),
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
    <div>
      <dl className="mb-4 grid gap-3 sm:grid-cols-5">
        {[
          ["Calling list", stats.queue],
          ["Contacted today", stats.contacted],
          ["Interested", stats.interested],
          ["Follow-up required", stats.followup],
          ["Converted", stats.converted],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-lg border border-line bg-white px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-ink-soft">{label}</p>
            <p className="mt-1 font-display text-2xl text-ink">{value}</p>
          </div>
        ))}
      </dl>
      <CallingDesk
      key={lead?.id ?? "empty"}
      queue={queue as unknown as LeadRow[]}
      lead={lead}
      canPick={canPickLeads(actor)}
      currentUserId={actor.id}
      clientId={clientId}
      options={{
        statuses,
        sources,
        assignees,
        dispositions,
        temperatures: ["HOT", "WARM", "COLD", "UNQUALIFIED"],
      }}
      />
    </div>
  );
}
