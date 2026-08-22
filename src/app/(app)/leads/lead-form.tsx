"use client";

import { useEffect, useState } from "react";
import type { LeadOptions } from "@/modules/leads/types";

type Client = { id: string; name: string; industry: { id: string; name: string } | null };
type Campaign = { id: string; name: string; clientId?: string };

const fieldClass = "h-10 rounded-md border border-line bg-white px-3 text-sm";

export function LeadForm({
  options,
  clients,
  canCreateCampaign,
  onClose,
  onCreated,
}: {
  options: LeadOptions;
  clients: Client[];
  canCreateCampaign: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [duplicateId, setDuplicateId] = useState<string | null>(null);
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignId, setCampaignId] = useState("");
  const [newCampaign, setNewCampaign] = useState("");

  useEffect(() => {
    if (!clientId) {
      setCampaigns([]);
      setCampaignId("");
      return;
    }
    fetch(`/api/campaigns?clientId=${clientId}`)
      .then((r) => r.json())
      .then((json) => {
        const list = json.campaigns ?? [];
        setCampaigns(list);
        setCampaignId(list[0]?.id ?? "");
      })
      .catch(() => setCampaigns([]));
  }, [clientId]);

  async function ensureCampaign() {
    if (campaignId) return campaignId;
    if (!canCreateCampaign || !newCampaign.trim()) {
      throw new Error("Select or create a campaign");
    }
    const res = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, name: newCampaign.trim() }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message ?? "Could not create campaign");
    return json.campaign.id as string;
  }

  return (
    <div className="fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 py-10">
      <form
        className="w-full max-w-2xl rounded-lg bg-paper p-6"
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          setError("");
          setDuplicateId(null);
          const form = new FormData(e.currentTarget);
          try {
            const cid = await ensureCampaign();
            const payload = {
              firstName: form.get("firstName"),
              lastName: form.get("lastName"),
              mobile: form.get("mobile"),
              email: form.get("email"),
              city: form.get("city"),
              state: form.get("state"),
              clientId,
              campaignId: cid,
              sourceId: form.get("sourceId") || null,
              assignedUserId: form.get("assignedUserId") || null,
              temperature: form.get("temperature"),
              expectedValue: form.get("expectedValue") || 0,
              probabilityPct: form.get("probabilityPct") || 0,
              nextAction: form.get("nextAction"),
            };
            const res = await fetch("/api/leads", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
            const json = await res.json();
            if (!res.ok) {
              setDuplicateId(json.error?.details?.existing?.id ?? null);
              throw new Error(json.error?.message ?? "Could not create lead");
            }
            onCreated(json.lead.id);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not create lead");
            setSaving(false);
          }
        }}
      >
        <h2 className="font-display text-2xl">New lead</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-soft">First name</span>
            <input name="firstName" required className={fieldClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-soft">Last name</span>
            <input name="lastName" className={fieldClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-soft">Mobile</span>
            <input name="mobile" required placeholder="9876543210" className={fieldClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-soft">Email</span>
            <input name="email" type="email" className={fieldClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-soft">City</span>
            <input name="city" className={fieldClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-soft">State</span>
            <input name="state" className={fieldClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="text-ink-soft">Client</span>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} required className={fieldClass}>
              <option value="">Select client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-soft">Campaign</span>
            <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} className={fieldClass}>
              <option value="">Select campaign</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          {canCreateCampaign ? (
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-ink-soft">Or new campaign name</span>
              <input value={newCampaign} onChange={(e) => setNewCampaign(e.target.value)} className={fieldClass} />
            </label>
          ) : (
            <div />
          )}
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-soft">Source</span>
            <select name="sourceId" className={fieldClass}>
              <option value="">Unknown</option>
              {options.sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-soft">Assign to</span>
            <select name="assignedUserId" className={fieldClass}>
              <option value="">Unassigned</option>
              {options.assignees.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-soft">Temperature</span>
            <select name="temperature" defaultValue="WARM" className={fieldClass}>
              {options.temperatures.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-soft">Expected value (₹)</span>
            <input name="expectedValue" type="number" min={0} defaultValue={0} className={fieldClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-soft">Probability %</span>
            <input name="probabilityPct" type="number" min={0} max={100} defaultValue={0} className={fieldClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="text-ink-soft">Next action</span>
            <input name="nextAction" className={fieldClass} />
          </label>
        </div>
        {error ? (
          <p className="mt-3 text-sm text-danger">
            {error}
            {duplicateId ? (
              <>
                {" "}
                <a className="underline" href={`/leads/${duplicateId}`}>
                  Open existing lead
                </a>
              </>
            ) : null}
          </p>
        ) : null}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-10 px-3 text-sm text-ink-soft">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="h-10 rounded-md bg-copper px-4 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? "Saving…" : "Create lead"}
          </button>
        </div>
      </form>
    </div>
  );
}
