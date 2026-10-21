"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { IssueBadge, QualityMarks, ScoreMark } from "@/components/leads/quality-marks";
import { defaultIstCallbackLocal, formatIst, fromIstDatetimeLocal, toIstDatetimeLocal } from "@/lib/time";
import type { LeadDetail, LeadOptions, LeadRow } from "@/modules/leads/types";

const fieldClass = "h-10 w-full rounded-md border border-line bg-white px-3 text-sm";

export function CallingDesk({
  queue,
  lead,
  options,
  canPick,
  currentUserId,
  clientId,
}: {
  queue: LeadRow[];
  lead: LeadDetail | null;
  options: LeadOptions;
  canPick: boolean;
  currentUserId: string;
  clientId?: string;
}) {
  const queueHref = (leadId: string) => {
    const q = new URLSearchParams({ leadId });
    if (clientId) q.set("clientId", clientId);
    return `/calling?${q.toString()}`;
  };
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const [callNotes, setCallNotes] = useState("");
  const [dispositionId, setDispositionId] = useState(options.dispositions?.[0]?.id ?? "");
  const [durationSec, setDurationSec] = useState("");
  const [followAt, setFollowAt] = useState(
    toIstDatetimeLocal(lead?.nextFollowupAt ?? null) || defaultIstCallbackLocal(),
  );
  const [nextAction, setNextAction] = useState(lead?.nextAction ?? "");
  const [taskTitle, setTaskTitle] = useState("");
  const [reason, setReason] = useState("");
  const [occupation, setOccupation] = useState(lead?.occupation ?? "");
  const [city, setCity] = useState(lead?.city ?? "");
  const [expectedValue, setExpectedValue] = useState(String(lead?.expectedValue ?? 0));
  const [probabilityPct, setProbabilityPct] = useState(String(lead?.probabilityPct ?? 0));

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

  const lastCall = lead?.callLogs?.[0];
  const won = options.statuses.find((s) => s.key === "CLOSED_WON");
  const lost = options.statuses.find((s) => s.key === "CLOSED_LOST");
  const interested = options.statuses.find((s) => s.key === "INTERESTED");
  const notInterested = options.statuses.find((s) => s.key === "NOT_INTERESTED");
  const nurture = options.statuses.find((s) => s.key === "NURTURE");

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-ink-soft">Demand</p>
          <h1 className="mt-1 font-display text-4xl text-ink">Outbound calling</h1>
        </div>
        {lead ? (
          <Link href={`/leads/${lead.id}`} className="text-sm text-copper hover:underline">
            Open lead record
          </Link>
        ) : null}
      </div>
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

      <div className="mt-6 grid min-h-0 flex-1 gap-4 xl:grid-cols-[220px_minmax(0,1.15fr)_minmax(300px,0.95fr)]">
        <aside className="overflow-y-auto rounded-lg border border-line bg-white">
          <p className="border-b border-line px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-ink-soft">
            Queue · {queue.length}
          </p>
          {queue.length === 0 ? (
            <p className="px-3 py-6 text-sm text-ink-soft">No open leads in your scope.</p>
          ) : (
            <ul>
              {queue.map((item) => {
                const active = item.id === lead?.id;
                return (
                  <li key={item.id}>
                    <Link
                      href={queueHref(item.id)}
                      prefetch={false}
                      scroll={false}
                      className={`block w-full border-b border-line px-3 py-2.5 text-left text-sm ${
                        active ? "bg-paper" : "hover:bg-paper/70"
                      }`}
                    >
                      <span className="block font-medium text-ink">{item.fullName}</span>
                      <span className="mt-0.5 inline-flex items-center gap-1.5">
                        <IssueBadge statusKey={item.status.key} />
                        <span className="text-[10px] uppercase tracking-[0.08em] text-ink-soft">
                          Score <ScoreMark value={item.leadScore} />
                        </span>
                      </span>
                      <span className="block text-xs text-ink-soft">
                        {item.status.name}
                        {item.assignedUser
                          ? item.assignedUser.id === currentUserId
                            ? " · You"
                            : ` · ${item.assignedUser.name}`
                          : " · Pool"}
                        {item.nextFollowupAt ? ` · ${formatIst(item.nextFollowupAt)}` : ""}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <section className="space-y-4">
          {!lead ? (
            <div className="rounded-lg border border-dashed border-line bg-paper-2 px-5 py-10 text-sm text-ink-soft">
              Select a lead from the queue to start calling.
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-line bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-ink-soft">{lead.leadNumber}</p>
                    <h2 className="font-display text-3xl text-ink">{lead.fullName}</h2>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <IssueBadge statusKey={lead.status.key} />
                      <span className="text-xs text-ink-soft">
                        Score <ScoreMark value={lead.leadScore} />
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-ink-soft">
                      {lead.client.name} · {lead.campaign.name}
                      {lead.assignedUser ? ` · ${lead.assignedUser.name}` : " · Unassigned"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {canPick && !lead.assignedUser ? (
                      <button
                        type="button"
                        disabled={!!busy}
                        onClick={() => post(`/api/leads/${lead.id}/claim`, {}, "pick")}
                        className="inline-flex h-11 items-center rounded-md border border-line bg-white px-4 text-sm font-medium text-ink hover:bg-paper-2"
                      >
                        Pick lead
                      </button>
                    ) : null}
                    <a
                      href={`tel:${lead.mobileE164}`}
                      className="inline-flex h-11 items-center rounded-md bg-copper px-5 text-sm font-medium text-white hover:bg-copper-dark"
                    >
                      Call {lead.mobileE164}
                    </a>
                  </div>
                </div>
                <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                  <Fact label="Source" value={lead.source?.name ?? lead.sourcePlatform ?? "—"} />
                  <Fact label="Generated" value={formatIst(lead.generatedAt ?? lead.createdAt)} />
                  <Fact label="Status" value={lead.status.name} />
                  <Fact label="Temperature" value={lead.temperature} />
                  <Fact label="Score" value={<ScoreMark value={lead.leadScore} />} />
                  <Fact label="Expected ₹" value={Number(lead.expectedValue).toLocaleString("en-IN")} />
                  <Fact label="Next follow-up" value={formatIst(lead.nextFollowupAt)} />
                  <Fact label="Next action" value={lead.nextAction ?? "—"} />
                </dl>
                <div className="mt-4 rounded-md bg-paper-2 px-3 py-3 text-sm">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-ink-soft">Last conversation</p>
                  <p className="mt-1 text-ink">
                    {lastCall?.notes || lastCall?.disposition?.name || "No calls logged yet."}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-line bg-white p-5">
                <h3 className="text-xs uppercase tracking-[0.16em] text-ink-soft">Call history</h3>
                <ul className="mt-3 space-y-3">
                  {(lead.callLogs ?? []).length === 0 ? (
                    <li className="text-sm text-ink-soft">No previous calls.</li>
                  ) : (
                    (lead.callLogs ?? []).map((call) => (
                      <li key={call.id} className="border-l border-line pl-3 text-sm">
                        <p className="font-medium">
                          {call.disposition?.name ?? "Call"} · {call.user.name}
                        </p>
                        {call.notes ? <p className="text-ink-soft">{call.notes}</p> : null}
                        <p className="text-xs text-ink-soft">
                          {formatIst(call.startedAt)}
                          {call.durationSec != null ? ` · ${call.durationSec}s` : ""}
                        </p>
                      </li>
                    ))
                  )}
                </ul>
              </div>

              <div className="rounded-lg border border-line bg-white p-5">
                <h3 className="text-xs uppercase tracking-[0.16em] text-ink-soft">Notes</h3>
                <ul className="mt-3 space-y-2 text-sm">
                  {(lead.notes ?? []).slice(0, 8).map((item) => (
                    <li key={item.id}>
                      <span className="text-ink-soft">{item.user.name}: </span>
                      {item.body}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg border border-line bg-white p-5">
                <h3 className="text-xs uppercase tracking-[0.16em] text-ink-soft">Timeline</h3>
                <ol className="mt-3 space-y-3">
                  {(lead.activities ?? []).map((item) => (
                    <li key={item.id} className="border-l border-line pl-3 text-sm">
                      <p className="font-medium">{item.title}</p>
                      {item.body ? <p className="text-ink-soft">{item.body}</p> : null}
                      <p className="text-xs text-ink-soft">
                        {formatIst(item.createdAt)}
                        {item.user ? ` · ${item.user.name}` : ""}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>
            </>
          )}
        </section>

        {lead ? (
          <section className="space-y-3">
            <Panel title="Call outcome">
              <select
                className={fieldClass}
                value={dispositionId}
                onChange={(e) => setDispositionId(e.target.value)}
              >
                {(options.dispositions ?? []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <input
                className={fieldClass}
                placeholder="Duration (seconds)"
                value={durationSec}
                onChange={(e) => setDurationSec(e.target.value)}
              />
              <textarea
                rows={3}
                className="w-full rounded-md border border-line p-2 text-sm"
                placeholder="Call notes"
                value={callNotes}
                onChange={(e) => setCallNotes(e.target.value)}
              />
              <input
                type="datetime-local"
                className={fieldClass}
                value={followAt}
                onChange={(e) => setFollowAt(e.target.value)}
                aria-label="Next follow-up in IST"
              />
              <p className="text-[11px] text-ink-soft">Next follow-up is stored in IST, not the browser zone.</p>
              <input
                className={fieldClass}
                placeholder="Next action"
                value={nextAction}
                onChange={(e) => setNextAction(e.target.value)}
              />
              <button
                type="button"
                disabled={!!busy || !dispositionId}
                onClick={() => {
                  const nextFollowupAt = fromIstDatetimeLocal(followAt);
                  if (!nextFollowupAt && !lead.nextFollowupAt) {
                    setError("Set the next follow-up before saving this outcome");
                    return;
                  }
                  void post(
                    `/api/leads/${lead.id}/calls`,
                    {
                      dispositionId,
                      notes: callNotes,
                      durationSec: durationSec ? Number(durationSec) : undefined,
                      nextFollowupAt,
                      nextAction,
                    },
                    "call",
                  );
                }}
                className="h-10 w-full rounded-md bg-ink text-sm text-white disabled:opacity-50"
              >
                Save call outcome
              </button>
            </Panel>

            <Panel title="Status & temperature">
              <select
                className={fieldClass}
                defaultValue={lead.status.id}
                disabled={!!busy}
                onChange={(e) => post(`/api/leads/${lead.id}/status`, { statusId: e.target.value }, "status")}
              >
                {options.statuses.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select
                className={fieldClass}
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
              <div className="flex flex-wrap gap-2">
                {interested ? (
                  <Mini
                    disabled={!!busy}
                    onClick={() => post(`/api/leads/${lead.id}/status`, { statusId: interested.id }, "status")}
                  >
                    Interested
                  </Mini>
                ) : null}
                {notInterested ? (
                  <Mini
                    disabled={!!busy}
                    onClick={() =>
                      post(`/api/leads/${lead.id}/status`, { statusId: notInterested.id }, "status")
                    }
                  >
                    Not interested
                  </Mini>
                ) : null}
                {nurture ? (
                  <Mini
                    disabled={!!busy}
                    onClick={() => post(`/api/leads/${lead.id}/status`, { statusId: nurture.id }, "status")}
                  >
                    Nurture
                  </Mini>
                ) : null}
              </div>
              <QualityMarks
                statuses={options.statuses}
                currentKey={lead.status.key}
                disabled={!!busy}
                onPick={(statusId) => post(`/api/leads/${lead.id}/status`, { statusId }, "status")}
              />
            </Panel>

            <Panel title="Qualification">
              <input className={fieldClass} placeholder="Occupation" value={occupation} onChange={(e) => setOccupation(e.target.value)} />
              <input className={fieldClass} placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
              <input className={fieldClass} placeholder="Expected value" value={expectedValue} onChange={(e) => setExpectedValue(e.target.value)} />
              <input className={fieldClass} placeholder="Probability %" value={probabilityPct} onChange={(e) => setProbabilityPct(e.target.value)} />
              <button
                type="button"
                disabled={!!busy}
                onClick={() =>
                  post(
                    `/api/leads/${lead.id}/qualify`,
                    {
                      occupation,
                      city,
                      expectedValue: Number(expectedValue) || 0,
                      probabilityPct: Number(probabilityPct) || 0,
                      nextAction,
                    },
                    "qual",
                  )
                }
                className="h-9 rounded-md bg-ink px-3 text-sm text-white"
              >
                Save qualification
              </button>
            </Panel>

            <Panel title="Note">
              <textarea rows={2} className="w-full rounded-md border border-line p-2 text-sm" value={note} onChange={(e) => setNote(e.target.value)} />
              <button
                type="button"
                disabled={!!busy || !note.trim()}
                onClick={async () => {
                  const ok = await post(`/api/leads/${lead.id}/notes`, { body: note }, "note");
                  if (ok) setNote("");
                }}
                className="h-9 rounded-md bg-ink px-3 text-sm text-white disabled:opacity-50"
              >
                Add note
              </button>
            </Panel>

            <Panel title="Task">
              <input className={fieldClass} placeholder="Task title" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} />
              <button
                type="button"
                disabled={!!busy || !taskTitle.trim()}
                onClick={async () => {
                  const ok = await post(`/api/leads/${lead.id}/tasks`, { title: taskTitle }, "task");
                  if (ok) setTaskTitle("");
                }}
                className="h-9 rounded-md bg-ink px-3 text-sm text-white disabled:opacity-50"
              >
                Add task
              </button>
            </Panel>

            <Panel title="Close">
              <input className={fieldClass} placeholder="Won / lost reason" value={reason} onChange={(e) => setReason(e.target.value)} />
              <div className="flex gap-2">
                {won ? (
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => post(`/api/leads/${lead.id}/status`, { statusId: won.id, reason }, "won")}
                    className="h-9 rounded-md bg-pine px-3 text-sm text-white"
                  >
                    Won
                  </button>
                ) : null}
                {lost ? (
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => post(`/api/leads/${lead.id}/status`, { statusId: lost.id, reason }, "lost")}
                    className="h-9 rounded-md border border-danger px-3 text-sm text-danger"
                  >
                    Lost
                  </button>
                ) : null}
              </div>
            </Panel>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-ink-soft">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <h3 className="text-xs uppercase tracking-[0.16em] text-ink-soft">{title}</h3>
      <div className="mt-3 space-y-2">{children}</div>
    </div>
  );
}

function Mini({
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
      className="h-8 rounded-md border border-line px-2 text-xs hover:bg-paper-2 disabled:opacity-50"
    >
      {children}
    </button>
  );
}
