"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { LeadDetail, LeadOptions } from "@/modules/leads/types";
import { IssueBadge, QualityMarks, ScoreMark } from "@/components/leads/quality-marks";
import { ActiveToggle } from "@/components/platform/active-toggle";
import { fromIstDatetimeLocal, toIstDatetimeLocal } from "@/lib/time";
import { ServicePanel } from "@/components/services/service-panel";
import {
  GMEET_NEW,
  TOUCH_POINTS,
  smsHref,
  telHref,
  touchMessage,
  waHref,
} from "@/lib/touch-points";

const fieldClass = "h-10 w-full rounded-md border border-line bg-white px-3 text-sm";

function formatWhen(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function LeadWorkspace({
  lead,
  options,
  canAssign,
  canPick,
  canWrite,
}: {
  lead: LeadDetail;
  options: LeadOptions;
  canAssign: boolean;
  canPick: boolean;
  canWrite?: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [followAt, setFollowAt] = useState(toIstDatetimeLocal(lead.nextFollowupAt));
  const [followAction, setFollowAction] = useState(lead.nextAction ?? "");
  const [touchKind, setTouchKind] = useState(
    lead.followUps.find((item) => !item.completedAt)?.kind || "call",
  );
  const [meetUrl, setMeetUrl] = useState(
    lead.followUps.find((item) => !item.completedAt)?.meetUrl || "",
  );
  const [meetPlace, setMeetPlace] = useState(
    lead.followUps.find((item) => !item.completedAt)?.location || "",
  );
  const [icsId, setIcsId] = useState(lead.followUps.find((item) => !item.completedAt)?.id ?? "");
  const [busy, setBusy] = useState("");
  const msg = touchMessage(touchKind, lead.fullName, lead.client.name);
  const callLink = telHref(lead.mobileE164);
  const waLink = waHref(lead.mobileE164, msg);
  const smsLink = smsHref(lead.mobileE164, msg);
  const brochureHref = `/documents?clientId=${lead.client.id}`;

  function downloadIcs(id: string) {
    const a = document.createElement("a");
    a.href = `/api/follow-ups/${id}/ics`;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    a.remove();
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
        return json;
      }
      if (typeof json.followUpId === "string") {
        setIcsId(json.followUpId);
        downloadIcs(json.followUpId);
      }
      router.refresh();
      return json;
    } catch {
      setBusy("");
      setError("Could not reach the server. If the app just restarted, try again.");
      return null;
    }
  }

  const won = options.statuses.find((s) => s.key === "CLOSED_WON");
  const lost = options.statuses.find((s) => s.key === "CLOSED_LOST");
  const interested = options.statuses.find((s) => s.key === "INTERESTED");
  const notInterested = options.statuses.find((s) => s.key === "NOT_INTERESTED");
  const nurture = options.statuses.find((s) => s.key === "NURTURE");

  return (
    <div>
      <Link href="/leads" className="text-xs text-ink-soft hover:text-ink">
        ← All leads
      </Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-ink-soft">{lead.leadNumber}</p>
          <h1 className="mt-1 font-display text-4xl text-ink">{lead.fullName}</h1>
          <div className="mt-1">
            <IssueBadge statusKey={lead.status.key} />
          </div>
          <p className="mt-1 text-sm text-ink-soft">
            {lead.client.name} · {lead.campaign.name}
            {lead.assignedUser ? ` · ${lead.assignedUser.name}` : " · Unassigned"}
          </p>
        </div>
        <div className="flex gap-2">
          {canWrite ? (
            <ActiveToggle entity="lead" id={lead.id} active={lead.isActive !== false} name={lead.fullName} />
          ) : null}
          {canPick && !lead.assignedUser ? (
            <button
              type="button"
              disabled={!!busy}
              onClick={() => post(`/api/leads/${lead.id}/claim`, {}, "pick")}
              className="inline-flex h-10 items-center rounded-md border border-line px-4 text-sm text-ink hover:bg-paper-2"
            >
              Pick lead
            </button>
          ) : null}
          <Link
            href={`/calling?leadId=${lead.id}`}
            className="inline-flex h-10 items-center rounded-md border border-line px-4 text-sm text-ink hover:bg-paper-2"
          >
            Calling workspace
          </Link>
          <a
            href={`tel:${lead.mobileE164}`}
            className="inline-flex h-10 items-center rounded-md bg-copper px-4 text-sm font-medium text-white hover:bg-copper-dark"
          >
            Call {lead.mobileE164}
          </a>
        </div>
      </div>
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(260px,0.9fr)_minmax(0,1.3fr)_minmax(280px,0.95fr)]">
        <section className="space-y-4">
          <Panel title="Lead">
            <Fact label="Mobile" value={lead.mobileE164} />
            <Fact label="Email" value={lead.email ?? "—"} />
            <Fact label="City" value={[lead.city, lead.state].filter(Boolean).join(", ") || "—"} />
            <Fact label="Occupation" value={lead.occupation ?? "—"} />
            <Fact label="Source" value={lead.source?.name ?? lead.sourcePlatform ?? "—"} />
          </Panel>
          <Panel title="CRM">
            <Fact label="Status" value={lead.status.name} />
            <Fact label="Temperature" value={lead.temperature} />
            <Fact label="Score" value={<ScoreMark value={lead.leadScore} />} />
            <Fact label="Owner" value={lead.assignedUser?.name ?? "Unassigned"} />
            <Fact label="Priority" value={(lead as { priority?: string }).priority ?? "MEDIUM"} />
            <Fact label="Channel" value={(lead as { captureChannel?: string | null }).captureChannel ?? "—"} />
            <Fact label="Next action" value={lead.nextAction ?? "—"} />
            <Fact label="Next follow-up" value={formatWhen(lead.nextFollowupAt)} />
            <Fact label="Last activity" value={formatWhen(lead.lastActivityAt)} />
          </Panel>
          <Panel title="Commercial">
            <Fact label="Expected value" value={`₹${Number(lead.expectedValue).toLocaleString("en-IN")}`} />
            <Fact label="Probability" value={`${lead.probabilityPct}%`} />
            <Fact label="Expected revenue" value={`₹${Number(lead.expectedRevenue).toLocaleString("en-IN")}`} />
          </Panel>
        </section>

        <section className="space-y-4">
          {lead.industry?.key === "services" ? (
            <ServicePanel
              leadId={lead.id}
              details={(lead as { serviceDetails?: { serviceLine: string | null; requirement: string | null; proposalValue: number | null; milestone: string | null } | null }).serviceDetails}
            />
          ) : null}
          <div className="rounded-lg border border-line bg-white p-5">
            <h2 className="text-xs uppercase tracking-[0.16em] text-ink-soft">Call history</h2>
            <ul className="mt-4 space-y-3">
              {(lead.callLogs ?? []).length === 0 ? (
                <li className="text-sm text-ink-soft">No calls logged.</li>
              ) : (
                (lead.callLogs ?? []).map((call) => (
                  <li key={call.id} className="border-l border-line pl-4 text-sm">
                    <p className="font-medium">
                      {call.disposition?.name ?? "Call"} · {call.user.name}
                    </p>
                    {call.notes ? <p className="text-ink-soft">{call.notes}</p> : null}
                    <p className="text-xs text-ink-soft">{formatWhen(call.startedAt)}</p>
                  </li>
                ))
              )}
            </ul>
          </div>
          <div className="rounded-lg border border-line bg-white p-5">
          <h2 className="text-xs uppercase tracking-[0.16em] text-ink-soft">Timeline</h2>
          <ol className="mt-4 space-y-4">
            {(lead.activities ?? []).map((item) => (
              <li key={item.id} className="border-l border-line pl-4">
                <p className="text-sm font-medium text-ink">{item.title}</p>
                {item.body ? <p className="mt-0.5 text-sm text-ink-soft">{item.body}</p> : null}
                <p className="mt-1 text-xs text-ink-soft">
                  {formatWhen(item.createdAt)}
                  {item.user ? ` · ${item.user.name}` : ""}
                </p>
              </li>
            ))}
            {(lead.activities ?? []).length === 0 ? (
              <p className="text-sm text-ink-soft">No activity yet.</p>
            ) : null}
          </ol>
          </div>
        </section>

        <section className="space-y-4">
          <Panel title="Actions">
            <label className="block text-sm">
              <span className="text-ink-soft">Status</span>
              <select
                className={`${fieldClass} mt-1`}
                defaultValue={lead.status.id}
                disabled={!!busy}
                onChange={(e) => post(`/api/leads/${lead.id}/status`, { statusId: e.target.value, reason }, "status")}
              >
                {options.statuses.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-ink-soft">Temperature</span>
              <select
                className={`${fieldClass} mt-1`}
                defaultValue={lead.temperature}
                disabled={!!busy}
                onChange={(e) =>
                  post(`/api/leads/${lead.id}/temperature`, { temperature: e.target.value }, "temp")
                }
              >
                {options.temperatures.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            {canAssign ? (
              <label className="block text-sm">
                <span className="text-ink-soft">Assign</span>
                <select
                  className={`${fieldClass} mt-1`}
                  defaultValue={lead.assignedUser?.id ?? ""}
                  disabled={!!busy}
                  onChange={(e) => {
                    if (!e.target.value) return;
                    post(`/api/leads/${lead.id}/assign`, { assignedUserId: e.target.value }, "assign");
                  }}
                >
                  {!lead.assignedUser ? <option value="">Select employee</option> : null}
                  {options.assignees.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <div className="flex flex-wrap gap-2 pt-1">
              {interested ? (
                <MiniAction
                  disabled={!!busy}
                  onClick={() => post(`/api/leads/${lead.id}/status`, { statusId: interested.id }, "status")}
                >
                  Interested
                </MiniAction>
              ) : null}
              {notInterested ? (
                <MiniAction
                  disabled={!!busy}
                  onClick={() => post(`/api/leads/${lead.id}/status`, { statusId: notInterested.id }, "status")}
                >
                  Not interested
                </MiniAction>
              ) : null}
              {nurture ? (
                <MiniAction
                  disabled={!!busy}
                  onClick={() => post(`/api/leads/${lead.id}/status`, { statusId: nurture.id }, "status")}
                >
                  Nurture
                </MiniAction>
              ) : null}
            </div>
            <div className="pt-2">
              <QualityMarks
                statuses={options.statuses}
                currentKey={lead.status.key}
                disabled={!!busy}
                onPick={(statusId) => post(`/api/leads/${lead.id}/status`, { statusId }, "status")}
              />
            </div>
          </Panel>

          <Panel title="Note">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-line bg-white p-2 text-sm"
              placeholder="What happened on the call?"
            />
            <button
              type="button"
              disabled={!!busy || !note.trim()}
              onClick={async () => {
                await post(`/api/leads/${lead.id}/notes`, { body: note }, "note");
                setNote("");
              }}
              className="mt-2 h-9 rounded-md bg-ink px-3 text-sm text-white disabled:opacity-50"
            >
              Add note
            </button>
          </Panel>

          <Panel title="Follow-up">
            <select
              value={touchKind}
              onChange={(e) => {
                const next = e.target.value;
                setTouchKind(next);
                if (next === "gmeet" && !meetUrl) setMeetUrl(GMEET_NEW);
              }}
              className={fieldClass}
              aria-label="Touch point"
            >
              {TOUCH_POINTS.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
            <input
              type="datetime-local"
              value={followAt}
              onChange={(e) => setFollowAt(e.target.value)}
              className={fieldClass}
              aria-label="Next follow-up in IST"
            />
            <p className="text-[11px] text-ink-soft">Time is IST. Saving creates a calendar .ics file you can download.</p>
            <input
              value={followAction}
              onChange={(e) => setFollowAction(e.target.value)}
              placeholder="Note for this touch (optional)"
              className={fieldClass}
            />
            {touchKind === "gmeet" || touchKind === "meeting" ? (
              <>
                <input
                  value={meetUrl}
                  onChange={(e) => setMeetUrl(e.target.value)}
                  placeholder="Meet URL (defaults to Google Meet new room)"
                  className={fieldClass}
                />
                <input
                  value={meetPlace}
                  onChange={(e) => setMeetPlace(e.target.value)}
                  placeholder="Location (office / city)"
                  className={fieldClass}
                />
              </>
            ) : null}
            <button
              type="button"
              disabled={!!busy || !followAt}
              onClick={() => {
                const dueAt = fromIstDatetimeLocal(followAt);
                if (!dueAt) {
                  setError("Enter a valid follow-up date and time (IST)");
                  return;
                }
                post(
                  `/api/leads/${lead.id}/followups`,
                  {
                    dueAt,
                    action: followAction || undefined,
                    kind: touchKind,
                    meetUrl: touchKind === "gmeet" ? meetUrl || GMEET_NEW : meetUrl,
                    location: meetPlace,
                  },
                  "follow",
                );
              }}
              className="h-9 rounded-md bg-ink px-3 text-sm text-white disabled:opacity-50"
            >
              Schedule &amp; download ICS
            </button>
            {icsId ? (
              <a
                href={`/api/follow-ups/${icsId}/ics`}
                className="inline-flex h-9 items-center rounded-md border border-line px-3 text-sm"
              >
                Download calendar (.ics)
              </a>
            ) : null}
            <div className="flex flex-wrap gap-2 pt-1">
              {callLink ? (
                <a href={callLink} className="rounded-md border border-line px-2 py-1 text-xs">
                  Call
                </a>
              ) : null}
              {waLink ? (
                <a href={waLink} target="_blank" rel="noreferrer" className="rounded-md border border-line px-2 py-1 text-xs">
                  WhatsApp
                </a>
              ) : null}
              {smsLink ? (
                <a href={smsLink} className="rounded-md border border-line px-2 py-1 text-xs">
                  SMS
                </a>
              ) : null}
              <a href={brochureHref} className="rounded-md border border-line px-2 py-1 text-xs">
                Brochure / files
              </a>
              <a href={meetUrl || GMEET_NEW} target="_blank" rel="noreferrer" className="rounded-md border border-line px-2 py-1 text-xs">
                Google Meet
              </a>
            </div>
          </Panel>

          {(options.nurtureTemplates?.length ?? 0) > 0 ? (
            <Panel title="Nurture message">
              <p className="mb-2 text-xs text-ink-soft">Logs onto this lead timeline. WhatsApp API can be wired later.</p>
              <select
                id="nurture-template"
                className={fieldClass}
                defaultValue={options.nurtureTemplates![0].id}
              >
                {options.nurtureTemplates!.map((t) => (
                  <option key={t.id} value={t.id}>
                    Day {t.dayOffset} · {t.journey} · {t.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => {
                  const el = document.getElementById("nurture-template") as HTMLSelectElement | null;
                  if (!el?.value) return;
                  post("/api/platform?kind=nurture-send", { leadId: lead.id, templateId: el.value }, "nurture");
                }}
                className="mt-2 h-9 rounded-md border border-line px-3 text-sm"
              >
                Log message
              </button>
            </Panel>
          ) : null}

          <Panel title="Close">
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Won / lost reason"
              className={fieldClass}
            />
            <div className="mt-2 flex gap-2">
              {won ? (
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() =>
                    post(`/api/leads/${lead.id}/status`, { statusId: won.id, reason }, "won")
                  }
                  className="h-9 rounded-md bg-pine px-3 text-sm text-white"
                >
                  Mark won
                </button>
              ) : null}
              <button
                type="button"
                disabled={!!busy}
                onClick={() => post("/api/platform?kind=convert-project", { leadId: lead.id }, "project")}
                className="h-9 rounded-md border border-line px-3 text-sm"
              >
                Start project
              </button>
              {lost ? (
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() =>
                    post(`/api/leads/${lead.id}/status`, { statusId: lost.id, reason }, "lost")
                  }
                  className="h-9 rounded-md border border-danger px-3 text-sm text-danger"
                >
                  Mark lost
                </button>
              ) : null}
            </div>
          </Panel>
        </section>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <h2 className="text-xs uppercase tracking-[0.16em] text-ink-soft">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-ink-soft">{label}</span>
      <span className="text-right text-ink">{value}</span>
    </div>
  );
}

function MiniAction({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="h-8 rounded-md border border-line px-2 text-xs text-ink hover:bg-paper-2 disabled:opacity-50"
    >
      {children}
    </button>
  );
}
