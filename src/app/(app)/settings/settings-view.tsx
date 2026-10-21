"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  APPROVAL_KIND_META,
  APPROVAL_KINDS,
  ASSIGNABLE_APPROVER_ROLES,
  roleLabel,
  type ApprovalKind,
} from "@/lib/approvals";
import type { RoleKey } from "@/lib/rbac";
import { ActionIcon } from "@/components/ui/action-icon";
import { MetaLeadSettings } from "./meta-lead-settings";

type Scoring = { id: string; eventKey: string; points: number; description: string | null; isActive: boolean };
type Sla = { id: string; key: string; name: string; thresholdMinutes: number; isActive: boolean };
type RoleAlert = {
  id: string;
  name: string;
  alertEmail: string | null;
  alertPhone: string | null;
  notifyEmail: boolean;
  notifySms: boolean;
};

export function SettingsView({
  scoring,
  sla,
  locale,
  roles,
  approvals,
  meta,
  campaigns,
  people,
}: {
  scoring: Scoring[];
  sla: Sla[];
  locale: unknown;
  roles: RoleAlert[];
  approvals: Record<ApprovalKind, RoleKey[]>;
  meta: {
    verifyToken: string;
    pageId: string;
    graphVersion: string;
    forms: Array<{ formId: string; campaignId: string; assignedUserId: string }>;
    appSecretSet: boolean;
    pageAccessTokenSet: boolean;
    envSecrets: boolean;
  };
  campaigns: Array<{ id: string; name: string }>;
  people: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [matrix, setMatrix] = useState(approvals);
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

  async function saveRole(id: string, form: FormData) {
    setError("");
    const res = await fetch(`/api/settings/roles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        alertEmail: String(form.get("alertEmail") ?? ""),
        alertPhone: String(form.get("alertPhone") ?? ""),
        notifyEmail: form.get("notifyEmail") === "on",
        notifySms: form.get("notifySms") === "on",
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error?.message ?? "Could not save role alerts");
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

  function toggleRole(kind: ApprovalKind, key: RoleKey) {
    setMatrix((current) => {
      const selected = new Set(current[kind]);
      if (selected.has(key)) {
        if (selected.size === 1) return current;
        selected.delete(key);
      } else {
        selected.add(key);
      }
      return { ...current, [kind]: [...selected] };
    });
  }

  async function saveApprovals() {
    setError("");
    const res = await fetch("/api/settings/approvals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(matrix),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error?.message ?? "Could not save approval authority");
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
        currency {loc.currency ?? "INR"}. Super Admin can always approve.
      </p>
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

      <MetaLeadSettings webhookPath="/api/ingest/meta" meta={meta} campaigns={campaigns} people={people} />

      <h2 className="mt-8 text-sm font-medium text-ink">Approval authority</h2>
      <p className="mt-1 max-w-2xl text-sm text-ink-soft">
        Who signs off new employees, projects, proposals and invoices. Tick at least one role per workflow.
      </p>
      <div className="mt-3 overflow-x-auto rounded-lg border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase text-ink-soft">
              <th className="px-3 py-2">Workflow</th>
              <th className="px-3 py-2">Roles that can approve</th>
            </tr>
          </thead>
          <tbody>
            {APPROVAL_KINDS.map((kind) => (
              <tr key={kind} className="border-b border-line last:border-0 align-top">
                <td className="px-3 py-3">
                  <p className="font-medium">{APPROVAL_KIND_META[kind].label}</p>
                  <p className="text-xs text-ink-soft">{APPROVAL_KIND_META[kind].hint}</p>
                </td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {ASSIGNABLE_APPROVER_ROLES.map((key) => (
                      <label key={key} className="inline-flex items-center gap-1.5 text-sm">
                        <input
                          type="checkbox"
                          checked={matrix[kind].includes(key)}
                          onChange={() => toggleRole(kind, key)}
                        />
                        {roleLabel(key)}
                      </label>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-line px-3 py-2">
          <ActionIcon action="save" label="Save approval authority" onClick={() => void saveApprovals()} />
        </div>
      </div>

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
                    <ActionIcon type="submit" action="save" />
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
                    <ActionIcon type="submit" action="save" />
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-8 text-sm font-medium text-ink">Role alert contacts</h2>
      <p className="mt-1 text-sm text-ink-soft">Mailbox and phone used when that role should be emailed or texted.</p>
      <div className="mt-3 overflow-x-auto rounded-lg border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase text-ink-soft">
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Alert email</th>
              <th className="px-3 py-2">Alert phone</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {roles.map((role) => (
              <tr key={role.id} className="border-b border-line last:border-0">
                <td className="px-3 py-2">{role.name}</td>
                <td className="px-3 py-2" colSpan={3}>
                  <form
                    className="flex flex-wrap items-center gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void saveRole(role.id, new FormData(e.currentTarget));
                    }}
                  >
                    <input
                      name="alertEmail"
                      type="email"
                      defaultValue={role.alertEmail ?? ""}
                      placeholder="role@social72.com"
                      className="h-9 w-48 rounded-md border border-line px-2"
                    />
                    <input
                      name="alertPhone"
                      defaultValue={role.alertPhone ?? ""}
                      placeholder="+91…"
                      className="h-9 w-36 rounded-md border border-line px-2"
                    />
                    <label className="flex items-center gap-1 text-xs text-ink-soft">
                      <input name="notifyEmail" type="checkbox" defaultChecked={role.notifyEmail} />
                      Email
                    </label>
                    <label className="flex items-center gap-1 text-xs text-ink-soft">
                      <input name="notifySms" type="checkbox" defaultChecked={role.notifySms} />
                      SMS
                    </label>
                    <ActionIcon type="submit" action="save" />
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
