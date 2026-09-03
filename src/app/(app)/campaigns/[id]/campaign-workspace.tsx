"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatInr } from "@/lib/money";
import { toIstDateInput } from "@/lib/time";
import { CAMPAIGN_TYPES, PLATFORMS } from "@/modules/insights/constants";

type Detail = {
  campaign: {
    id: string;
    name: string;
    platform: string | null;
    campaignType: string | null;
    startDate: string | Date | null;
    endDate: string | Date | null;
    budget: number;
    actualSpend: number;
    isActive: boolean;
    client: { id: string; name: string };
    industry: { name: string };
    owner: { name: string } | null;
    spend: Array<{ id: string; spendDate: string; amount: number; platform: string | null; notes: string | null }>;
  };
  kpis: {
    leads: number;
    valid: number;
    qualified: number;
    visits: number;
    won: number;
    revenue: number;
    spend: number;
    cpl: number;
    cpql: number;
    costPerVisit: number;
    cpa: number;
    conversionRate: number;
    roi: number;
    roas: number;
  };
  utm: Array<{ source: string; medium: string; campaign: string; leads: number }>;
};

export function CampaignWorkspace({ detail, canWrite }: { detail: Detail; canWrite: boolean }) {
  const router = useRouter();
  const c = detail.campaign;
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [csv, setCsv] = useState("");
  const [importResult, setImportResult] = useState("");

  async function post(path: string, body: unknown, method = "POST") {
    setBusy(path);
    setError("");
    const res = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    setBusy("");
    if (!res.ok) {
      setError(json.error?.message ?? "Action failed");
      return null;
    }
    router.refresh();
    return json;
  }

  return (
    <div>
      <Link href="/campaigns" className="text-xs text-ink-soft hover:text-ink">
        ← Campaigns
      </Link>
      <h1 className="mt-2 font-display text-4xl text-ink">{c.name}</h1>
      <p className="mt-1 text-sm text-ink-soft">
        {c.client.name} · {c.industry.name}
        {c.owner ? ` · ${c.owner.name}` : ""}
      </p>
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

      <dl className="mt-6 grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Spend" value={`₹${formatInr(detail.kpis.spend)}`} />
        <Kpi label="Leads" value={String(detail.kpis.leads)} />
        <Kpi label="CPL" value={`₹${formatInr(detail.kpis.cpl)}`} />
        <Kpi label="CPQL" value={`₹${formatInr(detail.kpis.cpql)}`} />
        <Kpi label="CPA" value={`₹${formatInr(detail.kpis.cpa)}`} />
        <Kpi label="ROI" value={`${detail.kpis.roi}%`} />
      </dl>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        {canWrite ? (
          <form
            className="rounded-lg border border-line bg-white p-5"
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              void post(
                `/api/campaigns/${c.id}`,
                {
                  name: data.get("name"),
                  platform: data.get("platform"),
                  campaignType: data.get("campaignType"),
                  startDate: data.get("startDate"),
                  endDate: data.get("endDate"),
                  budget: data.get("budget"),
                  isActive: data.get("isActive") === "on",
                },
                "PATCH",
              );
            }}
          >
            <h2 className="text-xs uppercase tracking-[0.16em] text-ink-soft">Campaign</h2>
            <div className="mt-3 grid gap-2">
              <input name="name" defaultValue={c.name} className="h-10 rounded-md border border-line px-3 text-sm" />
              <select name="platform" defaultValue={c.platform ?? ""} className="h-10 rounded-md border border-line px-3 text-sm">
                <option value="">Platform</option>
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <select name="campaignType" defaultValue={c.campaignType ?? ""} className="h-10 rounded-md border border-line px-3 text-sm">
                <option value="">Type</option>
                {CAMPAIGN_TYPES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <input name="startDate" type="date" defaultValue={toIstDateInput(c.startDate)} className="h-10 rounded-md border border-line px-3 text-sm" />
              <input name="endDate" type="date" defaultValue={toIstDateInput(c.endDate)} className="h-10 rounded-md border border-line px-3 text-sm" />
              <input name="budget" defaultValue={c.budget} className="h-10 rounded-md border border-line px-3 text-sm" />
              <label className="text-sm">
                <input name="isActive" type="checkbox" defaultChecked={c.isActive} className="mr-2" />
                Active
              </label>
              <button disabled={!!busy} className="h-9 rounded-md bg-ink text-sm text-white">
                Save campaign
              </button>
            </div>
          </form>
        ) : null}

        <div className="rounded-lg border border-line bg-white p-5">
          <h2 className="text-xs uppercase tracking-[0.16em] text-ink-soft">Marketing spend</h2>
          {canWrite ? (
            <form
              className="mt-3 grid gap-2 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                void post(`/api/campaigns/${c.id}/spend`, {
                  spendDate: data.get("spendDate"),
                  amount: data.get("amount"),
                  platform: data.get("platform"),
                  notes: data.get("notes"),
                });
                e.currentTarget.reset();
              }}
            >
              <input name="spendDate" type="date" required className="h-10 rounded-md border border-line px-3 text-sm" />
              <input name="amount" required placeholder="Amount" className="h-10 rounded-md border border-line px-3 text-sm" />
              <input name="platform" placeholder="Platform" className="h-10 rounded-md border border-line px-3 text-sm" />
              <input name="notes" placeholder="Notes" className="h-10 rounded-md border border-line px-3 text-sm" />
              <button disabled={!!busy} className="h-9 rounded-md bg-ink text-sm text-white sm:col-span-2">
                Add spend
              </button>
            </form>
          ) : null}
          <ul className="mt-4 space-y-2 text-sm">
            {c.spend.length === 0 ? (
              <li className="text-ink-soft">No spend lines yet. Seeded actual spend still counts in KPIs.</li>
            ) : (
              c.spend.map((s) => (
                <li key={s.id} className="flex justify-between border-b border-line py-1">
                  <span>
                    {toIstDateInput(s.spendDate)} · {s.platform ?? "—"}
                  </span>
                  <span>₹{formatInr(s.amount)}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <div className="rounded-lg border border-line bg-white p-5">
          <h2 className="text-xs uppercase tracking-[0.16em] text-ink-soft">UTM</h2>
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-xs text-ink-soft">
              <tr>
                <th className="py-1 font-medium">Source</th>
                <th className="py-1 font-medium">Medium</th>
                <th className="py-1 font-medium">Campaign</th>
                <th className="py-1 text-right font-medium">Leads</th>
              </tr>
            </thead>
            <tbody>
              {detail.utm.length === 0 ? (
                <tr>
                  <td className="py-3 text-ink-soft" colSpan={4}>
                    No UTM values on leads yet.
                  </td>
                </tr>
              ) : (
                detail.utm.map((row, i) => (
                  <tr key={i} className="border-t border-line">
                    <td className="py-2">{row.source}</td>
                    <td className="py-2">{row.medium}</td>
                    <td className="py-2">{row.campaign}</td>
                    <td className="py-2 text-right">{row.leads}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <Link href={`/leads?campaignId=${c.id}`} className="mt-3 inline-block text-sm text-copper hover:underline">
            Open leads
          </Link>
        </div>

        {canWrite ? (
          <div className="rounded-lg border border-line bg-white p-5">
            <h2 className="text-xs uppercase tracking-[0.16em] text-ink-soft">CSV import</h2>
            <p className="mt-2 text-xs text-ink-soft">
              Columns: fullName, mobile, email, city. One lead per line, comma-separated. Header row optional.
            </p>
            <textarea
              rows={6}
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              className="mt-3 w-full rounded-md border border-line p-2 font-mono text-xs"
              placeholder={"fullName,mobile,email,city\nAnita Shah,9876500001,anita@example.com,Pune"}
            />
            <button
              type="button"
              disabled={!!busy || !csv.trim()}
              onClick={async () => {
                const lines = csv.trim().split(/\r?\n/).filter(Boolean);
                const start = lines[0].toLowerCase().includes("mobile") ? 1 : 0;
                const rows = lines.slice(start).map((line) => {
                  const [fullName, mobile, email, city] = line.split(",").map((p) => p.trim());
                  return { fullName, mobile, email, city };
                });
                const json = await post(`/api/campaigns/${c.id}/import`, { rows });
                if (json) {
                  setImportResult(
                    `${json.success} imported · ${json.duplicates} duplicates · ${json.invalid} invalid`,
                  );
                }
              }}
              className="mt-2 h-9 rounded-md bg-ink px-3 text-sm text-white disabled:opacity-50"
            >
              Import leads
            </button>
            {importResult ? <p className="mt-2 text-sm text-ink-soft">{importResult}</p> : null}
          </div>
        ) : null}
      </div>
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
