"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatInr } from "@/lib/money";
import { toIstDateInput } from "@/lib/time";
import { CAMPAIGN_TYPES, PLATFORMS } from "@/modules/insights/constants";
import { controlClass, Field, FormBanner, focusInvalid, validateRecord } from "@/components/platform/form-field";
import { TableFrame } from "@/components/platform/table-controls";

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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [spendErrors, setSpendErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");

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
      {error ? <FormBanner message={error} /> : null}

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
            noValidate
            className="rounded-lg border border-line bg-white p-5"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const data = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
              const nextErrors = validateRecord(data, [
                { name: "name", label: "Campaign name", required: true },
                { name: "budget", label: "Budget", type: "number", min: 0 },
              ]);
              if (data.startDate && data.endDate && data.endDate < data.startDate) {
                nextErrors.endDate = "End date must be on or after start date";
              }
              setFieldErrors(nextErrors);
              if (Object.keys(nextErrors).length > 0) {
                requestAnimationFrame(() => focusInvalid(form));
                return;
              }
              void post(
                `/api/campaigns/${c.id}`,
                {
                  name: data.name,
                  platform: data.platform,
                  campaignType: data.campaignType,
                  startDate: data.startDate,
                  endDate: data.endDate,
                  budget: data.budget,
                  isActive: data.isActive === "on",
                },
                "PATCH",
              );
            }}
          >
            <h2 className="text-xs uppercase tracking-[0.16em] text-ink-soft">Campaign</h2>
            <div className="mt-3 grid gap-3">
              <Field label="Name" required error={fieldErrors.name}>
                <input name="name" defaultValue={c.name} aria-invalid={Boolean(fieldErrors.name)} className={controlClass(Boolean(fieldErrors.name))} />
              </Field>
              <Field label="Platform">
                <select name="platform" defaultValue={c.platform ?? ""} className={controlClass()}>
                  <option value="">Platform</option>
                  {PLATFORMS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Type">
                <select name="campaignType" defaultValue={c.campaignType ?? ""} className={controlClass()}>
                  <option value="">Type</option>
                  {CAMPAIGN_TYPES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Start date">
                <input name="startDate" type="date" defaultValue={toIstDateInput(c.startDate)} className={controlClass()} />
              </Field>
              <Field label="End date" error={fieldErrors.endDate}>
                <input name="endDate" type="date" defaultValue={toIstDateInput(c.endDate)} aria-invalid={Boolean(fieldErrors.endDate)} className={controlClass(Boolean(fieldErrors.endDate))} />
              </Field>
              <Field label="Budget" error={fieldErrors.budget}>
                <input name="budget" defaultValue={c.budget} aria-invalid={Boolean(fieldErrors.budget)} className={controlClass(Boolean(fieldErrors.budget))} />
              </Field>
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
              noValidate
              className="mt-3 grid gap-2 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const data = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
                const nextErrors = validateRecord(data, [
                  { name: "spendDate", label: "Spend date", required: true },
                  { name: "amount", label: "Amount", required: true, type: "number", min: 0 },
                ]);
                setSpendErrors(nextErrors);
                if (Object.keys(nextErrors).length > 0) {
                  requestAnimationFrame(() => focusInvalid(form));
                  return;
                }
                void post(`/api/campaigns/${c.id}/spend`, {
                  spendDate: data.spendDate,
                  amount: data.amount,
                  platform: data.platform,
                  notes: data.notes,
                });
                form.reset();
                setSpendErrors({});
              }}
            >
              <Field label="Spend date" required error={spendErrors.spendDate}>
                <input name="spendDate" type="date" aria-invalid={Boolean(spendErrors.spendDate)} className={controlClass(Boolean(spendErrors.spendDate))} />
              </Field>
              <Field label="Amount" required error={spendErrors.amount}>
                <input name="amount" placeholder="Amount" aria-invalid={Boolean(spendErrors.amount)} className={controlClass(Boolean(spendErrors.amount))} />
              </Field>
              <Field label="Platform">
                <input name="platform" placeholder="Platform" className={controlClass()} />
              </Field>
              <Field label="Notes">
                <input name="notes" placeholder="Notes" className={controlClass()} />
              </Field>
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
          <div className="mt-3 overflow-x-auto">
            <TableFrame
              rows={detail.utm.map((row, i) => ({ ...row, id: String(i) }))}
              columns={["source", "medium", "campaign", "leads"]}
              empty="No UTM values on leads yet."
              renderRow={(row) => (
                <>
                  <td className="py-2 px-3">{String(row.source)}</td>
                  <td className="py-2 px-3">{String(row.medium)}</td>
                  <td className="py-2 px-3">{String(row.campaign)}</td>
                  <td className="py-2 px-3 text-right">{Number(row.leads)}</td>
                </>
              )}
            />
          </div>
          <Link href={`/leads?campaignId=${c.id}`} className="mt-3 inline-block text-sm text-copper hover:underline">
            Open leads
          </Link>
        </div>

        {canWrite ? (
          <div className="rounded-lg border border-line bg-white p-5">
            <h2 className="text-xs uppercase tracking-[0.16em] text-ink-soft">Load leads</h2>
            <p className="mt-2 text-sm text-ink-soft">
              Upload a CSV on Leads so the file, assignee and duplicates stay with the calling list.
            </p>
            <Link
              href={`/leads?clientId=${c.client.id}&campaignId=${c.id}&import=1`}
              className="mt-3 inline-block text-sm text-copper hover:underline"
            >
              Upload CSV for this campaign
            </Link>
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
