"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ActionIcon } from "@/components/ui/action-icon";

type FormMap = { formId: string; campaignId: string; assignedUserId: string };

export function MetaLeadSettings({
  webhookPath,
  meta,
  campaigns,
  people,
}: {
  webhookPath: string;
  meta: {
    verifyToken: string;
    pageId: string;
    graphVersion: string;
    forms: FormMap[];
    appSecretSet: boolean;
    pageAccessTokenSet: boolean;
    envSecrets: boolean;
  };
  campaigns: Array<{ id: string; name: string }>;
  people: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [verifyToken, setVerifyToken] = useState(meta.verifyToken);
  const [pageId, setPageId] = useState(meta.pageId);
  const [graphVersion, setGraphVersion] = useState(meta.graphVersion || "v21.0");
  const [appSecret, setAppSecret] = useState("");
  const [pageAccessToken, setPageAccessToken] = useState("");
  const [forms, setForms] = useState<FormMap[]>(
    meta.forms.length ? meta.forms : [{ formId: "", campaignId: campaigns[0]?.id ?? "", assignedUserId: "" }],
  );

  async function save() {
    setSaving(true);
    setError("");
    const res = await fetch("/api/settings/meta", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        verifyToken,
        pageId,
        graphVersion,
        appSecret: appSecret || undefined,
        pageAccessToken: pageAccessToken || undefined,
        forms: forms.filter((row) => row.formId.trim() && row.campaignId),
      }),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(json.error?.message ?? "Could not save Meta settings");
      return;
    }
    setAppSecret("");
    setPageAccessToken("");
    router.refresh();
  }

  return (
    <section className="mt-8">
      <h2 className="text-sm font-medium text-ink">Meta lead ads</h2>
      <p className="mt-1 max-w-2xl text-sm text-ink-soft">
        Callback URL for the app webhook: <code className="text-ink">{webhookPath}</code>. Subscribe the Page to{" "}
        <code className="text-ink">leadgen</code>. Map each Instant Form ID to a Social72 campaign. Tokens can live here or in
        env (<code>META_VERIFY_TOKEN</code>, <code>META_APP_SECRET</code>, <code>META_PAGE_ACCESS_TOKEN</code>).
      </p>
      {meta.envSecrets ? (
        <p className="mt-2 text-xs text-ink-soft">Env secrets are set on this machine and override blank fields.</p>
      ) : null}
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}

      <div className="mt-3 grid gap-3 rounded-lg border border-line bg-white p-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-soft">Verify token</span>
          <input value={verifyToken} onChange={(e) => setVerifyToken(e.target.value)} className="h-9 rounded-md border border-line px-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-soft">Page ID</span>
          <input value={pageId} onChange={(e) => setPageId(e.target.value)} className="h-9 rounded-md border border-line px-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-soft">App secret {meta.appSecretSet ? "(saved)" : ""}</span>
          <input
            type="password"
            value={appSecret}
            onChange={(e) => setAppSecret(e.target.value)}
            placeholder={meta.appSecretSet ? "Leave blank to keep" : ""}
            className="h-9 rounded-md border border-line px-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-soft">Page access token {meta.pageAccessTokenSet ? "(saved)" : ""}</span>
          <input
            type="password"
            value={pageAccessToken}
            onChange={(e) => setPageAccessToken(e.target.value)}
            placeholder={meta.pageAccessTokenSet ? "Leave blank to keep" : ""}
            className="h-9 rounded-md border border-line px-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-soft">Graph version</span>
          <input value={graphVersion} onChange={(e) => setGraphVersion(e.target.value)} className="h-9 rounded-md border border-line px-2" />
        </label>
      </div>

      <div className="mt-3 overflow-x-auto rounded-lg border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase text-ink-soft">
              <th className="px-3 py-2">Form ID</th>
              <th className="px-3 py-2">Campaign</th>
              <th className="px-3 py-2">Assign to</th>
            </tr>
          </thead>
          <tbody>
            {forms.map((row, i) => (
              <tr key={i} className="border-b border-line last:border-0">
                <td className="px-3 py-2">
                  <input
                    value={row.formId}
                    onChange={(e) => setForms((rows) => rows.map((r, idx) => (idx === i ? { ...r, formId: e.target.value } : r)))}
                    placeholder="Instant Form ID"
                    className="h-9 w-full min-w-[140px] rounded-md border border-line px-2"
                  />
                </td>
                <td className="px-3 py-2">
                  <select
                    value={row.campaignId}
                    onChange={(e) => setForms((rows) => rows.map((r, idx) => (idx === i ? { ...r, campaignId: e.target.value } : r)))}
                    className="h-9 w-full min-w-[180px] rounded-md border border-line px-2"
                  >
                    <option value="">Select campaign</option>
                    {campaigns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <select
                    value={row.assignedUserId}
                    onChange={(e) =>
                      setForms((rows) => rows.map((r, idx) => (idx === i ? { ...r, assignedUserId: e.target.value } : r)))
                    }
                    className="h-9 w-full min-w-[160px] rounded-md border border-line px-2"
                  >
                    <option value="">Campaign owner</option>
                    {people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex flex-wrap gap-2 border-t border-line px-3 py-2">
          <ActionIcon
            action="new"
            label="Add form"
            onClick={() =>
              setForms((rows) => [...rows, { formId: "", campaignId: campaigns[0]?.id ?? "", assignedUserId: "" }])
            }
          />
          <ActionIcon action="save" label="Save Meta" disabled={saving} onClick={() => void save()} />
        </div>
      </div>
    </section>
  );
}
