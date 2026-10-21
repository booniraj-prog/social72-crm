"use client";

import { useEffect, useState } from "react";
import type { LeadOptions } from "@/modules/leads/types";
import { controlClass, Field, FormBanner, focusInvalid, validateRecord } from "@/components/platform/form-field";
import { ActionIcon } from "@/components/ui/action-icon";

type Client = { id: string; name: string; industry: { id: string; name: string } | null };
type Campaign = { id: string; name: string; clientId?: string };

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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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
        noValidate
        className="w-full max-w-2xl rounded-lg bg-paper p-6"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          const data = Object.fromEntries(form.entries()) as Record<string, string>;
          data.clientId = clientId;
          data.campaignId = campaignId;
          data.newCampaign = newCampaign;
          const nextErrors = validateRecord(data, [
            { name: "firstName", label: "First name", required: true },
            { name: "mobile", label: "Mobile", required: true, minLength: 8 },
            { name: "clientId", label: "Client", required: true },
            { name: "assignedUserId", label: "Assign to", required: true },
            { name: "email", label: "Email", type: "email" },
            { name: "expectedValue", label: "Expected value", type: "number", min: 0 },
            { name: "probabilityPct", label: "Probability", type: "number", min: 0, max: 100 },
          ]);
          if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
            nextErrors.email = "Enter a valid email address";
          }
          if (data.mobile && !/^[0-9+\-\s]{8,20}$/.test(data.mobile)) {
            nextErrors.mobile = "Enter a valid mobile number";
          }
          if (!campaignId && !(canCreateCampaign && newCampaign.trim())) {
            nextErrors.campaignId = "Select a campaign or enter a new campaign name";
          }
          setFieldErrors(nextErrors);
          if (Object.keys(nextErrors).length > 0) {
            setError("Please fix the highlighted fields.");
            requestAnimationFrame(() => focusInvalid(e.currentTarget));
            return;
          }
          setSaving(true);
          setError("");
          setDuplicateId(null);
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
              assignedUserId: form.get("assignedUserId") || "",
              temperature: form.get("temperature"),
              expectedValue: form.get("expectedValue") || 0,
              probabilityPct: form.get("probabilityPct") || 0,
              nextAction: form.get("nextAction"),
              priority: form.get("priority") || "MEDIUM",
              captureChannel: form.get("captureChannel") || "manual",
              serviceLine: form.get("serviceLine") || "",
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
        <FormBanner message={error} />
        {duplicateId ? (
          <p className="mt-2 text-sm text-danger">
            <a className="underline" href={`/leads/${duplicateId}`}>
              Open existing lead
            </a>
          </p>
        ) : null}
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Field label="First name" required error={fieldErrors.firstName}>
            <input name="firstName" aria-invalid={Boolean(fieldErrors.firstName)} onChange={() => setFieldErrors((c) => ({ ...c, firstName: "" }))} className={controlClass(Boolean(fieldErrors.firstName))} />
          </Field>
          <Field label="Last name">
            <input name="lastName" className={controlClass()} />
          </Field>
          <Field label="Mobile" required error={fieldErrors.mobile}>
            <input name="mobile" placeholder="9876543210" aria-invalid={Boolean(fieldErrors.mobile)} onChange={() => setFieldErrors((c) => ({ ...c, mobile: "" }))} className={controlClass(Boolean(fieldErrors.mobile))} />
          </Field>
          <Field label="Email" error={fieldErrors.email}>
            <input name="email" type="email" aria-invalid={Boolean(fieldErrors.email)} onChange={() => setFieldErrors((c) => ({ ...c, email: "" }))} className={controlClass(Boolean(fieldErrors.email))} />
          </Field>
          <Field label="City">
            <input name="city" className={controlClass()} />
          </Field>
          <Field label="State">
            <input name="state" className={controlClass()} />
          </Field>
          <div className="sm:col-span-2">
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
          </div>
          <Field label="Campaign" error={fieldErrors.campaignId}>
            <select
              value={campaignId}
              aria-invalid={Boolean(fieldErrors.campaignId)}
              onChange={(e) => {
                setCampaignId(e.target.value);
                setFieldErrors((c) => ({ ...c, campaignId: "" }));
              }}
              className={controlClass(Boolean(fieldErrors.campaignId))}
            >
              <option value="">Select campaign</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          {canCreateCampaign ? (
            <Field label="Or new campaign name">
              <input
                value={newCampaign}
                onChange={(e) => {
                  setNewCampaign(e.target.value);
                  setFieldErrors((c) => ({ ...c, campaignId: "" }));
                }}
                className={controlClass()}
              />
            </Field>
          ) : (
            <div />
          )}
          <Field label="Source">
            <select name="sourceId" className={controlClass()}>
              <option value="">Unknown</option>
              {options.sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Assign to" required error={fieldErrors.assignedUserId}>
            <select
              name="assignedUserId"
              aria-invalid={Boolean(fieldErrors.assignedUserId)}
              onChange={() => setFieldErrors((c) => ({ ...c, assignedUserId: "" }))}
              className={controlClass(Boolean(fieldErrors.assignedUserId))}
            >
              <option value="">Select employee</option>
              {options.assignees.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Temperature">
            <select name="temperature" defaultValue="WARM" className={controlClass()}>
              {options.temperatures.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Expected value (₹)" error={fieldErrors.expectedValue}>
            <input name="expectedValue" type="number" min={0} defaultValue={0} aria-invalid={Boolean(fieldErrors.expectedValue)} className={controlClass(Boolean(fieldErrors.expectedValue))} />
          </Field>
          <Field label="Probability %" error={fieldErrors.probabilityPct}>
            <input name="probabilityPct" type="number" min={0} max={100} defaultValue={0} aria-invalid={Boolean(fieldErrors.probabilityPct)} className={controlClass(Boolean(fieldErrors.probabilityPct))} />
          </Field>
          <Field label="Priority">
            <select name="priority" defaultValue="MEDIUM" className={controlClass()}>
              {["LOW", "MEDIUM", "HIGH", "URGENT"].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Capture channel">
            <select name="captureChannel" defaultValue="manual" className={controlClass()}>
              {["website", "landing_page", "whatsapp", "social", "phone", "manual"].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Next action">
              <input name="nextAction" className={controlClass()} />
            </Field>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <ActionIcon action="cancel" onClick={onClose} />
          <ActionIcon type="submit" action="save" disabled={saving} label="Create lead" />
        </div>
      </form>
    </div>
  );
}
