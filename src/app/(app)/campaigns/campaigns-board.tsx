"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatInr } from "@/lib/money";
import { ActionIcon, ActionsHeader } from "@/components/ui/action-icon";
import { ActiveToggle } from "@/components/platform/active-toggle";
import { controlClass, Field, FormBanner, focusInvalid, validateRecord } from "@/components/platform/form-field";
import { TableFrame } from "@/components/platform/table-controls";

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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-ink-soft">Marketing</p>
          <h1 className="mt-2 font-display text-4xl text-ink">Ad campaigns</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-soft">
            Ad budget vs spend, leads, CPL and ROI per campaign. Conversion happens on outbound calling.
          </p>
        </div>
        {canWrite ? (
          <ActionIcon
            action="new"
            label="New campaign"
            onClick={() => {
              setError("");
              setOpen(true);
            }}
          />
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
        <ActionIcon type="submit" action="filter" />
      </form>

      <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-white">
        <TableFrame
          rows={campaigns.map((row) => ({
            ...row,
            campaign: row.name,
            clientName: row.client.name,
            conv: row.conversionRate,
          }))}
          columns={["campaign", "clientName", "spend", "leads", "cpl", "qualified", "visits", "won", "conv", "roi"]}
          labels={{ clientName: "Client" }}
          empty="No campaigns match this filter."
          extraHeaders={canWrite ? <ActionsHeader className="px-4 py-3" /> : null}
          extraColSpan={canWrite ? 1 : 0}
          rowClassName={(row) => `border-t border-line hover:bg-paper/60 ${row.isActive ? "" : "opacity-60"}`}
          renderRow={(row) => (
            <>
              <td className="px-4 py-3">
                <Link href={`/campaigns/${row.id}`} className="font-medium hover:underline">
                  {row.name}
                </Link>
                <p className="text-xs text-ink-soft">
                  {String(row.clientName)}
                  {row.industry && typeof row.industry === "object" && "name" in row.industry
                    ? ` · ${String((row.industry as { name: string }).name)}`
                    : ""}
                  {row.platform ? ` · ${row.platform}` : ""}
                  {row.isActive ? "" : " · Paused"}
                </p>
              </td>
              <td className="px-4 py-3 text-ink-soft">{String(row.clientName)}</td>
              <td className="px-4 py-3">₹{formatInr(Number(row.spend))}</td>
              <td className="px-4 py-3">{Number(row.leads)}</td>
              <td className="px-4 py-3">₹{formatInr(Number(row.cpl))}</td>
              <td className="px-4 py-3">{Number(row.qualified)}</td>
              <td className="px-4 py-3">{Number(row.visits)}</td>
              <td className="px-4 py-3">{Number(row.won)}</td>
              <td className="px-4 py-3">{Number(row.conv)}%</td>
              <td className="px-4 py-3">{Number(row.roi)}%</td>
              {canWrite ? (
                <td className="px-4 py-3 text-right">
                  <ActiveToggle entity="campaign" id={String(row.id)} active={Boolean(row.isActive)} name={String(row.name)} />
                </td>
              ) : null}
            </>
          )}
        />
      </div>

      {open ? (
        <div className="fixed inset-0 z-20 flex items-start justify-center bg-ink/40 p-4 py-10">
          <form
            noValidate
            className="w-full max-w-lg rounded-lg bg-paper p-6"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const data = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
              const nextErrors = validateRecord(data, [
                { name: "name", label: "Campaign name", required: true },
                { name: "clientId", label: "Client", required: true },
                { name: "budget", label: "Budget", type: "number", min: 0 },
              ]);
              if (data.startDate && data.endDate && data.endDate < data.startDate) {
                nextErrors.endDate = "End date must be on or after start date";
              }
              setFieldErrors(nextErrors);
              if (Object.keys(nextErrors).length > 0) {
                setError("Please fix the highlighted fields.");
                requestAnimationFrame(() => focusInvalid(form));
                return;
              }
              setSaving(true);
              setError("");
              const res = await fetch("/api/campaigns", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  name: data.name,
                  clientId: data.clientId,
                  platform: data.platform,
                  campaignType: data.campaignType,
                  startDate: data.startDate,
                  endDate: data.endDate,
                  budget: data.budget || 0,
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
            <FormBanner message={error} />
            <div className="mt-4 grid gap-3">
              <Field label="Campaign name" required error={fieldErrors.name}>
                <input name="name" placeholder="Campaign name" aria-invalid={Boolean(fieldErrors.name)} onChange={() => setFieldErrors((c) => ({ ...c, name: "" }))} className={controlClass(Boolean(fieldErrors.name))} />
              </Field>
              <Field label="Client" required error={fieldErrors.clientId}>
                <select name="clientId" aria-invalid={Boolean(fieldErrors.clientId)} onChange={() => setFieldErrors((c) => ({ ...c, clientId: "" }))} className={controlClass(Boolean(fieldErrors.clientId))}>
                  <option value="">Select client</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Platform">
                <select name="platform" className={controlClass()}>
                  <option value="">Platform</option>
                  {platforms.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Type">
                <select name="campaignType" className={controlClass()}>
                  <option value="">Type</option>
                  {types.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Start date">
                <input name="startDate" type="date" className={controlClass()} />
              </Field>
              <Field label="End date" error={fieldErrors.endDate}>
                <input name="endDate" type="date" aria-invalid={Boolean(fieldErrors.endDate)} className={controlClass(Boolean(fieldErrors.endDate))} />
              </Field>
              <Field label="Budget" error={fieldErrors.budget}>
                <input name="budget" placeholder="Budget" aria-invalid={Boolean(fieldErrors.budget)} className={controlClass(Boolean(fieldErrors.budget))} />
              </Field>
            </div>
            <div className="mt-4 flex gap-2">
              <ActionIcon type="submit" action="save" disabled={saving} label="Create campaign" />
              <ActionIcon action="cancel" onClick={() => setOpen(false)} />
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
