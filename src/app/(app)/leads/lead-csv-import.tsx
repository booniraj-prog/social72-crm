"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  applyLeadColumnMap,
  csvLeadTable,
  guessLeadColumnMap,
  LEAD_IMPORT_FIELDS,
  type LeadColumnMap,
  type LeadImportField,
} from "@/lib/csv";
import { ActionIcon } from "@/components/ui/action-icon";
import { controlClass, Field } from "@/components/platform/form-field";

const SAMPLE =
  "Customer Name,WhatsApp,Mail,Town,State,Job\nPriya Shah,9876543210,priya@example.com,Pune,Maharashtra,Architect\n";

type Assignee = { id: string; name: string };
type Campaign = { id: string; name: string; clientId: string };

type Summary = {
  total: number;
  success: number;
  duplicates: number;
  invalid: number;
  collapsed?: number;
  errors: Array<{ row: number; message: string }>;
};

export function LeadCsvImport({
  clients,
  campaigns,
  assignees,
  defaultClientId,
  defaultCampaignId,
  defaultAssigneeId,
  files = [],
}: {
  clients: Array<{ id: string; name: string }>;
  campaigns: Campaign[];
  assignees: Assignee[];
  defaultClientId?: string;
  defaultCampaignId?: string;
  defaultAssigneeId?: string;
  files?: Array<{ id: string; filename: string; url: string; createdAt: string }>;
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState(defaultClientId || "");
  const clientCampaigns = useMemo(
    () => campaigns.filter((c) => c.clientId === clientId),
    [campaigns, clientId],
  );
  const [campaignId, setCampaignId] = useState(
    defaultCampaignId && clientCampaigns.some((c) => c.id === defaultCampaignId)
      ? defaultCampaignId
      : clientCampaigns[0]?.id ?? "",
  );
  const [assignedUserId, setAssignedUserId] = useState(defaultAssigneeId || assignees[0]?.id || "");
  const [fileName, setFileName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [columnMap, setColumnMap] = useState<LeadColumnMap>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);

  const mappedRows = useMemo(
    () => applyLeadColumnMap(headers, rawRows, columnMap).slice(0, 500),
    [headers, rawRows, columnMap],
  );
  const rowCount = mappedRows.length;
  const preview = mappedRows.slice(0, 3);
  const mappedFields = LEAD_IMPORT_FIELDS.filter((field) => columnMap[field.key]);
  const hasName = Boolean(columnMap.fullName || columnMap.firstName);
  const hasMobile = Boolean(columnMap.mobile);

  const talkHref = `/calling?clientId=${clientId}`;
  const followHref = `/follow-ups?clientId=${clientId}&bucket=today`;

  function pickClient(id: string) {
    setClientId(id);
    const next = campaigns.filter((c) => c.clientId === id);
    setCampaignId(next[0]?.id ?? "");
    setSummary(null);
  }

  function downloadSample() {
    const blob = new Blob([SAMPLE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "social72-leads-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onFile(next: File | undefined) {
    setError("");
    setSummary(null);
    if (!next) {
      setFileName("");
      setFile(null);
      setHeaders([]);
      setRawRows([]);
      setColumnMap({});
      return;
    }
    const table = csvLeadTable(await next.text());
    setFile(next);
    setFileName(next.name);
    setHeaders(table.headers);
    setRawRows(table.rows.slice(0, 500));
    setColumnMap(guessLeadColumnMap(table.headers));
  }

  function setFieldColumn(field: LeadImportField, header: string) {
    setColumnMap((current) => {
      const next = { ...current };
      if (!header) delete next[field];
      else next[field] = header;
      return next;
    });
  }

  async function importRows() {
    if (!clientId) {
      setError("Select the client these leads belong to.");
      return;
    }
    if (!file || rowCount === 0) {
      setError("Choose a CSV file.");
      return;
    }
    if (!hasName || !hasMobile) {
      setError("Map a name column and a mobile column before importing.");
      return;
    }
    if (!assignedUserId) {
      setError("Select an employee to own these leads.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.set("assignedUserId", assignedUserId);
      if (campaignId) body.set("campaignId", campaignId);
      body.set("columnMap", JSON.stringify(columnMap));
      body.set("file", file);
      const res = await fetch(`/api/clients/${clientId}/leads/import`, { method: "POST", body });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error?.message ?? "Could not import leads");
        return;
      }
      setSummary(json as Summary);
      router.refresh();
    } catch {
      setError("Could not reach the server. If the app just restarted, try again.");
    } finally {
      setBusy(false);
    }
  }

  async function removeFile(id: string) {
    if (!window.confirm("Delete this uploaded lead file?")) return;
    const res = await fetch("/api/platform?kind=lead-import-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error?.message ?? "Could not delete the file");
      return;
    }
    router.refresh();
  }

  async function dedupe() {
    if (!clientId) {
      setError("Select a client first.");
      return;
    }
    if (!window.confirm("Keep one lead per mobile for this client and mark the rest as duplicates?")) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/leads/dedupe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error?.message ?? "Could not remove duplicates");
        return;
      }
      setSummary({
        total: json.kept + json.collapsed,
        success: json.kept,
        duplicates: json.collapsed,
        invalid: 0,
        collapsed: json.collapsed,
        errors: [],
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 rounded-lg border border-line bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xs uppercase tracking-[0.16em] text-ink-soft">Upload CSV</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Pick the client, then map each CSV column to a CRM field so the same data is stored.
          </p>
        </div>
        <div className="flex gap-1">
          <ActionIcon action="export" label="Download CSV template" onClick={downloadSample} />
          <ActionIcon action="dedupe" label="Remove duplicates" disabled={busy || !clientId} onClick={() => void dedupe()} />
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Client" required>
          <select className={controlClass()} value={clientId} onChange={(e) => pickClient(e.target.value)}>
            <option value="">Select client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Campaign">
          <select className={controlClass()} value={campaignId} onChange={(e) => setCampaignId(e.target.value)} disabled={!clientId}>
            {clientCampaigns.length === 0 ? <option value="">Create CSV import campaign</option> : null}
            {clientCampaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Assign to" required>
          <select className={controlClass()} value={assignedUserId} onChange={(e) => setAssignedUserId(e.target.value)}>
            <option value="">Select employee</option>
            {assignees.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="CSV file" required>
          <input
            type="file"
            accept=".csv,text/csv"
            className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-md file:border file:border-line file:bg-paper file:px-3 file:py-1.5 file:text-sm file:text-ink"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
        </Field>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <ActionIcon
          action="browse"
          label={busy ? "Importing…" : "Import leads"}
          disabled={busy || !file || !clientId || !hasName || !hasMobile}
          onClick={() => void importRows()}
        />
        {fileName ? (
          <p className="text-sm text-ink-soft">
            {fileName} · {rowCount} row{rowCount === 1 ? "" : "s"}
          </p>
        ) : (
          <p className="text-sm text-ink-soft">Choose a .csv file first.</p>
        )}
      </div>

      {headers.length > 0 ? (
        <div className="mt-5 rounded-md border border-line bg-paper p-4">
          <h3 className="text-xs uppercase tracking-[0.16em] text-ink-soft">Map columns</h3>
          <p className="mt-1 text-sm text-ink-soft">
            We guessed matches from the header names. Change any that are wrong. Name and mobile are required.
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {LEAD_IMPORT_FIELDS.map((field) => (
              <Field key={field.key} label={field.label} required={field.key === "mobile" || field.key === "fullName"}>
                <select
                  className={controlClass()}
                  value={columnMap[field.key] ?? ""}
                  onChange={(e) => setFieldColumn(field.key, e.target.value)}
                >
                  <option value="">Don&apos;t import</option>
                  {headers.map((header) => (
                    <option key={`${field.key}-${header}`} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </Field>
            ))}
          </div>
          {preview.length > 0 && mappedFields.length > 0 ? (
            <div className="mt-4 overflow-auto">
              <table className="min-w-full text-left text-xs">
                <thead>
                  <tr className="text-ink-soft">
                    {mappedFields.map((field) => (
                      <th key={field.key} className="whitespace-nowrap px-2 py-1 font-medium">
                        {field.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i} className="border-t border-line text-ink">
                      {mappedFields.map((field) => (
                        <td key={field.key} className="whitespace-nowrap px-2 py-1">
                          {row[field.key] || "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

      {summary ? (
        <div className="mt-4 rounded-md border border-line bg-paper px-4 py-3">
          <p className="text-sm text-ink">
            Loaded {summary.success} of {summary.total}
            {summary.duplicates ? ` · ${summary.duplicates} duplicate skipped` : ""}
            {summary.collapsed ? ` · ${summary.collapsed} existing duplicate marked` : ""}
            {summary.invalid ? ` · ${summary.invalid} invalid` : ""}
          </p>
          {summary.errors.length > 0 ? (
            <ul className="mt-2 max-h-32 overflow-auto text-xs text-ink-soft">
              {summary.errors.slice(0, 12).map((item) => (
                <li key={`${item.row}-${item.message}`}>
                  Row {item.row}: {item.message}
                </li>
              ))}
            </ul>
          ) : null}
          {summary.success > 0 && clientId ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href={talkHref} className="rounded-md bg-ink px-3 py-1.5 text-sm text-white">
                Start talking
              </Link>
              <Link href={followHref} className="rounded-md border border-line bg-white px-3 py-1.5 text-sm text-ink">
                Today&apos;s follow-ups
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}

      {files.length > 0 ? (
        <div className="mt-4 border-t border-line pt-4">
          <p className="text-[10px] uppercase tracking-[0.14em] text-ink-soft">Uploaded files for this client</p>
          <ul className="mt-2 space-y-2 text-sm">
            {files.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2">
                <a href={item.url} className="text-copper underline" target="_blank" rel="noreferrer">
                  {item.filename}
                </a>
                <span className="flex items-center gap-2 text-xs text-ink-soft">
                  {item.createdAt}
                  <ActionIcon action="delete" label="Delete lead file" onClick={() => void removeFile(item.id)} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
