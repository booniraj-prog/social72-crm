"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Scoring = { id: string; eventKey: string; points: number; description: string | null; isActive: boolean };
type Sla = { id: string; key: string; name: string; thresholdMinutes: number; isActive: boolean };

export function SettingsView({
  scoring,
  sla,
  locale,
}: {
  scoring: Scoring[];
  sla: Sla[];
  locale: unknown;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const loc = (locale ?? {}) as { timezone?: string; currency?: string };

  async function saveScore(id: string, form: FormData) {
    setError("");
    const res = await fetch(`/api/settings/scoring/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        points: Number(form.get("points")),
        isActive: form.get("isActive") === "on",
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error?.message ?? "Could not save scoring rule");
      return;
    }
    router.refresh();
  }

  async function saveSla(id: string, form: FormData) {
    setError("");
    const res = await fetch(`/api/settings/sla/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        thresholdMinutes: Number(form.get("thresholdMinutes")),
        isActive: form.get("isActive") === "on",
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error?.message ?? "Could not save SLA rule");
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <p className="text-xs uppercase tracking-[0.18em] text-ink-soft">Admin</p>
      <h1 className="mt-2 font-display text-4xl text-ink">Settings</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-ink-soft">
        Scoring points and SLA minutes drive notifications and lead scores. Timezone is {loc.timezone ?? "Asia/Kolkata"},
        currency {loc.currency ?? "INR"}.
      </p>
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

      <h2 className="mt-8 text-sm font-medium text-ink">Lead scoring</h2>
      <div className="mt-3 overflow-x-auto rounded-lg border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase text-ink-soft">
              <th className="px-3 py-2">Event</th>
              <th className="px-3 py-2">Points</th>
              <th className="px-3 py-2">Active</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {scoring.map((rule) => (
              <tr key={rule.id} className="border-b border-line last:border-0">
                <td className="px-3 py-2">
                  {rule.eventKey}
                  <p className="text-xs text-ink-soft">{rule.description}</p>
                </td>
                <td className="px-3 py-2" colSpan={3}>
                  <form
                    className="flex flex-wrap items-center gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void saveScore(rule.id, new FormData(e.currentTarget));
                    }}
                  >
                    <input
                      name="points"
                      type="number"
                      defaultValue={rule.points}
                      className="h-9 w-24 rounded-md border border-line px-2"
                    />
                    <label className="flex items-center gap-1 text-xs text-ink-soft">
                      <input name="isActive" type="checkbox" defaultChecked={rule.isActive} />
                      Active
                    </label>
                    <button type="submit" className="h-9 rounded-md bg-ink px-3 text-xs text-white">
                      Save
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-8 text-sm font-medium text-ink">SLA</h2>
      <div className="mt-3 overflow-x-auto rounded-lg border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase text-ink-soft">
              <th className="px-3 py-2">Rule</th>
              <th className="px-3 py-2">Minutes</th>
              <th className="px-3 py-2">Active</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {sla.map((rule) => (
              <tr key={rule.id} className="border-b border-line last:border-0">
                <td className="px-3 py-2">{rule.name}</td>
                <td className="px-3 py-2" colSpan={3}>
                  <form
                    className="flex flex-wrap items-center gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void saveSla(rule.id, new FormData(e.currentTarget));
                    }}
                  >
                    <input
                      name="thresholdMinutes"
                      type="number"
                      defaultValue={rule.thresholdMinutes}
                      className="h-9 w-24 rounded-md border border-line px-2"
                    />
                    <label className="flex items-center gap-1 text-xs text-ink-soft">
                      <input name="isActive" type="checkbox" defaultChecked={rule.isActive} />
                      Active
                    </label>
                    <button type="submit" className="h-9 rounded-md bg-ink px-3 text-xs text-white">
                      Save
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
