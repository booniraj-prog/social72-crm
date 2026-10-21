"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatInr, formatInr2 } from "@/lib/money";
import { ActionIcon } from "@/components/ui/action-icon";
import { TableFrame } from "@/components/platform/table-controls";

type Line = { description: string; qty: string; rate: string };

export function QuoteBoard({
  clients,
  quotes,
}: {
  clients: Array<{ id: string; name: string; gstin?: string | null; contactName?: string | null }>;
  quotes: Array<{ id: string; number: string; client: string; status: string; total: number; dueDate: string | null }>;
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [validity, setValidity] = useState("15");
  const [paymentTerms, setPaymentTerms] = useState("50% on acceptance, balance before go-live");
  const [gstPct, setGstPct] = useState("18");
  const [scope, setScope] = useState("");
  const [inclusions, setInclusions] = useState("");
  const [exclusions, setExclusions] = useState("");
  const [assumptions, setAssumptions] = useState("");
  const [lines, setLines] = useState<Line[]>([
    { description: "Setup / onboarding", qty: "1", rate: "0" },
    { description: "Monthly retainer", qty: "12", rate: "0" },
  ]);
  const [adSpend, setAdSpend] = useState("0");
  const [vendor, setVendor] = useState("0");
  const [tools, setTools] = useState("0");
  const [people, setPeople] = useState("0");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const n = (v: string) => Number(v) || 0;
  const built = useMemo(
    () =>
      lines
        .filter((l) => l.description.trim())
        .map((l) => ({ description: l.description.trim(), qty: n(l.qty) || 1, rate: n(l.rate), amount: (n(l.qty) || 1) * n(l.rate) })),
    [lines],
  );
  const subtotal = built.reduce((s, l) => s + l.amount, 0);
  const gst = subtotal * (n(gstPct) / 100);
  const total = subtotal + gst;
  const cost = n(adSpend) + n(vendor) + n(tools) + n(people);
  const profit = total - cost;
  const margin = total > 0 ? Math.round((profit / total) * 1000) / 10 : 0;
  const client = clients.find((c) => c.id === clientId);

  function addLine() {
    setLines((rows) => [...rows, { description: "", qty: "1", rate: "0" }]);
  }

  async function save() {
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
    const res = await fetch("/api/platform?kind=invoice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId,
        kind: "QUOTE",
        gstPct: n(gstPct),
        dueDate: due.toISOString().slice(0, 10),
        paymentTerms,
        notes,
        lines: built,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(json.error?.message ?? "Could not save quote");
      return;
    }
    router.push(`/invoices/${json.row.id}`);
  }

  return (
    <div>
      <p className="text-xs uppercase tracking-[0.18em] text-ink-soft">Sales</p>
      <h1 className="mt-1 font-display text-3xl text-ink">Quotes</h1>
      <p className="mt-1 max-w-2xl text-sm text-ink-soft">
        Build a commercial quote with line items, GST, validity and terms. It saves as a draft until accounts approves it.
      </p>

      <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_280px]">
        <div className="surface rounded-lg p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-ink-soft">Client</span>
              <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="h-10 rounded-md border border-line bg-white px-3">
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-ink-soft">Package / title</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="h-10 rounded-md border border-line bg-white px-3" placeholder="e.g. Performance retainership" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-ink-soft">Valid for (days)</span>
              <input type="number" min={1} value={validity} onChange={(e) => setValidity(e.target.value)} className="h-10 rounded-md border border-line bg-white px-3" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-ink-soft">GST %</span>
              <input type="number" min={0} max={40} value={gstPct} onChange={(e) => setGstPct(e.target.value)} className="h-10 rounded-md border border-line bg-white px-3" />
            </label>
            <label className="sm:col-span-2 flex flex-col gap-1 text-sm">
              <span className="text-ink-soft">Payment terms</span>
              <input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} className="h-10 rounded-md border border-line bg-white px-3" />
            </label>
          </div>
          {client ? (
            <p className="mt-2 text-xs text-ink-soft">
              {client.contactName ?? "No contact"} · GSTIN {client.gstin ?? "—"}
            </p>
          ) : null}

          <h2 className="mt-5 font-display text-xl">Line items</h2>
          <div className="mt-2 space-y-2">
            {lines.map((line, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[1fr_80px_110px]">
                <input
                  value={line.description}
                  placeholder="Description"
                  onChange={(e) => setLines((rows) => rows.map((r, idx) => (idx === i ? { ...r, description: e.target.value } : r)))}
                  className="h-10 rounded-md border border-line bg-white px-3 text-sm"
                />
                <input
                  type="number"
                  min={0}
                  value={line.qty}
                  onChange={(e) => setLines((rows) => rows.map((r, idx) => (idx === i ? { ...r, qty: e.target.value } : r)))}
                  className="h-10 rounded-md border border-line bg-white px-3 text-sm"
                />
                <input
                  type="number"
                  min={0}
                  value={line.rate}
                  onChange={(e) => setLines((rows) => rows.map((r, idx) => (idx === i ? { ...r, rate: e.target.value } : r)))}
                  className="h-10 rounded-md border border-line bg-white px-3 text-sm"
                />
              </div>
            ))}
          </div>
          <ActionIcon action="add" onClick={addLine} />

          <div className="mt-5 grid gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-ink-soft">Scope of work</span>
              <textarea value={scope} onChange={(e) => setScope(e.target.value)} rows={3} className="rounded-md border border-line bg-white px-3 py-2" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-ink-soft">Inclusions</span>
              <textarea value={inclusions} onChange={(e) => setInclusions(e.target.value)} rows={2} className="rounded-md border border-line bg-white px-3 py-2" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-ink-soft">Exclusions</span>
              <textarea value={exclusions} onChange={(e) => setExclusions(e.target.value)} rows={2} className="rounded-md border border-line bg-white px-3 py-2" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-ink-soft">Assumptions</span>
              <textarea value={assumptions} onChange={(e) => setAssumptions(e.target.value)} rows={2} className="rounded-md border border-line bg-white px-3 py-2" />
            </label>
          </div>

          <h2 className="mt-5 font-display text-xl">Internal cost (margin)</h2>
          <div className="mt-2 grid gap-3 sm:grid-cols-4">
            <Cost label="Ad spend" value={adSpend} onChange={setAdSpend} />
            <Cost label="Vendor" value={vendor} onChange={setVendor} />
            <Cost label="Tools" value={tools} onChange={setTools} />
            <Cost label="Delivery" value={people} onChange={setPeople} />
          </div>

          {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
          <ActionIcon className="mt-5" action="save" disabled={saving || !clientId || built.length === 0} onClick={() => void save()} label="Save quote for approval" />
        </div>

        <aside className="card-mesh h-fit rounded-lg bg-pine px-5 py-5 text-white">
          <p className="text-[10px] uppercase tracking-[0.16em] text-white/70">Taxable</p>
          <p className="mt-1 font-display text-2xl">₹{formatInr2(subtotal)}</p>
          <p className="mt-4 text-[10px] uppercase tracking-[0.16em] text-white/70">GST</p>
          <p className="mt-1 font-display text-xl">₹{formatInr2(gst)}</p>
          <p className="mt-4 text-[10px] uppercase tracking-[0.16em] text-white/70">Quote total</p>
          <p className="mt-1 font-display text-3xl">₹{formatInr(total)}</p>
          <p className="mt-5 text-[10px] uppercase tracking-[0.16em] text-white/70">Gross margin</p>
          <p className="mt-1 font-display text-2xl">
            ₹{formatInr(profit)} · {margin}%
          </p>
        </aside>
      </div>

      <section className="surface mt-6 overflow-hidden rounded-lg p-4">
        <h2 className="font-display text-xl">Recent quotes</h2>
        <div className="mt-3 overflow-x-auto">
          <TableFrame
            rows={quotes.map((q) => ({ ...q, quote: q.number }))}
            columns={["quote", "client", "status", "total"]}
            empty="No quotes yet."
            renderRow={(q) => (
              <>
                <td className="px-3 py-2">
                  <a className="text-copper underline" href={`/invoices/${q.id}`}>
                    {String(q.quote)}
                  </a>
                </td>
                <td className="px-3 py-2">{String(q.client)}</td>
                <td className="px-3 py-2">{String(q.status)}</td>
                <td className="px-3 py-2">₹{formatInr(Number(q.total))}</td>
              </>
            )}
          />
        </div>
      </section>
    </div>
  );
}

function Cost({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-ink-soft">{label}</span>
      <input type="number" min={0} value={value} onChange={(e) => onChange(e.target.value)} className="h-10 rounded-md border border-line bg-white px-3" />
    </label>
  );
}
