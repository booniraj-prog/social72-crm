"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Columns3 } from "lucide-react";
import { ActionIcon, ActionsHeader } from "@/components/ui/action-icon";
import { TableFrame } from "@/components/platform/table-controls";
import { ISSUE_FILTERS } from "@/lib/lead-quality";
import { IssueBadge, ScoreMark } from "@/components/leads/quality-marks";
import { ActiveToggle } from "@/components/platform/active-toggle";
import { SCORE_HOT } from "@/lib/lead-score";
import { LeadForm } from "./lead-form";
import { LeadCsvImport } from "./lead-csv-import";
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
  canImport,
  canWrite,
  canCreateCampaign,
  importOpen,
  importFiles,
  assignees,
  currentUserId,
}: {
  leads: LeadRow[];
  total: number;
  page: number;
  pageSize: number;
  options: LeadOptions;
  clients: Client[];
  campaigns: Array<{ id: string; name: string; clientId: string }>;
  filters: Record<string, string>;
  canCreate: boolean;
  canImport?: boolean;
  canWrite?: boolean;
  canCreateCampaign: boolean;
  importOpen?: boolean;
  importFiles?: Array<{
    id: string;
    filename: string;
    url: string;
    createdAt: string;
    client?: string;
    clientId?: string | null;
  }>;
  assignees?: Array<{ id: string; name: string }>;
  currentUserId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showImport, setShowImport] = useState(Boolean(importOpen));
  const [listBusy, setListBusy] = useState(false);
  const [listNote, setListNote] = useState("");
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const listFiles = (importFiles ?? []).filter((file) => !filters.clientId || file.clientId === filters.clientId);
  const selectedClientName = clients.find((c) => c.id === filters.clientId)?.name;

  async function removeImportFile(id: string) {
    if (!window.confirm("Delete this uploaded lead file? Leads already in the list stay.")) return;
    setListNote("");
    const res = await fetch("/api/platform?kind=lead-import-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setListNote(json.error?.message ?? "Could not delete the file");
      return;
    }
    router.refresh();
  }

  async function removeDuplicates() {
    const scope = selectedClientName
      ? `Keep one lead per mobile for ${selectedClientName} and mark the rest as duplicates?`
      : "Keep one lead per mobile for every client you can see and mark the rest as duplicates?";
    if (!window.confirm(scope)) return;
    setListBusy(true);
    setListNote("");
    try {
      const res = await fetch("/api/leads/dedupe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: filters.clientId || undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setListNote(json.error?.message ?? "Could not remove duplicates");
        return;
      }
      const collapsed = Number(json.collapsed ?? 0);
      setListNote(
        collapsed
          ? `Marked ${collapsed} extra lead${collapsed === 1 ? "" : "s"} as duplicate. Open the Duplicates chip to review.`
          : "No extra mobiles to collapse in this view.",
      );
      router.refresh();
    } finally {
      setListBusy(false);
    }
  }

  function apply(form: HTMLFormElement) {
    const data = new FormData(form);
    const params = new URLSearchParams();
    for (const [key, value] of data.entries()) {
      if (String(value).trim()) params.set(key, String(value));
    }
    if (filters.import) params.set("import", filters.import);
    router.push(`/leads?${params.toString()}`);
  }

  function issueHref(key: string) {
    const params = new URLSearchParams();
    for (const [k, value] of Object.entries(filters)) {
      if (k === "page" || k === "import" || k === "issue" || !value) continue;
      params.set(k, value);
    }
    if (key && key !== filters.issue) params.set("issue", key);
    return `/leads?${params.toString()}`;
  }

  function scoreHref() {
    const params = new URLSearchParams();
    for (const [k, value] of Object.entries(filters)) {
      if (k === "page" || k === "import" || k === "minScore" || !value) continue;
      params.set(k, value);
    }
    if (filters.minScore !== String(SCORE_HOT)) params.set("minScore", String(SCORE_HOT));
    return `/leads?${params.toString()}`;
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-ink-soft">Demand</p>
          <h1 className="mt-2 font-display text-4xl text-ink">Leads</h1>
          <p className="mt-2 text-sm text-ink-soft">
            {total} in view · upload CSV here, then call or follow up from the same desk
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/leads/board" className="inline-flex h-10 items-center gap-1.5 rounded-md border border-line bg-white px-4 text-sm">
            <Columns3 className="h-4 w-4 text-ink-soft" strokeWidth={1.9} />
            Kanban
          </Link>
          {canImport ? (
            <ActionIcon
              action="dedupe"
              label="Remove duplicates"
              disabled={listBusy}
              onClick={() => void removeDuplicates()}
            />
          ) : null}
          {canImport ? (
            <ActionIcon
              action="browse"
              label={showImport ? "Hide CSV upload" : "Upload CSV"}
              onClick={() => setShowImport((value) => !value)}
            />
          ) : null}
          {canCreate ? <ActionIcon action="new" label="New lead" onClick={() => setOpen(true)} /> : null}
        </div>
      </div>

      {canImport && showImport ? (
        <LeadCsvImport
          clients={clients.map((c) => ({ id: c.id, name: c.name }))}
          campaigns={campaigns}
          assignees={assignees ?? options.assignees}
          defaultClientId={filters.clientId}
          defaultCampaignId={filters.campaignId}
          defaultAssigneeId={assignees?.some((a) => a.id === currentUserId) ? currentUserId : assignees?.[0]?.id}
          files={listFiles}
        />
      ) : null}

      {canImport ? (
        <div className="mt-6 rounded-lg border border-line bg-white px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.14em] text-ink-soft">Duplicates &amp; uploaded files</p>
              <p className="mt-1 text-sm text-ink-soft">
                Collapse extra mobiles and delete a bad CSV here, without opening Upload CSV.
                {selectedClientName ? ` Scoped to ${selectedClientName}.` : " Uses every client in view unless you filter one."}
              </p>
            </div>
            <ActionIcon
              action="dedupe"
              label="Remove duplicates"
              disabled={listBusy}
              onClick={() => void removeDuplicates()}
            />
          </div>
          {listNote ? <p className="mt-2 text-sm text-ink">{listNote}</p> : null}
          {listFiles.length > 0 ? (
            <ul className="mt-3 divide-y divide-line border-t border-line">
              {listFiles.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <a href={item.url} className="text-copper underline" target="_blank" rel="noreferrer">
                    {item.filename}
                  </a>
                  <span className="flex items-center gap-2 text-xs text-ink-soft">
                    {item.client && item.client !== "—" ? item.client : null}
                    {item.createdAt}
                    <ActionIcon action="delete" label="Delete lead file" onClick={() => void removeImportFile(item.id)} />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-ink-soft">No uploaded lead files{selectedClientName ? " for this client" : ""} yet.</p>
          )}
        </div>
      ) : null}

      <form
        className="mt-6 grid gap-2 rounded-lg border border-line bg-white p-3 md:grid-cols-4 lg:grid-cols-6"
        onSubmit={(e) => {
          e.preventDefault();
          apply(e.currentTarget);
        }}
      >
        <input type="hidden" name="issue" value={filters.issue ?? ""} />
        <input type="hidden" name="minScore" value={filters.minScore ?? ""} />
        <input type="hidden" name="sort" value={filters.sort ?? ""} />
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
          <ActionIcon type="submit" action="filter" />
          <ActionIcon action="reset" href="/leads" />
        </div>
      </form>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Link
          href={issueHref("")}
          className={`rounded-md px-2.5 py-1 text-xs ${
            !filters.issue ? "bg-ink text-white" : "border border-line bg-white text-ink hover:bg-paper-2"
          }`}
        >
          All
        </Link>
        {ISSUE_FILTERS.map((item) => (
          <Link
            key={item.key}
            href={issueHref(item.key)}
            className={`rounded-md px-2.5 py-1 text-xs ${
              filters.issue === item.key ? "bg-ink text-white" : "border border-line bg-white text-ink hover:bg-paper-2"
            }`}
          >
            {item.label}
          </Link>
        ))}
        <Link
          href={scoreHref()}
          className={`rounded-md px-2.5 py-1 text-xs ${
            filters.minScore === String(SCORE_HOT) ? "bg-ink text-white" : "border border-line bg-white text-ink hover:bg-paper-2"
          }`}
        >
          Score {SCORE_HOT}+
        </Link>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-white">
        <TableFrame
          rows={leads.map((lead) => ({
            id: lead.id,
            lead: lead.fullName,
            client: lead.client.name,
            status: lead.status.name,
            score: lead.leadScore,
            temp: lead.temperature,
            owner: lead.assignedUser?.name ?? "Unassigned",
            followUp: lead.nextFollowupAt
              ? new Date(lead.nextFollowupAt).toLocaleString("en-IN", {
                  timeZone: "Asia/Kolkata",
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "—",
            expected: Number(lead.expectedRevenue),
          }))}
          columns={["lead", "client", "status", "score", "temp", "owner", "followUp", "expected"]}
          labels={{ followUp: "Follow-up", expected: "Expected ₹", temp: "Temp" }}
          empty="No leads in this bucket. Try Callable, or clear the chip."
          extraHeaders={canWrite ? <ActionsHeader className="px-4 py-3" /> : null}
          extraColSpan={canWrite ? 1 : 0}
          rowClassName={(row) => {
            const lead = leads.find((l) => l.id === row.id);
            return `border-t border-line hover:bg-paper/60 ${lead?.isActive === false ? "opacity-60" : ""}`;
          }}
          renderRow={(row) => {
            const lead = leads.find((l) => l.id === row.id);
            if (!lead) return null;
            return (
              <>
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
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: lead.status.color }} />
                    {lead.status.name}
                    <IssueBadge statusKey={lead.status.key} />
                    {lead.isActive === false ? (
                      <span className="inline-flex rounded bg-[#57534d] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-white">
                        Paused
                      </span>
                    ) : null}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <ScoreMark value={lead.leadScore} />
                </td>
                <td className={`px-4 py-3 text-xs font-medium ${temperatureClass(lead.temperature)}`}>
                  {lead.temperature}
                </td>
                <td className="px-4 py-3 text-ink-soft">{lead.assignedUser?.name ?? "Unassigned"}</td>
                <td className="px-4 py-3 text-ink-soft">{String(row.followUp)}</td>
                <td className="px-4 py-3 text-right">{Number(lead.expectedRevenue).toLocaleString("en-IN")}</td>
                {canWrite ? (
                  <td className="px-4 py-3 text-right">
                    <ActiveToggle entity="lead" id={lead.id} active={lead.isActive !== false} name={lead.fullName} />
                  </td>
                ) : null}
              </>
            );
          }}
        />
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
