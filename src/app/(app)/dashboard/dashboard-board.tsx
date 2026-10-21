import Link from "next/link";
import { formatInr } from "@/lib/money";
import { Social72Logo } from "@/components/brand/social72-logo";
import { IconChip } from "@/components/ui/icons";
import { ActionIcon } from "@/components/ui/action-icon";
import { Flame, FolderKanban, IndianRupee, Percent, PhoneCall, Timer, UserPlus, AlarmClock } from "lucide-react";

type Filters = {
  from: string;
  to: string;
  clientId: string;
  campaignId: string;
  industryId: string;
  sourceId: string;
  assignedUserId?: string;
};

const PERIODS = [
  { key: "today", label: "Today" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "quarter", label: "Quarter" },
  { key: "year", label: "Year" },
] as const;

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
  platform,
  people = [],
  period = "month",
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
  platform?: {
    openTasks: number;
    overdueTasks: number;
    outstanding: number;
    pendingExpenses: number;
    openPurchases: number;
    licensesExpiring: number;
    licensesExpired: number;
    activeProjects?: number;
    dueProjects?: number;
    overdueDeliverables?: number;
    pendingDeliverables?: number;
    activeCustomers?: number;
    monthlyExpenses?: number;
    monthlyRevenue?: number;
    overdueCollections?: number;
  };
  people?: Array<{ id: string; name: string }>;
  period?: string;
}) {
  const maxTrend = Math.max(1, ...trend.map((r) => r.count));
  const maxCalls = Math.max(1, ...calls.map((r) => r.calls));
  const maxFunnel = Math.max(1, ...funnel.map((r) => r.count));
  const maxSource = Math.max(1, ...sources.map((s) => s.leads));
  const query = new URLSearchParams(
    Object.fromEntries(
      Object.entries({
        period,
        from: filters.from,
        to: filters.to,
        clientId: filters.clientId,
        campaignId: filters.campaignId,
        industryId: filters.industryId,
        sourceId: filters.sourceId,
        assignedUserId: filters.assignedUserId ?? "",
      }).filter(([, v]) => v),
    ),
  ).toString();
  const withQ = (path: string) => (query ? `${path}${path.includes("?") ? "&" : "?"}${query}` : path);
  const profit = kpis.revenue - kpis.spend;
  const selectClass = "h-9 rounded-md border border-line bg-white px-3 text-sm";

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Social72Logo className="h-6" />
          <h1 className="mt-2 font-display text-3xl text-ink">Social72 pulse</h1>
          <p className="mt-1 max-w-lg text-sm text-ink-soft">
            Clients, projects, ad campaigns, calling, collections and Social72 profit. Work queues live on Today.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1 rounded-md border border-line bg-white p-0.5">
          {PERIODS.map((item) => (
            <a
              key={item.key}
              href={`/dashboard?period=${item.key}`}
              className={`inline-flex h-8 items-center rounded px-3 text-sm ${
                period === item.key ? "bg-ink text-white" : "text-ink-soft hover:text-ink"
              }`}
            >
              {item.label}
            </a>
          ))}
        </div>
      </div>

      <form className="mt-4 flex flex-wrap items-center gap-2" action="/dashboard">
        <input type="hidden" name="period" value={period} />
        <select name="clientId" defaultValue={filters.clientId} className={selectClass}>
          <option value="">All clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select name="industryId" defaultValue={filters.industryId} className={selectClass}>
          <option value="">All pipelines</option>
          {industries.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
        <select name="sourceId" defaultValue={filters.sourceId} className={selectClass}>
          <option value="">All sources</option>
          {sourcesOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select name="assignedUserId" defaultValue={filters.assignedUserId ?? ""} className={selectClass}>
          <option value="">All owners</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select name="campaignId" defaultValue={filters.campaignId} className={selectClass}>
          <option value="">All campaigns</option>
          {campaignOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <ActionIcon type="submit" action="apply" />
      </form>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Hero href="/leads" label="New enquiries" value={kpis.newCount} hint={`${kpis.leads} leads in range`} tone="copper" icon={UserPlus} />
        <Hero
          href="/follow-ups?bucket=overdue"
          label="Needs follow-up"
          value={ops.overdueFollowups}
          hint={`${ops.followupsToday} due today`}
          tone={ops.overdueFollowups ? "danger" : "pine"}
          icon={AlarmClock}
        />
        <Hero href="/reports?type=campaigns" label="Win rate" value={`${kpis.conversionRate}%`} hint={`${kpis.won} won · ${kpis.lost} lost`} tone="pine" icon={Percent} />
        <Hero href="/profit" label="Social72 profit" value={`₹${formatInr(profit)}`} hint={`Outstanding ₹${formatInr(platform?.outstanding ?? 0)}`} tone="ink" icon={IndianRupee} />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Mini href="/calling" label="Calls connected" value={kpis.contacted} icon={PhoneCall} tone="info" />
        <Mini href="/leads?temperature=HOT" label="Hot leads" value={kpis.hot} icon={Flame} tone="copper" />
        <Mini href="/invoices" label="Open collections" value={platform?.overdueCollections ?? 0} warn={(platform?.overdueCollections ?? 0) > 0} icon={IndianRupee} tone="gold" />
        <Mini href="/engagements" label="Active projects" value={platform?.activeProjects ?? 0} icon={FolderKanban} tone="pine" />
        <Mini href="/licenses" label="Licenses expiring" value={platform?.licensesExpiring ?? 0} warn={(platform?.licensesExpiring ?? 0) > 0} icon={Timer} tone="gold" />
      </div>

      <div className="mt-5 grid gap-3 xl:grid-cols-5">
        <section className="surface overflow-hidden rounded-lg p-4 xl:col-span-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg text-ink">Leads vs calls</h2>
            <p className="text-xs text-ink-soft">Copper leads · pine calls</p>
          </div>
          <div className="mt-5 flex h-36 items-end gap-1">
            {trend.map((row, i) => {
              const call = calls[i]?.calls ?? 0;
              return (
                <div key={row.date} className="flex min-w-0 flex-1 items-end justify-center gap-0.5">
                  <div
                    className="w-[46%] rounded-t-md bg-copper/90"
                    style={{ height: `${Math.max(6, Math.round((row.count / maxTrend) * 128))}px` }}
                    title={`${row.date}: ${row.count} leads`}
                  />
                  <div
                    className="w-[46%] rounded-t-md bg-pine/80"
                    style={{ height: `${Math.max(6, Math.round((call / maxCalls) * 128))}px` }}
                    title={`${row.date}: ${call} calls`}
                  />
                </div>
              );
            })}
          </div>
        </section>
        <section className="overflow-hidden rounded-lg bg-ink p-4 text-white xl:col-span-2">
          <h2 className="font-display text-lg text-white">Pipeline</h2>
          <ul className="mt-4 space-y-3">
            {funnel.slice(0, 6).map((step) => (
              <li key={step.key}>
                <div className="flex justify-between text-xs text-sidebar-muted">
                  <span>{step.label}</span>
                  <span>
                    {step.count} · {step.pct}%
                  </span>
                </div>
                <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-2.5 rounded-full bg-gradient-to-r from-copper to-gold"
                    style={{ width: `${Math.round((step.count / maxFunnel) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        <section className="surface rounded-lg p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg text-ink">Lead sources</h2>
            <Link href={withQ("/reports?type=source")} className="text-xs text-copper">
              Report
            </Link>
          </div>
          <ul className="mt-3 space-y-3">
            {sources.slice(0, 6).map((s) => (
              <li key={s.name}>
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{s.name}</span>
                  <span className="text-ink-soft">
                    {s.leads} · ₹{formatInr(s.revenue)}
                  </span>
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-paper-2">
                  <div className="h-2 rounded-full bg-pine" style={{ width: `${Math.round((s.leads / maxSource) * 100)}%` }} />
                </div>
              </li>
            ))}
            {sources.length === 0 ? <p className="text-sm text-ink-soft">No source mix in this filter.</p> : null}
          </ul>
        </section>
        <section className="surface rounded-lg p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg text-ink">Campaigns that pay</h2>
            <Link href="/campaigns" className="text-xs text-copper">
              Campaigns
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {campaigns.slice(0, 5).map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-md bg-paper px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-ink-soft">
                    {c.leads} leads · CPL ₹{formatInr(c.cpl)}
                  </p>
                </div>
                <p className={`font-display text-xl ${c.roi < 0 ? "text-danger" : "text-pine"}`}>{c.roi}%</p>
              </div>
            ))}
            {campaigns.length === 0 ? <p className="text-sm text-ink-soft">No campaign spend in range.</p> : null}
          </div>
        </section>
      </div>

      <section className="surface mt-5 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg text-ink">Floor conversion</h2>
          <Link href="/reports?type=bpo" className="text-xs text-copper">
            Calling report
          </Link>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {executives.slice(0, 4).map((e) => (
            <div key={e.id} className="rounded-md border border-line bg-paper px-3 py-3">
              <p className="text-sm font-medium text-ink">{e.name}</p>
              <p className="mt-1 font-display text-2xl leading-none text-pine">{e.conversionRate}%</p>
              <p className="mt-1 text-xs text-ink-soft">
                {e.callsMade} calls · {e.closedWon} won
              </p>
            </div>
          ))}
          {executives.length === 0 ? <p className="text-sm text-ink-soft">No floor activity in this filter.</p> : null}
        </div>
      </section>
    </div>
  );
}

function Hero({
  href,
  label,
  value,
  hint,
  tone,
  icon: Icon,
}: {
  href: string;
  label: string;
  value: string | number;
  hint: string;
  tone: "copper" | "pine" | "ink" | "danger";
  icon: typeof UserPlus;
}) {
  const tones = {
    copper: "from-copper to-copper-dark",
    pine: "from-pine to-[#13463c]",
    ink: "from-ink to-[#071217]",
    danger: "from-danger to-[#7a160f]",
  };
  return (
    <Link href={href} className={`rounded-xl bg-gradient-to-br ${tones[tone]} px-4 py-4 text-white shadow-sm`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] uppercase tracking-[0.16em] text-white/80">{label}</p>
        <Icon className="h-4 w-4 text-white/80" strokeWidth={1.9} />
      </div>
      <p className="mt-1.5 font-display text-3xl leading-none text-white">{value}</p>
      <p className="mt-2 text-xs text-white/85">{hint}</p>
    </Link>
  );
}

function Mini({
  href,
  label,
  value,
  warn,
  icon,
  tone,
}: {
  href: string;
  label: string;
  value: number;
  warn?: boolean;
  icon: typeof UserPlus;
  tone: "copper" | "pine" | "gold" | "info";
}) {
  return (
    <Link href={href} className="surface flex items-center gap-3 rounded-xl px-4 py-3">
      <IconChip icon={icon} tone={warn ? "danger" : tone} />
      <div>
        <p className="text-[10px] uppercase tracking-[0.14em] text-ink-soft">{label}</p>
        <p className={`mt-0.5 font-display text-2xl leading-none ${warn ? "text-danger" : "text-ink"}`}>{value}</p>
      </div>
    </Link>
  );
}
