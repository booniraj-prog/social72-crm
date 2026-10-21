"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatInr, formatInr2 } from "@/lib/money";
import {
  applyProposalDiscount,
  emptyProposalCosting,
  normalizeCosting,
  PROPOSAL_STREAMS,
  proposalCommercialLines,
  proposalInternals,
  type ProposalCosting,
} from "@/lib/proposal-costing";
import { HistoryTip, SortHeader, TableToolbar, useTableQuery } from "@/components/platform/table-controls";
import { controlClass, Field, FormBanner, textareaClass, focusInvalid } from "@/components/platform/form-field";
import { ActionIcon, ActionsHeader } from "@/components/ui/action-icon";

type Line = { description: string; qty: string; rate: string };
type StreamForm = { adBudget: string; manDays: string; toolCharges: string; serviceCharges: string };
type Proposal = {
  id: string;
  number: string;
  clientId: string;
  client: string;
  status: string;
  total: number;
  subtotal: number;
  gstPct?: number;
  dueDate: string | null;
  notes: string | null;
  paymentTerms?: string | null;
  projectId: string | null;
  project: string | null;
  plannedGross: number;
  plannedNet: number;
  discountAmt: number;
  costing: ProposalCosting | null;
  history: string;
  lines: Array<{ description: string; qty: number; rate: number; amount: number }>;
};

function emptyStreams(): Record<string, StreamForm> {
  return Object.fromEntries(
    PROPOSAL_STREAMS.map((s) => [s.key, { adBudget: "0", manDays: "0", toolCharges: "0", serviceCharges: "0" }]),
  );
}

function costingToStreams(costing: ProposalCosting | null): Record<string, StreamForm> {
  const next = emptyStreams();
  for (const stream of costing?.streams ?? []) {
    next[stream.key] = {
      adBudget: String(stream.adBudget ?? 0),
      manDays: String(stream.manDays ?? 0),
      toolCharges: String(stream.toolCharges ?? 0),
      serviceCharges: String(stream.serviceCharges ?? 0),
    };
  }
  return next;
}

function parseNotes(notes: string | null) {
  const text = notes ?? "";
  const grab = (label: string) => {
    const match = text.match(new RegExp(`${label}:\\s*\\n?([\\s\\S]*?)(?=\\n\\n[A-Z]|$)`));
    return match?.[1]?.trim() ?? "";
  };
  return {
    title: text.match(/Package:\s*(.*)/)?.[1]?.trim() ?? "",
    scope: grab("Scope"),
    inclusions: grab("Inclusions"),
    exclusions: grab("Exclusions"),
    assumptions: grab("Assumptions"),
  };
}

