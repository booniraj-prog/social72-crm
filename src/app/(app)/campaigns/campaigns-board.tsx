"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatInr } from "@/lib/money";

type CampaignRow = {
  id: string;
  name: string;
  platform: string | null;
  campaignType: string | null;
  isActive: boolean;
  budget: number;
  spend: number;
  leads: number;
  qualified: number;
  visits: number;
  won: number;
  revenue: number;
  cpl: number;
  conversionRate: number;
  roi: number;
  client: { id: string; name: string };
  industry: { name: string };
};

type Totals = {
  leads: number;
  spend: number;
  qualified: number;
  visits: number;
  won: number;
  revenue: number;
  cpl: number;
  conversionRate: number;
  roi: number;
};

export function CampaignsBoard({
  campaigns,
  totals,
  clients,
  platforms,
  types,
  canWrite,
  filters,
}: {
  campaigns: CampaignRow[];
  totals: Totals;
  clients: Array<{ id: string; name: string }>;
  platforms: readonly string[];
  types: readonly string[];
  canWrite: boolean;
  filters: { q: string; clientId: string };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-ink-soft">Marketing</p>
          <h1 className="mt-2 font-display text-4xl text-ink">Campaigns</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-soft">
            Spend, CPL, visits, and ROI against BPO conversion for every Social72 campaign.
          </p>
        </div>
        {canWrite ? (
          <button
            type="button"
            onClick={() => {
              setError("");
              setOpen(true);
            }}
            className="h-10 rounded-md bg-copper px-4 text-sm font-medium text-white"
          >
            New campaign
          </button>
        ) : null}
      </div>

      <dl className="mt-6 grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Spend" value={`₹${formatInr(totals.spend)}`} />
        <Kpi label="Leads" value={String(totals.leads)} />
        <Kpi label="CPL" value={`₹${formatInr(totals.cpl)}`} />
        <Kpi label="Qualified" value={String(totals.qualified)} />
        <Kpi label="Revenue" value={`₹${formatInr(totals.revenue)}`} />
        <Kpi label="ROI" value={`${totals.roi}%`} />
      </dl>

      <form className="mt-6 flex flex-wrap gap-2" action="/campaigns">
        <input
          name="q"
          defaultValue={filters.q}
          placeholder="Campaign or client"
          className="h-10 min-w-[200px] flex-1 rounded-md border border-line bg-white px-3 text-sm"
        />
        <select name="clientId" defaultValue={filters.clientId} className="h-10 rounded-md border border-line bg-white px-3 text-sm">
          <option value="">All clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button type="submit" className="h-10 rounded-md bg-ink px-4 text-sm text-white">
          Filter
        </button>
      </form>

      <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-white">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-paper-2 text-xs uppercase tracking-[0.12em] text-ink-soft">
            <tr>
              <th className="px-4 py-3 font-medium">Campaign</th>
              <th className="px-4 py-3 font-medium">Spend</th>
              <th className="px-4 py-3 font-medium">Leads</th>
              <th className="px-4 py-3 font-medium">CPL</th>
              <th className="px-4 py-3 font-medium">Qualified</th>
              <th className="px-4 py-3 font-medium">Visits</th>
              <th className="px-4 py-3 font-medium">Won</th>
              <th className="px-4 py-3 font-medium">Conv</th>
              <th className="px-4 py-3 font-medium">ROI</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-ink-soft" colSpan={9}>
                  No campaigns match this filter.
                </td>
              </tr>
            ) : (
              campaigns.map((row) => (
                <tr key={row.id} className="border-t border-line hover:bg-paper/60">
                  <td className="px-4 py-3">
                    <Link href={`/campaigns/${row.id}`} className="font-medium hover:underline">
                      {row.name}
                    </Link>
                    <p className="text-xs text-ink-soft">
                      {row.client.name} · {row.industry.name}
                      {row.platform ? ` · ${row.platform}` : ""}
                    </p>
                  </td>
                  <td className="px-4 py-3">₹{formatInr(row.spend)}</td>
                  <td className="px-4 py-3">{row.leads}</td>
                  <td className="px-4 py-3">₹{formatInr(row.cpl)}</td>
                  <td className="px-4 py-3">{row.qualified}</td>
                  <td className="px-4 py-3">{row.visits}</td>
                  <td className="px-4 py-3">{row.won}</td>
                  <td className="px-4 py-3">{row.conversionRate}%</td>
                  <td className="px-4 py-3">{row.roi}%</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {open ? (
        <div className="fixed inset-0 z-20 flex items-start justify-center bg-ink/40 p-4 py-10">
          <form
            className="w-full max-w-lg rounded-lg bg-paper p-6"
            onSubmit={async (e) => {
              e.preventDefault();
              setSaving(true);
              setError("");
              const data = new FormData(e.currentTarget);
              const res = await fetch("/api/campaigns", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  name: data.get("name"),
                  clientId: data.get("clientId"),
                  platform: data.get("platform"),
                  campaignType: data.get("campaignType"),
                  startDate: data.get("startDate"),
                  endDate: data.get("endDate"),
                  budget: data.get("budget") || 0,
                }),
              });
              const json = await res.json().catch(() => ({}));
              setSaving(false);
              if (!res.ok) {
                setError(json.error?.message ?? "Could not create campaign");
                return;
              }
              router.push(`/campaigns/${json.campaign.id}`);
              router.refresh();
            }}
          >
            <h2 className="font-display text-2xl">New campaign</h2>
            {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
            <div className="mt-4 grid gap-2">
              <input name="name" required placeholder="Campaign name" className="h-10 rounded-md border border-line px-3 text-sm" />
              <select name="clientId" required className="h-10 rounded-md border border-line px-3 text-sm">
                <option value="">Client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select name="platform" className="h-10 rounded-md border border-line px-3 text-sm">
                <option value="">Platform</option>
                {platforms.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <select name="campaignType" className="h-10 rounded-md border border-line px-3 text-sm">
                <option value="">Type</option>
                {types.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <input name="startDate" type="date" className="h-10 rounded-md border border-line px-3 text-sm" />
              <input name="endDate" type="date" className="h-10 rounded-md border border-line px-3 text-sm" />
              <input name="budget" placeholder="Budget" className="h-10 rounded-md border border-line px-3 text-sm" />
            </div>
            <div className="mt-4 flex gap-2">
              <button type="submit" disabled={saving} className="h-9 rounded-md bg-ink px-4 text-sm text-white">
                Create
              </button>
              <button type="button" onClick={() => setOpen(false)} className="h-9 px-3 text-sm text-ink-soft">
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-white px-4 py-3">
      <dt className="text-[10px] uppercase tracking-[0.16em] text-ink-soft">{label}</dt>
      <dd className="mt-1 font-display text-2xl text-ink">{value}</dd>
    </div>
  );
}
