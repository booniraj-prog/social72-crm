"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatIst } from "@/lib/time";
import type { FollowupBucket } from "@/modules/followups/service";
import type { LeadRow } from "@/modules/leads/types";
import { ActionIcon } from "@/components/ui/action-icon";
import { TableFrame } from "@/components/platform/table-controls";

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
  clientId,
}: {
  bucket: FollowupBucket;
  counts: Counts;
  items: Item[];
  clientId?: string;
}) {
  const bucketHref = (key: FollowupBucket) => {
    const q = new URLSearchParams({ bucket: key });
    if (clientId) q.set("clientId", clientId);
    return `/follow-ups?${q.toString()}`;
  };
  const callHref = (leadId: string) => {
    const q = new URLSearchParams({ leadId });
    if (clientId) q.set("clientId", clientId);
    return `/calling?${q.toString()}`;
  };
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
      <p className="text-xs uppercase tracking-[0.18em] text-ink-soft">Demand</p>
      <h1 className="mt-2 font-display text-4xl text-ink">Follow-ups</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Monitor the next action on every live lead. Today completion {counts.completionPct}% · {counts.overdue} overdue
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {BUCKETS.map((item) => (
          <Link
            key={item.key}
            href={bucketHref(item.key)}
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
        <TableFrame
          rows={items.map((item) => ({
            id: `${item.lead.id}-${item.followUpId ?? "lead"}`,
            followUpId: item.followUpId,
            leadId: item.lead.id,
            lead: item.lead.fullName,
            client: item.lead.client.name,
            due: item.dueAt ? formatIst(item.dueAt) : "—",
            action: item.action ?? "—",
            owner: item.lead.assignedUser?.name ?? "Unassigned",
          }))}
          columns={["lead", "client", "due", "action", "owner"]}
          empty="Nothing in this queue."
          extraHeaders={<th className="px-3 py-2" />}
          extraColSpan={1}
          renderRow={(row) => {
            const item = items.find((i) => i.lead.id === row.leadId && (i.followUpId ?? null) === (row.followUpId as string | null));
            return (
              <>
                <td className="px-4 py-3">
                  <Link href={callHref(String(row.leadId))} prefetch={false} className="font-medium hover:underline">
                    {String(row.lead)}
                  </Link>
                  <p className="text-xs text-ink-soft">{String(row.client)}</p>
                </td>
                <td className="px-4 py-3 text-ink-soft">{String(row.due)}</td>
                <td className="px-4 py-3 text-ink-soft">{String(row.action)}</td>
                <td className="px-4 py-3 text-ink-soft">{String(row.owner)}</td>
                <td className="px-4 py-3 text-right">
                  <span className="inline-flex items-center justify-end gap-1">
                    {item?.followUpId ? (
                      <ActionIcon action="export" label="Download ICS" href={`/api/follow-ups/${item.followUpId}/ics`} />
                    ) : null}
                    {bucket === "none" ? (
                      <ActionIcon action="call" href={callHref(String(row.leadId))} />
                    ) : (
                      <ActionIcon action="complete" disabled={!!busyId} onClick={() => item && complete(item)} />
                    )}
                  </span>
                </td>
              </>
            );
          }}
        />
      </div>
    </div>
  );
}
