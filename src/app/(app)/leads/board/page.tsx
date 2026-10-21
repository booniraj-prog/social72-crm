import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthUser } from "@/lib/session";
import { listLeads } from "@/modules/leads/service";
import type { LeadRow } from "@/modules/leads/types";

export default async function LeadKanbanPage() {
  const actor = await getAuthUser();
  if (!actor) redirect("/login");
  const result = await listLeads(actor, { pageSize: "200", page: "1" });
  const leads = result.leads as LeadRow[];
  const columns = new Map<string, LeadRow[]>();
  for (const lead of leads) {
    const key = lead.status.name;
    const list = columns.get(key) ?? [];
    list.push(lead);
    columns.set(key, list);
  }

  return (
    <div>
      <Link href="/leads" className="text-xs text-ink-soft hover:text-ink">
        ← List
      </Link>
      <h1 className="mt-2 font-display text-4xl text-ink">Lead pipeline</h1>
      <p className="mt-2 text-sm text-ink-soft">Existing statuses, unchanged workflow — board view only.</p>
      <div className="mt-6 flex gap-3 overflow-x-auto pb-4">
        {[...columns.entries()].map(([name, leads]) => (
          <section key={name} className="w-64 shrink-0 rounded-lg border border-line bg-white p-3">
            <h2 className="text-sm font-medium text-ink">
              {name} <span className="text-ink-soft">({leads.length})</span>
            </h2>
            <ul className="mt-3 space-y-2">
              {leads.map((lead) => (
                <li key={lead.id}>
                  <Link href={`/leads/${lead.id}`} className="block rounded-md border border-line px-3 py-2 hover:bg-paper">
                    <p className="text-sm font-medium">{lead.fullName}</p>
                    <p className="text-xs text-ink-soft">
                      {lead.client.name} · {lead.temperature} · {lead.leadScore}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
