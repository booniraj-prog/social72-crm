"use client";

import Link from "next/link";
import { formatInr } from "@/lib/money";
import { ActionIcon } from "@/components/ui/action-icon";
import { TableFrame } from "@/components/platform/table-controls";

export function ReportsBoard({
  type,
  types,
  snapshot,
  rows,
  canExport,
  filters,
  clients,
  campaigns,
}: {
  type: string;
  types: Array<{ key: string; label: string }>;
  snapshot: {
    leads: number;
    won: number;
    conversionRate: number;
    revenue: number;
    spend: number;
    cpl: number;
  };
  rows: Array<Record<string, unknown>>;
  canExport: boolean;
  filters: { from: string; to: string; clientId: string; campaignId: string };
  clients: Array<{ id: string; name: string }>;
  campaigns: Array<{ id: string; name: string }>;
}) {
  const columns = rows[0] ? Object.keys(rows[0]) : [];
  const query = new URLSearchParams({
    type,
    ...(filters.from ? { from: filters.from } : {}),
    ...(filters.to ? { to: filters.to } : {}),
    ...(filters.clientId ? { clientId: filters.clientId } : {}),
    ...(filters.campaignId ? { campaignId: filters.campaignId } : {}),
  }).toString();

  const numeric = new Set(columns.filter((col) => rows.some((row) => typeof row[col] === "number")));
  const labelCol = columns.find((col) => rows.some((row) => typeof row[col] === "string")) ?? columns[0];
  const valueCol = columns.find((col) => numeric.has(col) && col !== labelCol);
  const chart = valueCol
    ? rows
        .slice(0, 8)
        .map((row) => ({
          label: String(row[labelCol] ?? "—"),
          value: Number(row[valueCol] ?? 0),
        }))
        .filter((r) => Number.isFinite(r.value))
    : [];
  const maxChart = Math.max(1, ...chart.map((c) => Math.abs(c.value)));
  const stories = [
    { label: "Leads", value: snapshot.leads, dark: false },
    { label: "Won", value: snapshot.won, dark: false },
    { label: "Conversion", value: `${snapshot.conversionRate}%`, dark: false },
    { label: "Revenue", value: `₹${formatInr(snapshot.revenue)}`, dark: true },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-ink-soft">Insight</p>
          <h1 className="mt-1 font-display text-3xl text-ink">Reports</h1>
          <p className="mt-1 max-w-xl text-sm text-ink-soft">
            Campaign, calling, collections and profit in one sheet. Export CSV when you need the file.
          </p>
        </div>
        {canExport ? <ActionIcon action="export" label="Export CSV" href={`/api/reports/export?${query}`} /> : null}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stories.map((s) => (
          <div
            key={s.label}
            className={`rounded-lg border border-line px-4 py-3 ${s.dark ? "bg-ink text-white" : "bg-white text-ink"}`}
          >
            <p className={`text-[10px] uppercase tracking-[0.14em] ${s.dark ? "text-white/70" : "text-ink-soft"}`}>
              {s.label}
            </p>
            <p className="mt-1 font-display text-2xl leading-none">{s.value}</p>
          </div>
        ))}
      </div>

      <nav className="mt-5 flex flex-wrap gap-1.5">
        {types.map((t) => (
          <Link
            key={t.key}
            href={`/reports?type=${t.key}${filters.from ? `&from=${filters.from}` : ""}${filters.to ? `&to=${filters.to}` : ""}${filters.clientId ? `&clientId=${filters.clientId}` : ""}`}
            className={`inline-flex h-8 items-center rounded-md px-3 text-sm ${
              type === t.key ? "bg-copper text-white" : "border border-line bg-white text-ink hover:bg-paper"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <form className="mt-3 flex flex-wrap items-center gap-2" action="/reports">
        <input type="hidden" name="type" value={type} />
        <input type="date" name="from" defaultValue={filters.from} className="h-9 rounded-md border border-line bg-white px-3 text-sm" />
        <input type="date" name="to" defaultValue={filters.to} className="h-9 rounded-md border border-line bg-white px-3 text-sm" />
        <select name="clientId" defaultValue={filters.clientId} className="h-9 rounded-md border border-line bg-white px-3 text-sm">
          <option value="">All clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select name="campaignId" defaultValue={filters.campaignId} className="h-9 rounded-md border border-line bg-white px-3 text-sm">
          <option value="">All campaigns</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <ActionIcon type="submit" action="apply" />
      </form>

      {chart.length > 0 ? (
        <section className="surface mt-5 rounded-lg p-4">
          <h2 className="font-display text-lg">
            {pretty(valueCol ?? "")} by {pretty(labelCol ?? "")}
          </h2>
          <div className="mt-3 space-y-2">
            {chart.map((row, i) => (
              <div key={`${row.label}-${i}`} className="grid grid-cols-[120px_1fr_auto] items-center gap-2 sm:grid-cols-[160px_1fr_auto]">
                <p className="truncate text-sm">{row.label}</p>
                <div className="h-2 overflow-hidden rounded-full bg-paper-2">
                  <div
                    className={`h-2 rounded-full ${row.value < 0 ? "bg-danger" : "bg-copper"}`}
                    style={{ width: `${Math.round((Math.abs(row.value) / maxChart) * 100)}%` }}
                  />
                </div>
                <p className="text-right text-sm font-medium">{formatCell(valueCol ?? "", row.value)}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="surface mt-5 overflow-hidden rounded-lg">
        <TableFrame
          rows={rows.slice(0, 200).map((row, i) => ({ ...row, _i: i }) as Record<string, unknown>)}
          columns={columns}
          labels={Object.fromEntries(columns.map((col) => [col, pretty(col)]))}
          empty="Nothing in this report for the selected dates."
          renderRow={(row) => (
            <>
              {columns.map((col) => (
                <td key={col} className={`px-3 py-2 whitespace-nowrap ${numeric.has(col) ? "text-right font-medium" : ""}`}>
                  {formatCell(col, (row as Record<string, unknown>)[col])}
                </td>
              ))}
            </>
          )}
        />
      </div>
      {rows.length > 200 ? <p className="mt-2 text-xs text-ink-soft">Showing first 200 rows. Download CSV for the rest.</p> : null}
    </div>
  );
}

function pretty(col: string) {
  return col
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());
}

function formatCell(col: string, value: unknown) {
  if (value == null || value === "") return "—";
  if (typeof value === "number") {
    const moneyish = /revenue|spend|amount|fee|cpl|budget|paid|outstanding/i.test(col);
    if (moneyish) return `₹${formatInr(value)}`;
    return String(value);
  }
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  return text;
}
