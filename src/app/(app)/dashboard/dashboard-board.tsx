import { formatInr } from "@/lib/money";

type Filters = {
  from: string;
  to: string;
  clientId: string;
  campaignId: string;
  industryId: string;
  sourceId: string;
};

export function DashboardBoard({
  kpis,
  ops,
  funnel,
  trend,
  calls,
  sources,
  campaigns,
  executives,
  filters,
  clients,
  campaignOptions,
  industries,
  sourcesOptions,
}: {
  kpis: {
    leads: number;
    newCount: number;
    assigned: number;
    contacted: number;
    qualified: number;
    hot: number;
    visits: number;
    won: number;
    lost: number;
    revenue: number;
    spend: number;
    cpl: number;
    conversionRate: number;
    roi: number;
  };
  ops: { followupsToday: number; overdueFollowups: number; slaAssign: number; slaCall: number };
  funnel: Array<{ key: string; label: string; count: number; pct: number; drop: number }>;
  trend: Array<{ date: string; count: number }>;
  calls: Array<{ date: string; calls: number; connected: number }>;
  sources: Array<{ name: string; leads: number; revenue: number }>;
  campaigns: Array<{
    id: string;
    name: string;
    client: string;
    leads: number;
    spend: number;
    revenue: number;
    cpl: number;
    roi: number;
  }>;
  executives: Array<{
    id: string;
    name: string;
    leadsAssigned: number;
    callsMade: number;
    connectedCalls: number;
    closedWon: number;
    conversionRate: number;
    revenue: number;
  }>;
  filters: Filters;
  clients: Array<{ id: string; name: string }>;
  campaignOptions: Array<{ id: string; name: string }>;
  industries: Array<{ id: string; name: string }>;
  sourcesOptions: Array<{ id: string; name: string }>;
}) {
  const maxTrend = Math.max(1, ...trend.map((r) => r.count));
  const maxCalls = Math.max(1, ...calls.map((r) => r.calls));
  const maxFunnel = Math.max(1, ...funnel.map((r) => r.count));

  return (
    <div>
      <p className="text-xs uppercase tracking-[0.18em] text-ink-soft">Today</p>
      <h1 className="mt-2 font-display text-4xl text-ink">Dashboard</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-soft">
        Volume, spend, conversion, and neglected leads across Social72 campaigns.
      </p>

      <form className="mt-6 flex flex-wrap gap-2" action="/dashboard">
        <input type="date" name="from" defaultValue={filters.from} className="h-10 rounded-md border border-line bg-white px-3 text-sm" />
        <input type="date" name="to" defaultValue={filters.to} className="h-10 rounded-md border border-line bg-white px-3 text-sm" />
        <select name="clientId" defaultValue={filters.clientId} className="h-10 rounded-md border border-line bg-white px-3 text-sm">
          <option value="">All clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select name="campaignId" defaultValue={filters.campaignId} className="h-10 rounded-md border border-line bg-white px-3 text-sm">
          <option value="">All campaigns</option>
          {campaignOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select name="industryId" defaultValue={filters.industryId} className="h-10 rounded-md border border-line bg-white px-3 text-sm">
          <option value="">All industries</option>
          {industries.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
        <select name="sourceId" defaultValue={filters.sourceId} className="h-10 rounded-md border border-line bg-white px-3 text-sm">
          <option value="">All sources</option>
          {sourcesOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button type="submit" className="h-10 rounded-md bg-ink px-4 text-sm text-white">
          Apply
        </button>
      </form>

      <dl className="mt-6 grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Leads" value={kpis.leads} />
        <Kpi label="New" value={kpis.newCount} />
        <Kpi label="Assigned" value={kpis.assigned} />
        <Kpi label="Contacted" value={kpis.contacted} />
        <Kpi label="Qualified" value={kpis.qualified} />
        <Kpi label="Hot" value={kpis.hot} />
        <Kpi label="Follow-ups today" value={ops.followupsToday} />
        <Kpi label="Overdue follow-ups" value={ops.overdueFollowups} tone={ops.overdueFollowups ? "danger" : undefined} />
        <Kpi label="Visits" value={kpis.visits} />
        <Kpi label="Closed won" value={kpis.won} />
        <Kpi label="Closed lost" value={kpis.lost} />
        <Kpi label="Revenue" value={`₹${formatInr(kpis.revenue)}`} />
        <Kpi label="Spend" value={`₹${formatInr(kpis.spend)}`} />
        <Kpi label="CPL" value={`₹${formatInr(kpis.cpl)}`} />
        <Kpi label="Conversion" value={`${kpis.conversionRate}%`} />
        <Kpi label="ROI" value={`${kpis.roi}%`} />
        <Kpi label="Assign SLA" value={ops.slaAssign} tone={ops.slaAssign ? "danger" : undefined} />
        <Kpi label="First-call SLA" value={ops.slaCall} tone={ops.slaCall ? "danger" : undefined} />
      </dl>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <Panel title="Lead generation (14 days)">
          <Bars items={trend.map((r) => ({ label: r.date.slice(5), value: r.count }))} max={maxTrend} />
        </Panel>
        <Panel title="Daily calls">
          <Bars
            items={calls.map((r) => ({ label: r.date.slice(5), value: r.calls, secondary: r.connected }))}
            max={maxCalls}
          />
        </Panel>
        <Panel title="Funnel">
          <ul className="space-y-2">
            {funnel.map((step) => (
              <li key={step.key}>
                <div className="flex justify-between text-xs text-ink-soft">
                  <span>{step.label}</span>
                  <span>
                    {step.count} · {step.pct}%
                    {step.drop ? ` · drop ${step.drop}%` : ""}
                  </span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-paper-2">
                  <div className="h-2 rounded-full bg-pine" style={{ width: `${Math.round((step.count / maxFunnel) * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Source performance">
          <SimpleTable
            headers={["Source", "Leads", "Revenue"]}
            rows={sources.slice(0, 8).map((s) => [s.name, String(s.leads), `₹${formatInr(s.revenue)}`])}
          />
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title="Campaign ROI">
          <SimpleTable
            headers={["Campaign", "Leads", "CPL", "ROI"]}
            rows={campaigns.slice(0, 8).map((c) => [c.name, String(c.leads), `₹${formatInr(c.cpl)}`, `${c.roi}%`])}
          />
        </Panel>
        <Panel title="BPO leaderboard">
          <SimpleTable
            headers={["Executive", "Calls", "Won", "Conv"]}
            rows={executives.map((e) => [e.name, String(e.callsMade), String(e.closedWon), `${e.conversionRate}%`])}
          />
        </Panel>
      </div>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string | number; tone?: "danger" }) {
  return (
    <div className="rounded-lg border border-line bg-white px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.14em] text-ink-soft">{label}</p>
      <p className={`mt-1 font-display text-2xl ${tone === "danger" ? "text-danger" : "text-ink"}`}>{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-white p-4">
      <h2 className="text-sm font-medium text-ink">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Bars({
  items,
  max,
}: {
  items: Array<{ label: string; value: number; secondary?: number }>;
  max: number;
}) {
  return (
    <div className="flex h-40 items-end gap-1">
      {items.map((item) => (
        <div key={item.label} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
          <div
            className="w-full rounded-t bg-copper"
            style={{ height: `${Math.max(4, Math.round((item.value / max) * 140))}px` }}
            title={`${item.label}: ${item.value}`}
          />
          <span className="w-full truncate text-center text-[9px] text-ink-soft">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function SimpleTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  if (rows.length === 0) return <p className="text-sm text-ink-soft">No data in this filter.</p>;
  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="text-xs uppercase tracking-wide text-ink-soft">
          {headers.map((h) => (
            <th key={h} className="pb-2 font-medium">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="border-t border-line">
            {row.map((cell, j) => (
              <td key={j} className="py-2">
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
