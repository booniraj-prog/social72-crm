"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ActionIcon } from "@/components/ui/action-icon";
import { TableFrame } from "@/components/platform/table-controls";

type CallerRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  leadsAssigned: number;
  callsMade: number;
  connectedCalls: number;
  connectionRate: number;
  qualified: number;
  closedWon: number;
  conversionRate: number;
  revenue: number;
};

export function BpoBoard({ callers, q }: { callers: CallerRow[]; q: string }) {
  const router = useRouter();

  return (
    <div>
      <p className="text-xs uppercase tracking-[0.18em] text-ink-soft">Outbound floor</p>
      <h1 className="mt-2 font-display text-4xl text-ink">BPO performance</h1>
      <p className="mt-2 max-w-xl text-sm text-ink-soft">
        Search an outbound caller to see assigned leads, dials, connect rate, and closures.
      </p>

      <form
        className="mt-6 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const value = String(new FormData(e.currentTarget).get("q") ?? "");
          router.push(value.trim() ? `/bpo?q=${encodeURIComponent(value.trim())}` : "/bpo");
        }}
      >
        <input
          name="q"
          defaultValue={q}
          placeholder="Search caller name or email"
          className="h-10 min-w-[240px] flex-1 rounded-md border border-line bg-white px-3 text-sm"
        />
        <ActionIcon type="submit" action="search" />
        {q ? <ActionIcon action="reset" label="Clear search" href="/bpo" /> : null}
      </form>

      <div className="mt-6 overflow-hidden rounded-lg border border-line bg-white">
        <TableFrame
          rows={callers.map((row) => ({
            ...row,
            caller: row.name,
            assigned: row.leadsAssigned,
            calls: row.callsMade,
            connected: row.connectedCalls,
            connectPct: row.connectionRate,
            won: row.closedWon,
            conv: row.conversionRate,
          }))}
          columns={["caller", "assigned", "calls", "connected", "connectPct", "qualified", "won", "conv", "revenue"]}
          labels={{ connectPct: "Connect %", conv: "Conv %", assigned: "Assigned" }}
          empty="No outbound callers match that search."
          renderRow={(row) => (
            <>
              <td className="px-4 py-3">
                <Link href={`/leads?assignedUserId=${row.id}`} className="font-medium hover:underline">
                  {String(row.caller)}
                </Link>
                <p className="text-xs text-ink-soft">
                  {String(row.role)} · {String(row.email)}
                </p>
              </td>
              <td className="px-4 py-3">{Number(row.assigned)}</td>
              <td className="px-4 py-3">{Number(row.calls)}</td>
              <td className="px-4 py-3">{Number(row.connected)}</td>
              <td className="px-4 py-3">{Number(row.connectPct)}%</td>
              <td className="px-4 py-3">{Number(row.qualified)}</td>
              <td className="px-4 py-3">{Number(row.won)}</td>
              <td className="px-4 py-3">{Number(row.conv)}%</td>
              <td className="px-4 py-3">₹{Number(row.revenue).toLocaleString("en-IN")}</td>
            </>
          )}
        />
      </div>
    </div>
  );
}
