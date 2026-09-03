"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  defaultIstCallbackLocal,
  formatIst,
  fromIstDateInput,
  fromIstDatetimeLocal,
  toIstDateInput,
} from "@/lib/time";
import {
  CONFIGURATIONS,
  NEGOTIATION_STATUSES,
  PROPERTY_TYPES,
  PURPOSES,
  REGISTRATION_STATUSES,
  SITE_VISIT_STATUSES,
  USE_TYPES,
} from "@/modules/real-estate/types";
import type { LeadDetail, LeadStatus } from "@/modules/leads/types";

const fieldClass = "h-10 w-full rounded-md border border-line bg-white px-3 text-sm";

const PIPELINE_KEYS = [
  "PROPERTY_SHARED",
  "SITE_VISIT",
  "SITE_VISIT_COMPLETED",
  "NEGOTIATION",
  "BOOKING",
  "DOCUMENTATION",
  "REGISTRATION",
] as const;

type Inventory = {
  projects: Array<{ id: string; name: string; clientId: string; location: string | null }>;
  properties: Array<{
    id: string;
    name: string;
    projectId: string | null;
    clientId: string;
    configuration: string | null;
  }>;
};

export function RealEstatePanel({
  lead,
  statuses,
  inventory,
}: {
  lead: LeadDetail;
  statuses: LeadStatus[];
  inventory: Inventory;
}) {
  const router = useRouter();
  const re = lead.realEstate;
  const clientProjects = inventory.projects.filter((p) => p.clientId === lead.client.id);
  const clientProperties = inventory.properties.filter((p) => p.clientId === lead.client.id);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [visitAt, setVisitAt] = useState(defaultIstCallbackLocal());
  const [outcome, setOutcome] = useState("");
  const [form, setForm] = useState({
    projectId: re?.projectId ?? "",
    propertyId: re?.propertyId ?? "",
    location: re?.location ?? "",
    propertyType: re?.propertyType ?? "",
    configuration: re?.configuration ?? "",
    budget: re?.budget == null ? "" : String(re.budget),
    preferredLocation: re?.preferredLocation ?? "",
    purpose: re?.purpose ?? "",
    useType: re?.useType ?? "",
    possessionRequirement: re?.possessionRequirement ?? "",
    loanRequired: re?.loanRequired == null ? "" : re.loanRequired ? "true" : "false",
    siteVisitDate: toIstDateInput(re?.siteVisitDate ?? null),
    siteVisitStatus: re?.siteVisitStatus ?? "",
    negotiationStatus: re?.negotiationStatus ?? "",
    bookingAmount: re?.bookingAmount == null ? "" : String(re.bookingAmount),
    expectedRegistrationDate: toIstDateInput(re?.expectedRegistrationDate ?? null),
    registrationStatus: re?.registrationStatus ?? "",
    propertyValue: re?.propertyValue == null ? "" : String(re.propertyValue),
  });

  const propertiesForProject = useMemo(
    () =>
      form.projectId
        ? clientProperties.filter((p) => p.projectId === form.projectId)
        : clientProperties,
    [clientProperties, form.projectId],
  );

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function post(path: string, body: unknown, label: string) {
    setBusy(label);
    setError("");
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      setBusy("");
      if (!res.ok) {
        setError(json.error?.message ?? "Action failed");
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setBusy("");
      setError("Could not reach the server. If the app just restarted, try again.");
      return false;
    }
  }

  const visits = lead.siteVisits ?? [];

  return (
    <div className="rounded-lg border border-line bg-white p-5">
      <h2 className="text-xs uppercase tracking-[0.16em] text-ink-soft">Real estate</h2>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-ink-soft">
          Project
          <select className={`${fieldClass} mt-1`} value={form.projectId} onChange={(e) => set("projectId", e.target.value)}>
            <option value="">—</option>
            {clientProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-ink-soft">
          Property
          <select className={`${fieldClass} mt-1`} value={form.propertyId} onChange={(e) => set("propertyId", e.target.value)}>
            <option value="">—</option>
            {propertiesForProject.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.configuration ? ` · ${p.configuration}` : ""}
              </option>
            ))}
          </select>
        </label>
        <Field label="Location" value={form.location} onChange={(v) => set("location", v)} />
        <Select label="Property type" value={form.propertyType} onChange={(v) => set("propertyType", v)} options={PROPERTY_TYPES} />
        <Select label="Configuration" value={form.configuration} onChange={(v) => set("configuration", v)} options={CONFIGURATIONS} />
        <Field label="Budget" value={form.budget} onChange={(v) => set("budget", v)} />
        <Field label="Preferred location" value={form.preferredLocation} onChange={(v) => set("preferredLocation", v)} />
        <Select label="Purpose" value={form.purpose} onChange={(v) => set("purpose", v)} options={PURPOSES} />
        <Select label="Use" value={form.useType} onChange={(v) => set("useType", v)} options={USE_TYPES} />
        <Field label="Possession" value={form.possessionRequirement} onChange={(v) => set("possessionRequirement", v)} />
        <label className="text-xs text-ink-soft">
          Loan
          <select className={`${fieldClass} mt-1`} value={form.loanRequired} onChange={(e) => set("loanRequired", e.target.value)}>
            <option value="">Unknown</option>
            <option value="true">Required</option>
            <option value="false">Not required</option>
          </select>
        </label>
        <label className="text-xs text-ink-soft">
          Site visit date
          <input type="date" className={`${fieldClass} mt-1`} value={form.siteVisitDate} onChange={(e) => set("siteVisitDate", e.target.value)} />
        </label>
        <Select label="Site visit status" value={form.siteVisitStatus} onChange={(v) => set("siteVisitStatus", v)} options={SITE_VISIT_STATUSES} />
        <Select label="Negotiation" value={form.negotiationStatus} onChange={(v) => set("negotiationStatus", v)} options={NEGOTIATION_STATUSES} />
        <Field label="Booking amount" value={form.bookingAmount} onChange={(v) => set("bookingAmount", v)} />
        <label className="text-xs text-ink-soft">
          Expected registration
          <input
            type="date"
            className={`${fieldClass} mt-1`}
            value={form.expectedRegistrationDate}
            onChange={(e) => set("expectedRegistrationDate", e.target.value)}
          />
        </label>
        <Select label="Registration" value={form.registrationStatus} onChange={(v) => set("registrationStatus", v)} options={REGISTRATION_STATUSES} />
        <Field label="Property value" value={form.propertyValue} onChange={(v) => set("propertyValue", v)} />
      </div>

      <button
        type="button"
        disabled={!!busy}
        onClick={() =>
          post(
            `/api/leads/${lead.id}/real-estate`,
            {
              ...form,
              siteVisitDate: fromIstDateInput(form.siteVisitDate)?.toISOString() ?? "",
              expectedRegistrationDate: fromIstDateInput(form.expectedRegistrationDate)?.toISOString() ?? "",
            },
            "re",
          )
        }
        className="mt-3 h-9 rounded-md bg-ink px-3 text-sm text-white disabled:opacity-50"
      >
        Save real estate details
      </button>

      <div className="mt-5">
        <p className="text-[10px] uppercase tracking-[0.16em] text-ink-soft">Sales pipeline</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {PIPELINE_KEYS.map((key) => {
            const status = statuses.find((s) => s.key === key);
            if (!status) return null;
            return (
              <button
                key={key}
                type="button"
                disabled={!!busy}
                onClick={() => post(`/api/leads/${lead.id}/status`, { statusId: status.id }, "status")}
                className={`rounded-md px-2 py-1 text-[11px] capitalize disabled:opacity-50 ${
                  lead.status.key === key ? "bg-ink text-white" : "border border-line bg-paper-2 text-ink"
                }`}
              >
                {status.name.toLowerCase()}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5 border-t border-line pt-4">
        <p className="text-[10px] uppercase tracking-[0.16em] text-ink-soft">Site visit</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <input
            type="datetime-local"
            className={fieldClass}
            value={visitAt}
            onChange={(e) => setVisitAt(e.target.value)}
            aria-label="Site visit time IST"
          />
          <select
            className={fieldClass}
            value={form.propertyId}
            onChange={(e) => set("propertyId", e.target.value)}
          >
            <option value="">Property (optional)</option>
            {clientProperties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          disabled={!!busy}
          onClick={() => {
            const scheduledAt = fromIstDatetimeLocal(visitAt);
            if (!scheduledAt) {
              setError("Enter a site visit date and time (IST)");
              return;
            }
            void post(
              `/api/leads/${lead.id}/site-visits`,
              { scheduledAt, propertyId: form.propertyId },
              "visit",
            );
          }}
          className="mt-2 h-9 rounded-md bg-ink px-3 text-sm text-white disabled:opacity-50"
        >
          Schedule site visit
        </button>
        <ul className="mt-3 space-y-2 text-sm">
          {visits.length === 0 ? (
            <li className="text-ink-soft">No site visits yet.</li>
          ) : (
            visits.map((visit) => (
              <li key={visit.id} className="rounded-md border border-line px-3 py-2">
                <p className="font-medium">
                  {visit.property?.name || "Site"} · {visit.completedAt ? "Completed" : "Scheduled"}
                </p>
                <p className="text-xs text-ink-soft">
                  {formatIst(visit.scheduledAt)}
                  {visit.outcome ? ` · ${visit.outcome}` : ""}
                </p>
                {!visit.completedAt ? (
                  <div className="mt-2 flex gap-2">
                    <input
                      className={fieldClass}
                      placeholder="Outcome"
                      value={outcome}
                      onChange={(e) => setOutcome(e.target.value)}
                    />
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() =>
                        post(`/api/leads/${lead.id}/site-visits/${visit.id}/complete`, { outcome }, "done")
                      }
                      className="h-10 shrink-0 rounded-md border border-line px-3 text-sm"
                    >
                      Complete
                    </button>
                  </div>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-xs text-ink-soft">
      {label}
      <input className={`${fieldClass} mt-1`} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
}) {
  return (
    <label className="text-xs text-ink-soft">
      {label}
      <select className={`${fieldClass} mt-1`} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