export function ProposalBoard({
  clients,
  proposals,
  projects,
  canDelete,
  canCreate,
  canTag,
  canApprove,
}: {
  clients: Array<{ id: string; name: string; gstin?: string | null; contactName?: string | null }>;
  proposals: Proposal[];
  projects: Array<{ id: string; name: string; clientId: string; client: string }>;
  canDelete: boolean;
  canCreate: boolean;
  canTag: boolean;
  canApprove?: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"build" | "list">(canCreate && !proposals.length ? "build" : "list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [validity, setValidity] = useState("15");
  const [paymentTerms, setPaymentTerms] = useState("50% on acceptance, balance before go-live");
  const [gstPct, setGstPct] = useState("18");
  const [scope, setScope] = useState("");
  const [inclusions, setInclusions] = useState("");
  const [exclusions, setExclusions] = useState("");
  const [assumptions, setAssumptions] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [streams, setStreams] = useState(emptyStreams);
  const [manDayRate, setManDayRate] = useState("4000");
  const [discountPct, setDiscountPct] = useState("0");
  const [discountAmt, setDiscountAmt] = useState("0");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [tagId, setTagId] = useState<string | null>(null);
  const [tagProject, setTagProject] = useState("");
  const [tagError, setTagError] = useState("");

  const n = (v: string) => Number(v) || 0;
  const costing = useMemo(
    () =>
      normalizeCosting({
        manDayRate: n(manDayRate),
        discountPct: n(discountPct),
        discountAmt: n(discountAmt),
        streams: PROPOSAL_STREAMS.map((s) => ({
          key: s.key,
          adBudget: n(streams[s.key]?.adBudget ?? "0"),
          manDays: n(streams[s.key]?.manDays ?? "0"),
          toolCharges: n(streams[s.key]?.toolCharges ?? "0"),
          serviceCharges: n(streams[s.key]?.serviceCharges ?? "0"),
        })),
      }),
    [streams, manDayRate, discountPct, discountAmt],
  );
  const commercial = proposalCommercialLines(costing);
  const extras = lines
    .filter((l) => l.description.trim())
    .map((l) => ({ description: l.description.trim(), qty: n(l.qty) || 1, rate: n(l.rate), amount: (n(l.qty) || 1) * n(l.rate) }));
  const gross = commercial.reduce((s, l) => s + l.amount, 0) + extras.reduce((s, l) => s + l.amount, 0);
  const discounted = applyProposalDiscount(gross, costing);
  const gst = discounted.taxable * (n(gstPct) / 100);
  const total = discounted.taxable + gst;
  const internals = proposalInternals(costing);
  const plannedDirect = internals.plannedAd + internals.plannedTools;
  const gm = total - plannedDirect;
  const np = total - plannedDirect - internals.plannedPeople;
  const client = clients.find((c) => c.id === clientId);
  const tagging = proposals.find((p) => p.id === tagId);
  const clientProjects = projects.filter((p) => p.clientId === (tagging?.clientId ?? ""));
  const listColumns = ["number", "client", "status", "project", "total", "gross", "net"];
  const tableRows = proposals.map((q) => ({
    ...q,
    project: q.project ?? "—",
    gross: q.plannedGross,
    net: q.plannedNet,
  }));
  const table = useTableQuery(tableRows, listColumns);

  function loadProposal(row: Proposal) {
    const notes = parseNotes(row.notes);
    setEditingId(row.id);
    setClientId(row.clientId);
    setTitle(notes.title);
    setPaymentTerms(row.paymentTerms ?? "50% on acceptance, balance before go-live");
    setGstPct(String(row.gstPct ?? 18));
    setScope(notes.scope);
    setInclusions(notes.inclusions);
    setExclusions(notes.exclusions);
    setAssumptions(notes.assumptions);
    const nextCosting = row.costing ?? emptyProposalCosting();
    setStreams(costingToStreams(nextCosting));
    setManDayRate(String(nextCosting.manDayRate || 4000));
    setDiscountPct(String(nextCosting.discountPct || 0));
    setDiscountAmt(String(row.discountAmt || nextCosting.discountAmt || 0));
    const auto = new Set(proposalCommercialLines(nextCosting).map((l) => l.description));
    setLines(
      row.lines
        .filter((l) => !auto.has(l.description))
        .map((l) => ({ description: l.description, qty: String(l.qty), rate: String(l.rate) })),
    );
    setTab("build");
  }

  function resetBuilder() {
    setEditingId(null);
    setTitle("");
    setStreams(emptyStreams());
    setLines([]);
    setScope("");
    setInclusions("");
    setExclusions("");
    setAssumptions("");
    setDiscountPct("0");
    setDiscountAmt("0");
  }

  async function save() {
    const next: Record<string, string> = {};
    if (!clientId) next.clientId = "Select a client";
    if (!title.trim()) next.title = "Package title is required";
    if (!n(validity) || n(validity) < 1) next.validity = "Validity must be at least 1 day";
    if (n(gstPct) < 0 || n(gstPct) > 40) next.gstPct = "GST must be between 0 and 40";
    if (n(discountPct) < 0 || n(discountPct) > 100) next.discountPct = "Discount % must be between 0 and 100";
    if (n(discountAmt) < 0) next.discountAmt = "Discount cannot be negative";
    if (n(manDayRate) < 0) next.manDayRate = "Man-day rate cannot be negative";
    if (commercial.length === 0 && extras.length === 0) next.costing = "Add service, ad, tool charges or an extra quote line";
    lines.forEach((line, i) => {
      const filled = Boolean(line.description.trim() || n(line.rate) > 0 || (n(line.qty) > 0 && n(line.qty) !== 1));
      if (!filled) return;
      if (!line.description.trim()) next[`line-${i}`] = "Line description is required";
      if (n(line.qty) <= 0) next[`line-qty-${i}`] = "Qty must be greater than 0";
      if (n(line.rate) < 0) next[`line-rate-${i}`] = "Rate cannot be negative";
    });
    setFieldErrors(next);
    if (Object.keys(next).length > 0) {
      setError("Please fix the highlighted fields before saving.");
      requestAnimationFrame(() => focusInvalid(document.getElementById("proposal-builder")));
      return;
    }
    setSaving(true);
    setError("");
    const due = new Date();
    due.setDate(due.getDate() + (n(validity) || 15));
    const notes = [
      title && `Package: ${title}`,
      scope && `Scope:\n${scope}`,
      inclusions && `Inclusions:\n${inclusions}`,
      exclusions && `Exclusions:\n${exclusions}`,
      assumptions && `Assumptions:\n${assumptions}`,
    ]
      .filter(Boolean)
      .join("\n\n");
    const res = await fetch(`/api/platform?kind=${editingId ? "invoice-update" : "invoice"}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editingId ?? undefined,
        clientId,
        kind: "QUOTE",
        gstPct: n(gstPct),
        dueDate: due.toISOString().slice(0, 10),
        paymentTerms,
        notes,
        costing,
        discountPct: n(discountPct),
        discountAmt: n(discountAmt),
        manDayRate: n(manDayRate),
        lines: extras,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(json.error?.message ?? "Could not save proposal");
      return;
    }
    resetBuilder();
    router.refresh();
    router.push(`/invoices/${json.row.id}`);
  }

  async function tag(createNew: boolean) {
    if (!tagId) return;
    if (!createNew && !tagProject) {
      setTagError("Select a project or create a new one.");
      return;
    }
    setTagError("");
    setSaving(true);
    const res = await fetch("/api/platform?kind=proposal-tag", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invoiceId: tagId,
        engagementId: createNew ? "" : tagProject,
        name: tagging ? `${tagging.client} · ${tagging.number}` : "",
      }),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setTagError(json.error?.message ?? "Could not tag this proposal");
      return;
    }
    setTagId(null);
    router.refresh();
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this proposal?")) return;
    await fetch("/api/platform?kind=invoice-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    router.refresh();
  }

  async function decide(id: string, status: "SENT" | "VOID") {
    await fetch("/api/platform?kind=invoice-decide", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    router.refresh();
  }

  return (
    <div>
      <p className="text-xs uppercase tracking-[0.18em] text-ink-soft">Demand</p>
      <h1 className="mt-1 font-display text-3xl text-ink">Proposals</h1>
      <p className="mt-1 max-w-3xl text-sm text-ink-soft">
        Sales builds the quote. The roles set in Settings approve it. Then sales or a project manager tags it to a job.
      </p>

      <div className="mt-4 flex gap-1">
        <button type="button" onClick={() => setTab("list")} className={`h-9 rounded-md px-3 text-sm ${tab === "list" ? "bg-ink text-white" : "border border-line bg-white"}`}>
          List ({proposals.length})
        </button>
          {canCreate ? (
            <ActionIcon
              action={editingId ? "edit" : "new"}
              label={editingId ? "Edit quote" : "New quote"}
              onClick={() => {
                if (!editingId) resetBuilder();
                setTab("build");
              }}
              className={tab === "build" ? "ring-1 ring-ink" : undefined}
            />
          ) : null}
      </div>

      {tab === "build" && canCreate ? (
        <div id="proposal-builder" className="mt-5 grid gap-4 xl:grid-cols-[1fr_280px]">
          <div className="surface rounded-lg p-4">
            <FormBanner message={error} />
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Client" required error={fieldErrors.clientId}>
                <select
                  value={clientId}
                  aria-invalid={Boolean(fieldErrors.clientId)}
                  onChange={(e) => {
                    setClientId(e.target.value);
                    setFieldErrors((c) => ({ ...c, clientId: "" }));
                  }}
                  className={controlClass(Boolean(fieldErrors.clientId))}
                >
                  <option value="">Select client</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Package / title" required error={fieldErrors.title}>
                <input
                  value={title}
                  aria-invalid={Boolean(fieldErrors.title)}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setFieldErrors((c) => ({ ...c, title: "" }));
                  }}
                  className={controlClass(Boolean(fieldErrors.title))}
                />
              </Field>
              <Field label="Valid for (days)" required error={fieldErrors.validity}>
                <input
                  type="number"
                  min={1}
                  value={validity}
                  aria-invalid={Boolean(fieldErrors.validity)}
                  onChange={(e) => {
                    setValidity(e.target.value);
                    setFieldErrors((c) => ({ ...c, validity: "" }));
                  }}
                  className={controlClass(Boolean(fieldErrors.validity))}
                />
              </Field>
              <Field label="GST / tax %" error={fieldErrors.gstPct}>
                <input
                  type="number"
                  min={0}
                  max={40}
                  value={gstPct}
                  aria-invalid={Boolean(fieldErrors.gstPct)}
                  onChange={(e) => {
                    setGstPct(e.target.value);
                    setFieldErrors((c) => ({ ...c, gstPct: "" }));
                  }}
                  className={controlClass(Boolean(fieldErrors.gstPct))}
                />
              </Field>
              <Field label="Discount %" error={fieldErrors.discountPct}>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={discountPct}
                  aria-invalid={Boolean(fieldErrors.discountPct)}
                  onChange={(e) => {
                    setDiscountPct(e.target.value);
                    setFieldErrors((c) => ({ ...c, discountPct: "" }));
                  }}
                  className={controlClass(Boolean(fieldErrors.discountPct))}
                />
              </Field>
              <Field label="Discount amount" error={fieldErrors.discountAmt}>
                <input
                  type="number"
                  min={0}
                  value={discountAmt}
                  aria-invalid={Boolean(fieldErrors.discountAmt)}
                  onChange={(e) => {
                    setDiscountAmt(e.target.value);
                    setFieldErrors((c) => ({ ...c, discountAmt: "" }));
                  }}
                  className={controlClass(Boolean(fieldErrors.discountAmt))}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Payment terms">
                  <input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} className={controlClass()} />
                </Field>
              </div>
            </div>
            {client ? (
              <p className="mt-2 text-xs text-ink-soft">
                {client.contactName ?? "No contact"} · GSTIN {client.gstin ?? "—"}
              </p>
            ) : null}

            <h2 className="mt-6 font-display text-xl">Workstream costing</h2>
            <p className="mt-1 text-xs text-ink-soft">Service, ads and tools are billed. Man-days × rate is internal delivery cost for net profit.</p>
            {fieldErrors.costing ? (
              <p role="alert" className="mt-2 text-sm text-danger">
                {fieldErrors.costing}
              </p>
            ) : null}
            <div className="mt-3 max-w-xs">
              <Field label="Man-day rate (₹)" error={fieldErrors.manDayRate}>
                <input
                  type="number"
                  min={0}
                  value={manDayRate}
                  aria-invalid={Boolean(fieldErrors.manDayRate || fieldErrors.costing)}
                  onChange={(e) => {
                    setManDayRate(e.target.value);
                    setFieldErrors((c) => ({ ...c, manDayRate: "", costing: "" }));
                  }}
                  className={controlClass(Boolean(fieldErrors.manDayRate || fieldErrors.costing))}
                />
              </Field>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase text-ink-soft">
                    <th className="py-2 pr-3">Stream</th>
                    <th className="py-2 pr-3">Ad budget</th>
                    <th className="py-2 pr-3">Man days</th>
                    <th className="py-2 pr-3">Tool charges</th>
                    <th className="py-2">Service charges</th>
                  </tr>
                </thead>
                <tbody>
                  {PROPOSAL_STREAMS.map((stream) => (
                    <tr key={stream.key} className="border-t border-line">
                      <td className="py-2 pr-3">{stream.label}</td>
                      {(["adBudget", "manDays", "toolCharges", "serviceCharges"] as const).map((field) => (
                        <td key={field} className="py-2 pr-3">
                          <input
                            type="number"
                            min={0}
                            value={streams[stream.key]?.[field] ?? "0"}
                            onChange={(e) =>
                              setStreams((current) => ({
                                ...current,
                                [stream.key]: { ...current[stream.key], [field]: e.target.value },
                              }))
                            }
                            className="h-9 w-28 rounded-md border border-line bg-white px-2"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h2 className="mt-6 font-display text-xl">Extra quote lines</h2>
            <div className="mt-2 space-y-2">
              {lines.map((line, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-[1fr_80px_110px]">
                  <div>
                    <input
                      value={line.description}
                      placeholder="Description"
                      aria-invalid={Boolean(fieldErrors[`line-${i}`])}
                      onChange={(e) => {
                        setLines((rows) => rows.map((r, idx) => (idx === i ? { ...r, description: e.target.value } : r)));
                        setFieldErrors((c) => ({ ...c, [`line-${i}`]: "", costing: "" }));
                      }}
                      className={controlClass(Boolean(fieldErrors[`line-${i}`]))}
                    />
                    {fieldErrors[`line-${i}`] ? <p className="mt-1 text-xs text-danger">{fieldErrors[`line-${i}`]}</p> : null}
                  </div>
                  <div>
                    <input
                      type="number"
                      min={0}
                      value={line.qty}
                      aria-invalid={Boolean(fieldErrors[`line-qty-${i}`])}
                      onChange={(e) => {
                        setLines((rows) => rows.map((r, idx) => (idx === i ? { ...r, qty: e.target.value } : r)));
                        setFieldErrors((c) => ({ ...c, [`line-qty-${i}`]: "" }));
                      }}
                      className={controlClass(Boolean(fieldErrors[`line-qty-${i}`]))}
                    />
                    {fieldErrors[`line-qty-${i}`] ? <p className="mt-1 text-xs text-danger">{fieldErrors[`line-qty-${i}`]}</p> : null}
                  </div>
                  <div>
                    <input
                      type="number"
                      min={0}
                      value={line.rate}
                      aria-invalid={Boolean(fieldErrors[`line-rate-${i}`])}
                      onChange={(e) => {
                        setLines((rows) => rows.map((r, idx) => (idx === i ? { ...r, rate: e.target.value } : r)));
                        setFieldErrors((c) => ({ ...c, [`line-rate-${i}`]: "" }));
                      }}
                      className={controlClass(Boolean(fieldErrors[`line-rate-${i}`]))}
                    />
                    {fieldErrors[`line-rate-${i}`] ? <p className="mt-1 text-xs text-danger">{fieldErrors[`line-rate-${i}`]}</p> : null}
                  </div>
                </div>
              ))}
            </div>
            <ActionIcon action="add" onClick={() => setLines((rows) => [...rows, { description: "", qty: "1", rate: "0" }])} />

            <div className="mt-5 grid gap-3">
              <Field label="Scope of work">
                <textarea value={scope} onChange={(e) => setScope(e.target.value)} rows={3} className={textareaClass()} />
              </Field>
              <Field label="Inclusions">
                <textarea value={inclusions} onChange={(e) => setInclusions(e.target.value)} rows={2} className={textareaClass()} />
              </Field>
              <Field label="Exclusions">
                <textarea value={exclusions} onChange={(e) => setExclusions(e.target.value)} rows={2} className={textareaClass()} />
              </Field>
              <Field label="Assumptions">
                <textarea value={assumptions} onChange={(e) => setAssumptions(e.target.value)} rows={2} className={textareaClass()} />
              </Field>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {editingId ? <ActionIcon action="cancel" label="Cancel edit" onClick={resetBuilder} /> : null}
              <ActionIcon action="save" disabled={saving} onClick={() => void save()} label={editingId ? "Save changes" : "Save proposal"} />
            </div>
          </div>

          <aside className="h-fit rounded-lg bg-pine px-5 py-5 text-white">
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/70">Gross</p>
            <p className="mt-1 font-display text-2xl">₹{formatInr2(gross)}</p>
            <p className="mt-4 text-[10px] uppercase tracking-[0.16em] text-white/70">Discount</p>
            <p className="mt-1 font-display text-xl">₹{formatInr2(discounted.discountAmt)}</p>
            <p className="mt-4 text-[10px] uppercase tracking-[0.16em] text-white/70">Taxable + GST</p>
            <p className="mt-1 font-display text-xl">₹{formatInr(total)}</p>
            <p className="mt-5 text-[10px] uppercase tracking-[0.16em] text-white/70">Gross margin</p>
            <p className="mt-1 font-display text-2xl">₹{formatInr(gm)}</p>
            <p className="mt-5 text-[10px] uppercase tracking-[0.16em] text-white/70">Net profit</p>
            <p className="mt-1 font-display text-2xl">₹{formatInr(np)}</p>
            <p className="mt-4 text-xs text-white/70">
              {internals.manDays} man-days · ads ₹{formatInr(internals.plannedAd)} · tools ₹{formatInr(internals.plannedTools)}
            </p>
          </aside>
        </div>
      ) : (
        <div className="surface mt-5 overflow-x-auto rounded-lg">
          {proposals.length === 0 ? (
            <p className="p-6 text-sm text-ink-soft">No proposals yet. Build a quote first.</p>
          ) : (
            <>
              <TableToolbar
                columns={listColumns}
                query={table.query}
                setQuery={table.setQuery}
                filterKey={table.filterKey}
                setFilterKey={table.setFilterKey}
                filterValue={table.filterValue}
                setFilterValue={table.setFilterValue}
                sortKey={table.sortKey}
                setSortKey={table.setSortKey}
                sortDir={table.sortDir}
                setSortDir={table.setSortDir}
                options={table.options}
              />
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
                    {listColumns.map((c) => (
                      <SortHeader key={c} label={c} active={table.sortKey === c} dir={table.sortDir} onClick={() => table.toggleSort(c)} />
                    ))}
                    <ActionsHeader />
                  </tr>
                </thead>
                <tbody>
                  {table.view.map((q) => (
                    <tr key={q.id} className="border-b border-line last:border-0">
                      <td className="px-3 py-2">
                        <HistoryTip history={q.history}>
                          <a className="text-copper underline" href={`/invoices/${q.id}`}>
                            {q.number}
                          </a>
                        </HistoryTip>
                      </td>
                      <td className="px-3 py-2">{q.client}</td>
                      <td className="px-3 py-2">{q.status}</td>
                      <td className="px-3 py-2">{q.project}</td>
                      <td className="px-3 py-2">₹{formatInr(q.total)}</td>
                      <td className="px-3 py-2">₹{formatInr(Number(q.gross))}</td>
                      <td className="px-3 py-2">₹{formatInr(Number(q.net))}</td>
                      <td className="px-3 py-2 text-right">
                        <span className="flex flex-wrap justify-end gap-0.5">
                          <ActionIcon action="preview" href={`/invoices/${q.id}/print`} target="_blank" rel="noreferrer" />
                          <ActionIcon action="pdf" href={`/api/invoices/${q.id}/pdf`} />
                          {canApprove && q.status === "DRAFT" ? (
                            <>
                              <ActionIcon action="approve" onClick={() => void decide(q.id, "SENT")} />
                              <ActionIcon action="reject" onClick={() => void decide(q.id, "VOID")} />
                            </>
                          ) : null}
                          {canCreate ? <ActionIcon action="edit" onClick={() => loadProposal(q)} /> : null}
                          {canTag && !q.projectId ? (
                            <ActionIcon action="tag" onClick={() => { setTagId(q.id); setTagProject(""); }} />
                          ) : null}
                          {canDelete ? <ActionIcon action="delete" onClick={() => void remove(q.id)} /> : null}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {tagId && tagging ? (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-ink/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-paper p-6">
            <h2 className="font-display text-2xl">Tag {tagging.number} to a project</h2>
            <p className="mt-1 text-sm text-ink-soft">Sets project budget from the quote fee and uses planned costs for margin vs actual spend.</p>
            <FormBanner message={tagError} />
            <div className="mt-4">
              <Field label={`Existing project for ${tagging.client}`} error={tagError && !tagProject ? tagError : ""}>
                <select
                  value={tagProject}
                  aria-invalid={Boolean(tagError && !tagProject)}
                  onChange={(e) => {
                    setTagProject(e.target.value);
                    setTagError("");
                  }}
                  className={controlClass(Boolean(tagError && !tagProject))}
                >
                  <option value="">Select</option>
                  {clientProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <ActionIcon action="cancel" onClick={() => setTagId(null)} />
              <ActionIcon action="new" disabled={saving} label="Create project" onClick={() => void tag(true)} />
              <ActionIcon action="tag" disabled={saving} label="Tag selected" onClick={() => void tag(false)} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
