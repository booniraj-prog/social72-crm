"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

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
        <button type="submit" className="h-10 rounded-md bg-ink px-4 text-sm text-white">
          Search
        </button>
        {q ? (
          <Link href="/bpo" className="flex h-10 items-center px-3 text-sm text-ink-soft">
            Clear
          </Link>
        ) : null}
      </form>

      <div className="mt-6 overflow-hidden rounded-lg border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-paper-2 text-xs uppercase tracking-[0.12em] text-ink-soft">
            <tr>
              <th className="px-4 py-3 font-medium">Caller</th>
              <th className="px-4 py-3 font-medium">Assigned</th>
              <th className="px-4 py-3 font-medium">Calls</th>
              <th className="px-4 py-3 font-medium">Connected</th>
              <th className="px-4 py-3 font-medium">Connect %</th>
              <th className="px-4 py-3 font-medium">Qualified</th>
              <th className="px-4 py-3 font-medium">Won</th>
              <th className="px-4 py-3 font-medium">Conv %</th>
              <th className="px-4 py-3 font-medium">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {callers.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-ink-soft" colSpan={9}>
                  No outbound callers match that search.
                </td>
              </tr>
            ) : (
              callers.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="px-4 py-3">
                    <Link href={`/leads?assignedUserId=${row.id}`} className="font-medium hover:underline">
                      {row.name}
                    </Link>
                    <p className="text-xs text-ink-soft">
                      {row.role} · {row.email}
                    </p>
                  </td>
                  <td className="px-4 py-3">{row.leadsAssigned}</td>
                  <td className="px-4 py-3">{row.callsMade}</td>
                  <td className="px-4 py-3">{row.connectedCalls}</td>
                  <td className="px-4 py-3">{row.connectionRate}%</td>
                  <td className="px-4 py-3">{row.qualified}</td>
                  <td className="px-4 py-3">{row.closedWon}</td>
                  <td className="px-4 py-3">{row.conversionRate}%</td>
                  <td className="px-4 py-3">₹{row.revenue.toLocaleString("en-IN")}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
