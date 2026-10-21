"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SERVICE_LINES } from "@/modules/platform/constants";
import { ActionIcon } from "@/components/ui/action-icon";

const fieldClass = "h-10 w-full rounded-md border border-line bg-white px-3 text-sm";

export function ServicePanel({
  leadId,
  details,
}: {
  leadId: string;
  details?: { serviceLine: string | null; requirement: string | null; proposalValue: number | null; milestone: string | null } | null;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    serviceLine: details?.serviceLine ?? "",
    requirement: details?.requirement ?? "",
    proposalValue: details?.proposalValue == null ? "" : String(details.proposalValue),
    milestone: details?.milestone ?? "",
  });

  async function save() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/platform?kind=service-details", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId, ...form }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(json.error?.message ?? "Could not save");
      return;
    }
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <h2 className="text-xs uppercase tracking-[0.16em] text-ink-soft">Service requirement</h2>
      <div className="mt-3 grid gap-3">
        <label className="text-sm">
          <span className="text-ink-soft">Service line</span>
          <select
            className={`${fieldClass} mt-1`}
            value={form.serviceLine}
            onChange={(e) => setForm((f) => ({ ...f, serviceLine: e.target.value }))}
          >
            <option value="">Select</option>
            {SERVICE_LINES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="text-ink-soft">Requirement</span>
          <textarea
            className="mt-1 min-h-24 w-full rounded-md border border-line bg-white px-3 py-2 text-sm"
            value={form.requirement}
            onChange={(e) => setForm((f) => ({ ...f, requirement: e.target.value }))}
          />
        </label>
        <label className="text-sm">
          <span className="text-ink-soft">Proposal value</span>
          <input
            type="number"
            className={`${fieldClass} mt-1`}
            value={form.proposalValue}
            onChange={(e) => setForm((f) => ({ ...f, proposalValue: e.target.value }))}
          />
        </label>
        <label className="text-sm">
          <span className="text-ink-soft">Milestone</span>
          <input
            className={`${fieldClass} mt-1`}
            value={form.milestone}
            onChange={(e) => setForm((f) => ({ ...f, milestone: e.target.value }))}
          />
        </label>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <ActionIcon action="save" disabled={busy} onClick={() => void save()} label="Save service details" />
      </div>
    </div>
  );
}
