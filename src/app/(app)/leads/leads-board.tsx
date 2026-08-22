"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LeadForm } from "./lead-form";
import type { LeadOptions, LeadRow } from "@/modules/leads/types";

type Client = { id: string; name: string; industry: { id: string; name: string } | null };

function temperatureClass(t: LeadRow["temperature"]) {
  if (t === "HOT") return "text-[#9f2d2d]";
  if (t === "WARM") return "text-copper";
  if (t === "COLD") return "text-ink-soft";
  return "text-ink-soft";
}

export function LeadsBoard({
  leads,
  total,
  page,
  pageSize,
  options,
  clients,
  campaigns,
  filters,
  canCreate,
  canCreateCampaign,
}: {
  leads: LeadRow[];
  total: number;
  page: number;
  pageSize: number;
  options: LeadOptions;
  clients: Client[];
  campaigns: Array<{ id: string; name: string }>;
  filters: Record<string, string>;
  canCreate: boolean;
  canCreateCampaign: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const pages = Math.max(1, Math.ceil(total / pageSize));

  function apply(form: HTMLFormElement) {
    const data = new FormData(form);
    const params = new URLSearchParams();
    for (const [key, value] of data.entries()) {
      if (String(value).trim()) params.set(key, String(value));
    }
    router.push(`/leads?${params.toString()}`);
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-ink-soft">Operations</p>
          <h1 className="mt-2 font-display text-4xl text-ink">Leads</h1>
          <p className="mt-2 text-sm text-ink-soft">{total} in view</p>
        </div>
        {canCreate ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="h-10 rounded-md bg-copper px-4 text-sm font-medium text-white hover:bg-copper-dark"
          >
            New lead
          </button>
        ) : null}
      </div>

      <form
        className="mt-6 grid gap-2 rounded-lg border border-line bg-white p-3 md:grid-cols-4 lg:grid-cols-6"
        onSubmit={(e) => {
          e.preventDefault();
          apply(e.currentTarget);
        }}
      >
        <input
          name="q"
          defaultValue={filters.q}
          placeholder="Name, mobile, email, ID, caller"
          className="h-9 rounded-md border border-line px-2 text-sm md:col-span-2"
        />
        <select name="clientId" defaultValue={filters.clientId ?? ""} className="h-9 rounded-md border border-line px-2 text-sm">
          <option value="">All clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select name="campaignId" defaultValue={filters.campaignId ?? ""} className="h-9 rounded-md border border-line px-2 text-sm">
          <option value="">All campaigns</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select name="statusId" defaultValue={filters.statusId ?? ""} className="h-9 rounded-md border border-line px-2 text-sm">
          <option value="">All statuses</option>
          {options.statuses.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select name="assignedUserId" defaultValue={filters.assignedUserId ?? ""} className="h-9 rounded-md border border-line px-2 text-sm">
          <option value="">All owners</option>
          <option value="unassigned">Unassigned</option>
          {options.assignees.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <select name="temperature" defaultValue={filters.temperature ?? ""} className="h-9 rounded-md border border-line px-2 text-sm">
          <option value="">All temperatures</option>
          {options.temperatures.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input name="city" defaultValue={filters.city} placeholder="City" className="h-9 rounded-md border border-line px-2 text-sm" />
        <input name="state" defaultValue={filters.state} placeholder="State" className="h-9 rounded-md border border-line px-2 text-sm" />
        <input name="from" type="date" defaultValue={filters.from} className="h-9 rounded-md border border-line px-2 text-sm" />
        <input name="to" type="date" defaultValue={filters.to} className="h-9 rounded-md border border-line px-2 text-sm" />
        <div className="flex gap-2">
          <button type="submit" className="h-9 rounded-md bg-ink px-3 text-sm text-white">
            Filter
          </button>
          <Link href="/leads" className="flex h-9 items-center px-2 text-sm text-ink-soft">
            Reset
          </Link>
        </div>
      </form>

      <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-white">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="bg-paper-2 text-xs uppercase tracking-[0.12em] text-ink-soft">
            <tr>
              <th className="px-4 py-3 font-medium">Lead</th>
              <th className="px-4 py-3 font-medium">Client / campaign</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Temp</th>
              <th className="px-4 py-3 font-medium">Owner</th>
              <th className="px-4 py-3 font-medium">Follow-up</th>
              <th className="px-4 py-3 font-medium text-right">Expected ₹</th>
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 ? (
              <tr>
                <td className="px-4 py-10 text-ink-soft" colSpan={7}>
                  No leads match these filters. Create a client and campaign, then add the first lead.
                </td>
              </tr>
            ) : (
              leads.map((lead) => (
                <tr key={lead.id} className="border-t border-line hover:bg-paper/60">
                  <td className="px-4 py-3">
                    <Link href={`/leads/${lead.id}`} className="font-medium text-ink hover:underline">
                      {lead.fullName}
                    </Link>
                    <p className="text-xs text-ink-soft">
                      {lead.leadNumber} · {lead.mobileE164}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">
                    {lead.client.name}
                    <p className="text-xs">{lead.campaign.name}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: lead.status.color }} />
                      {lead.status.name}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-xs font-medium ${temperatureClass(lead.temperature)}`}>
                    {lead.temperature}
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{lead.assignedUser?.name ?? "Unassigned"}</td>
                  <td className="px-4 py-3 text-ink-soft">
                    {lead.nextFollowupAt
                      ? new Date(lead.nextFollowupAt).toLocaleString("en-IN", {
                          timeZone: "Asia/Kolkata",
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {Number(lead.expectedRevenue).toLocaleString("en-IN")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 ? (
        <div className="mt-4 flex gap-2 text-sm">
          {page > 1 ? (
            <Link href={`/leads?${new URLSearchParams({ ...filters, page: String(page - 1) }).toString()}`}>
              Previous
            </Link>
          ) : null}
          <span className="text-ink-soft">
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Link href={`/leads?${new URLSearchParams({ ...filters, page: String(page + 1) }).toString()}`}>
              Next
            </Link>
          ) : null}
        </div>
      ) : null}

      {open ? (
        <LeadForm
          options={options}
          clients={clients}
          canCreateCampaign={canCreateCampaign}
          onClose={() => setOpen(false)}
          onCreated={(id) => {
            setOpen(false);
            router.push(`/leads/${id}`);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}
