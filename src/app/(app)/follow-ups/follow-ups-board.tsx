"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatIst } from "@/lib/time";
import type { FollowupBucket } from "@/modules/followups/service";
import type { LeadRow } from "@/modules/leads/types";

const BUCKETS: { key: FollowupBucket; label: string }[] = [
  { key: "overdue", label: "Overdue" },
  { key: "today", label: "Today" },
  { key: "tomorrow", label: "Tomorrow" },
  { key: "upcoming", label: "Upcoming" },
  { key: "missed", label: "Missed" },
  { key: "none", label: "No follow-up" },
];

type Counts = {
  today: number;
  overdue: number;
  tomorrow: number;
  upcoming: number;
  missed: number;
  none: number;
  completedToday: number;
  completionPct: number;
};

type Item = {
  followUpId: string | null;
  dueAt: string | Date | null;
  action: string | null;
  lead: LeadRow;
};

export function FollowUpsBoard({
  bucket,
  counts,
  items,
}: {
  bucket: FollowupBucket;
  counts: Counts;
  items: Item[];
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  async function complete(item: Item) {
    const key = item.followUpId ?? item.lead.id;
    setBusyId(key);
    setError("");
    try {
      const res = await fetch(
        item.followUpId
          ? `/api/follow-ups/${item.followUpId}/complete`
          : `/api/leads/${item.lead.id}/followups/complete`,
        { method: "POST" },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error?.message ?? "Could not complete follow-up");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach the server. If the app just restarted, try again.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div>
      <p className="text-xs uppercase tracking-[0.18em] text-ink-soft">BPO floor</p>
      <h1 className="mt-2 font-display text-4xl text-ink">Follow-ups</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Today completion {counts.completionPct}% · {counts.overdue} overdue
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {BUCKETS.map((item) => (
          <Link
            key={item.key}
            href={`/follow-ups?bucket=${item.key}`}
            prefetch={false}
            className={`rounded-md px-3 py-1.5 text-sm ${
              bucket === item.key ? "bg-ink text-white" : "border border-line bg-white text-ink"
            }`}
          >
            {item.label} {counts[item.key]}
          </Link>
        ))}
      </div>

      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}

      {bucket === "overdue" && counts.overdue > 0 ? (
        <p className="mt-4 text-sm text-danger">Overdue follow-ups need action before new work.</p>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-lg border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-paper-2 text-xs uppercase tracking-[0.12em] text-ink-soft">
            <tr>
              <th className="px-4 py-3 font-medium">Lead</th>
              <th className="px-4 py-3 font-medium">Due</th>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">Owner</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-ink-soft" colSpan={5}>
                  Nothing in this queue.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={`${item.lead.id}-${item.followUpId ?? "lead"}`} className="border-t border-line">
                  <td className="px-4 py-3">
                    <Link
                      href={`/calling?leadId=${item.lead.id}`}
                      prefetch={false}
                      className="font-medium hover:underline"
                    >
                      {item.lead.fullName}
                    </Link>
                    <p className="text-xs text-ink-soft">{item.lead.client.name}</p>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">
                    {item.dueAt ? formatIst(item.dueAt) : "—"}
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{item.action ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-soft">{item.lead.assignedUser?.name ?? "Unassigned"}</td>
                  <td className="px-4 py-3 text-right">
                    {bucket === "none" ? (
                      <Link
                        href={`/calling?leadId=${item.lead.id}`}
                        prefetch={false}
                        className="text-sm text-copper hover:underline"
                      >
                        Call
                      </Link>
                    ) : (
                      <button
                        type="button"
                        disabled={!!busyId}
                        className="text-sm text-copper hover:underline disabled:opacity-50"
                        onClick={() => complete(item)}
                      >
                        Complete
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
