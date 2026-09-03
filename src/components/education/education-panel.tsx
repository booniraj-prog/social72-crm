"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  defaultIstCallbackLocal,
  formatIst,
  fromIstDateInput,
  fromIstDatetimeLocal,
  toIstDateInput,
} from "@/lib/time";
import { ADMISSION_STATUSES, PAYMENT_STATUSES } from "@/modules/education/types";
import type { LeadDetail, LeadStatus } from "@/modules/leads/types";

const fieldClass = "h-10 w-full rounded-md border border-line bg-white px-3 text-sm";

const PIPELINE_KEYS = [
  "PARENT_CONNECTED",
  "COUNSELLING",
  "CAMPUS_VISIT",
  "APPLICATION",
  "DOCUMENTATION",
  "FEE_DISCUSSION",
  "PAYMENT_PENDING",
  "ADMISSION_CONFIRMED",
] as const;

export function EducationPanel({ lead, statuses }: { lead: LeadDetail; statuses: LeadStatus[] }) {
  const router = useRouter();
  const edu = lead.education;
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [visitAt, setVisitAt] = useState(defaultIstCallbackLocal());
  const [visitCampus, setVisitCampus] = useState(edu?.preferredCampus ?? "");
  const [outcome, setOutcome] = useState("");
  const [form, setForm] = useState({
    studentName: edu?.studentName ?? lead.fullName,
    parentName: edu?.parentName ?? "",
    currentClass: edu?.currentClass ?? "",
    completedClass: edu?.completedClass ?? "",
    targetClass: edu?.targetClass ?? "",
    board: edu?.board ?? "",
    course: edu?.course ?? "",
    stream: edu?.stream ?? "",
    preferredCourse: edu?.preferredCourse ?? "",
    entranceExam: edu?.entranceExam ?? "",
    academicScore: edu?.academicScore ?? "",
    location: edu?.location ?? lead.city ?? "",
    preferredCampus: edu?.preferredCampus ?? "",
    hostelRequired: edu?.hostelRequired == null ? "" : edu.hostelRequired ? "true" : "false",
    parentOccupation: edu?.parentOccupation ?? "",
    budget: edu?.budget == null ? "" : String(edu.budget),
    admissionTimeline: edu?.admissionTimeline ?? "",
    campusVisitDate: toIstDateInput(edu?.campusVisitDate ?? null),
    counsellingDate: toIstDateInput(edu?.counsellingDate ?? null),
    admissionStatus: edu?.admissionStatus ?? "",
    fee: edu?.fee == null ? "" : String(edu.fee),
    scholarship: edu?.scholarship == null ? "" : String(edu.scholarship),
    paymentStatus: edu?.paymentStatus ?? "",
  });

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

  const visits = lead.campusVisits ?? [];

  return (
    <div className="rounded-lg border border-line bg-white p-5">
      <h2 className="text-xs uppercase tracking-[0.16em] text-ink-soft">Education admissions</h2>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Field label="Student name" value={form.studentName} onChange={(v) => set("studentName", v)} />
        <Field label="Parent name" value={form.parentName} onChange={(v) => set("parentName", v)} />
        <Field label="Current class" value={form.currentClass} onChange={(v) => set("currentClass", v)} />
        <Field label="Completed class" value={form.completedClass} onChange={(v) => set("completedClass", v)} />
        <Field label="Target class" value={form.targetClass} onChange={(v) => set("targetClass", v)} />
        <Field label="Board" value={form.board} onChange={(v) => set("board", v)} />
        <Field label="Course" value={form.course} onChange={(v) => set("course", v)} />
        <Field label="Stream" value={form.stream} onChange={(v) => set("stream", v)} />
        <Field label="Preferred course" value={form.preferredCourse} onChange={(v) => set("preferredCourse", v)} />
        <Field label="Entrance exam" value={form.entranceExam} onChange={(v) => set("entranceExam", v)} />
        <Field label="Academic score" value={form.academicScore} onChange={(v) => set("academicScore", v)} />
        <Field label="Location" value={form.location} onChange={(v) => set("location", v)} />
        <Field label="Preferred campus" value={form.preferredCampus} onChange={(v) => set("preferredCampus", v)} />
        <label className="text-xs text-ink-soft">
          Hostel
          <select
            className={`${fieldClass} mt-1`}
            value={form.hostelRequired}
            onChange={(e) => set("hostelRequired", e.target.value)}
          >
            <option value="">Unknown</option>
            <option value="true">Required</option>
            <option value="false">Not required</option>
          </select>
        </label>
        <Field label="Parent occupation" value={form.parentOccupation} onChange={(v) => set("parentOccupation", v)} />
        <Field label="Budget" value={form.budget} onChange={(v) => set("budget", v)} />
        <Field label="Admission timeline" value={form.admissionTimeline} onChange={(v) => set("admissionTimeline", v)} />
        <label className="text-xs text-ink-soft">
          Counselling date
          <input
            type="date"
            className={`${fieldClass} mt-1`}
            value={form.counsellingDate}
            onChange={(e) => set("counsellingDate", e.target.value)}
          />
        </label>
        <label className="text-xs text-ink-soft">
          Campus visit date
          <input
            type="date"
            className={`${fieldClass} mt-1`}
            value={form.campusVisitDate}
            onChange={(e) => set("campusVisitDate", e.target.value)}
          />
        </label>
        <label className="text-xs text-ink-soft">
          Admission status
          <select
            className={`${fieldClass} mt-1`}
            value={form.admissionStatus}
            onChange={(e) => set("admissionStatus", e.target.value)}
          >
            <option value="">—</option>
            {ADMISSION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <Field label="Fee" value={form.fee} onChange={(v) => set("fee", v)} />
        <Field label="Scholarship" value={form.scholarship} onChange={(v) => set("scholarship", v)} />
        <label className="text-xs text-ink-soft">
          Payment status
          <select
            className={`${fieldClass} mt-1`}
            value={form.paymentStatus}
            onChange={(e) => set("paymentStatus", e.target.value)}
          >
            <option value="">—</option>
            {PAYMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button
        type="button"
        disabled={!!busy}
        onClick={() =>
          post(
            `/api/leads/${lead.id}/education`,
            {
              ...form,
              campusVisitDate: fromIstDateInput(form.campusVisitDate)?.toISOString() ?? "",
              counsellingDate: fromIstDateInput(form.counsellingDate)?.toISOString() ?? "",
            },
            "edu",
          )
        }
        className="mt-3 h-9 rounded-md bg-ink px-3 text-sm text-white disabled:opacity-50"
      >
        Save education details
      </button>

      <div className="mt-5">
        <p className="text-[10px] uppercase tracking-[0.16em] text-ink-soft">Admissions pipeline</p>
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
        <p className="text-[10px] uppercase tracking-[0.16em] text-ink-soft">Campus visit</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <input
            type="datetime-local"
            className={fieldClass}
            value={visitAt}
            onChange={(e) => setVisitAt(e.target.value)}
            aria-label="Campus visit time IST"
          />
          <input
            className={fieldClass}
            placeholder="Campus"
            value={visitCampus}
            onChange={(e) => setVisitCampus(e.target.value)}
          />
        </div>
        <button
          type="button"
          disabled={!!busy}
          onClick={() => {
            const scheduledAt = fromIstDatetimeLocal(visitAt);
            if (!scheduledAt) {
              setError("Enter a campus visit date and time (IST)");
              return;
            }
            void post(`/api/leads/${lead.id}/campus-visits`, { scheduledAt, campus: visitCampus }, "visit");
          }}
          className="mt-2 h-9 rounded-md bg-ink px-3 text-sm text-white disabled:opacity-50"
        >
          Schedule campus visit
        </button>

        <ul className="mt-3 space-y-2 text-sm">
          {visits.length === 0 ? (
            <li className="text-ink-soft">No campus visits yet.</li>
          ) : (
            visits.map((visit) => (
              <li key={visit.id} className="rounded-md border border-line px-3 py-2">
                <p className="font-medium">
                  {visit.campus || "Campus"} · {visit.completedAt ? "Completed" : "Scheduled"}
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
                        post(
                          `/api/leads/${lead.id}/campus-visits/${visit.id}/complete`,
                          { outcome },
                          "done",
                        )
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
