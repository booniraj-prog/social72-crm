"use client";

import { formatInr } from "@/lib/money";
import { TableFrame } from "@/components/platform/table-controls";

type ProjectRow = {
  id: string;
  name: string;
  client: string;
  budget: number;
  billed: number;
  actualAll: number;
  gross: number;
  grossPct: number;
  net: number;
  netPct: number;
};

type ClientRow = { clientId: string; client: string; billed: number; collected: number };
type CampaignRow = { id: string; name: string; client: string; budget: number; spend: number };

export function ProfitTables({
  projects,
  clients,
  campaigns,
}: {
  projects: ProjectRow[];
  clients: ClientRow[];
  campaigns: CampaignRow[];
}) {
  return (
    <>
      <section className="surface mt-4 overflow-hidden rounded-lg p-4">
        <h2 className="font-display text-xl">By project</h2>
        {projects.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">Tag a proposal to a project to see job-level margin.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <TableFrame
              rows={projects.map((row) => ({
                ...row,
                project: row.name,
              }))}
              columns={["project", "client", "budget", "billed", "actualAll", "gross", "net"]}
              labels={{ actualAll: "Actual cost" }}
              empty="Tag a proposal to a project to see job-level margin."
              renderRow={(row) => (
                <>
                  <td className="px-3 py-2">
                    {String(row.project)}
                    <p className="text-xs text-ink-soft">{String(row.client)}</p>
                  </td>
                  <td className="px-3 py-2 text-ink-soft">{String(row.client)}</td>
                  <td className="px-3 py-2">₹{formatInr(Number(row.budget))}</td>
                  <td className="px-3 py-2">₹{formatInr(Number(row.billed))}</td>
                  <td className="px-3 py-2">₹{formatInr(Number(row.actualAll))}</td>
                  <td className="px-3 py-2">
                    ₹{formatInr(Number(row.gross))}
                    <p className="text-xs text-ink-soft">{Number(row.grossPct)}%</p>
                  </td>
                  <td className="px-3 py-2">
                    ₹{formatInr(Number(row.net))}
                    <p className="text-xs text-ink-soft">{Number(row.netPct)}%</p>
                  </td>
                </>
              )}
            />
          </div>
        )}
      </section>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <section className="surface overflow-hidden rounded-lg p-4">
          <h2 className="font-display text-xl">By customer</h2>
          <div className="mt-3 overflow-x-auto">
            <TableFrame
              rows={clients.map((row) => ({ ...row, id: row.clientId }))}
              columns={["client", "billed", "collected"]}
              empty="No customer billing yet."
              renderRow={(row) => (
                <>
                  <td className="px-3 py-2">{String(row.client)}</td>
                  <td className="px-3 py-2">₹{formatInr(Number(row.billed))}</td>
                  <td className="px-3 py-2">₹{formatInr(Number(row.collected))}</td>
                </>
              )}
            />
          </div>
        </section>
        <section className="surface overflow-hidden rounded-lg p-4">
          <h2 className="font-display text-xl">Campaign spend</h2>
          <div className="mt-3 overflow-x-auto">
            <TableFrame
              rows={campaigns.map((c) => ({ ...c, campaign: c.name }))}
              columns={["campaign", "client", "budget", "spend"]}
              empty="No campaign spend yet."
              renderRow={(c) => (
                <>
                  <td className="px-3 py-2">
                    {String(c.campaign)}
                    <p className="text-xs text-ink-soft">{String(c.client)}</p>
                  </td>
                  <td className="px-3 py-2 text-ink-soft">{String(c.client)}</td>
                  <td className="px-3 py-2">₹{formatInr(Number(c.budget))}</td>
                  <td className={`px-3 py-2 ${Number(c.spend) > Number(c.budget) && Number(c.budget) > 0 ? "text-danger" : ""}`}>
                    ₹{formatInr(Number(c.spend))}
                  </td>
                </>
              )}
            />
          </div>
        </section>
      </div>
    </>
  );
}
