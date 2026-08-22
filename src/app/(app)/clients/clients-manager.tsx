"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Industry = { id: string; name: string };
type ClientRow = {
  id: string;
  name: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  isActive: boolean;
  industry: { id: string; name: string } | null;
  _count: { campaigns: number };
};

export function ClientsManager({
  clients,
  industries,
  canWrite,
}: {
  clients: ClientRow[];
  industries: Industry[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ClientRow | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-ink-soft">Marketing</p>
          <h1 className="mt-2 font-display text-4xl text-ink">Clients</h1>
        </div>
        {canWrite ? (
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setError("");
              setOpen(true);
            }}
            className="h-10 rounded-md bg-copper px-4 text-sm font-medium text-white hover:bg-copper-dark"
          >
            New client
          </button>
        ) : null}
      </div>

      <div className="mt-8 overflow-hidden rounded-lg border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-paper-2 text-xs uppercase tracking-[0.12em] text-ink-soft">
            <tr>
              <th className="px-4 py-3 font-medium">Client</th>
              <th className="px-4 py-3 font-medium">Industry</th>
              <th className="px-4 py-3 font-medium">Contact</th>
              <th className="px-4 py-3 font-medium">Status</th>
              {canWrite ? <th className="px-4 py-3 font-medium" /> : null}
            </tr>
          </thead>
          <tbody>
            {clients.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-ink-soft" colSpan={5}>
                  No clients yet. Create the first Social72 customer to isolate campaigns and leads.
                </td>
              </tr>
            ) : (
              clients.map((client) => (
                <tr key={client.id} className="border-t border-line">
                  <td className="px-4 py-3">{client.name}</td>
                  <td className="px-4 py-3 text-ink-soft">{client.industry?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-soft">{client.contactName ?? "—"}</td>
                  <td className="px-4 py-3">{client.isActive ? "Active" : "Inactive"}</td>
                  {canWrite ? (
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="text-sm text-copper hover:underline"
                        onClick={() => {
                          setEditing(client);
                          setError("");
                          setOpen(true);
                        }}
                      >
                        Edit
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {open && canWrite ? (
        <ClientDialog
          industries={industries}
          client={editing}
          error={error}
          saving={saving}
          onClose={() => setOpen(false)}
          onSave={async (payload) => {
            setSaving(true);
            setError("");
            const url = editing ? `/api/clients/${editing.id}` : "/api/clients";
            const res = await fetch(url, {
              method: editing ? "PATCH" : "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
            const json = await res.json();
            setSaving(false);
            if (!res.ok) {
              setError(json.error?.message ?? "Could not save client");
              return;
            }
            setOpen(false);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function ClientDialog({
  industries,
  client,
  error,
  saving,
  onClose,
  onSave,
}: {
  industries: Industry[];
  client: ClientRow | null;
  error: string;
  saving: boolean;
  onClose: () => void;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [name, setName] = useState(client?.name ?? "");
  const [industryId, setIndustryId] = useState(client?.industry?.id ?? "");
  const [contactName, setContactName] = useState(client?.contactName ?? "");
  const [contactEmail, setContactEmail] = useState(client?.contactEmail ?? "");
  const [contactPhone, setContactPhone] = useState(client?.contactPhone ?? "");
  const [isActive, setIsActive] = useState(client?.isActive ?? true);
  const title = useMemo(() => (client ? "Edit client" : "New client"), [client]);

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-ink/40 p-4">
      <form
        className="w-full max-w-md rounded-lg bg-paper p-6"
        onSubmit={(e) => {
          e.preventDefault();
          void onSave({
            name,
            industryId: industryId || null,
            contactName,
            contactEmail,
            contactPhone,
            isActive,
          });
        }}
      >
        <h2 className="font-display text-2xl">{title}</h2>
        <div className="mt-5 flex flex-col gap-3 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-ink-soft">Client name</span>
            <input required value={name} onChange={(e) => setName(e.target.value)} className="h-10 rounded-md border border-line bg-white px-3" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-ink-soft">Industry</span>
            <select
              value={industryId}
              onChange={(e) => setIndustryId(e.target.value)}
              className="h-10 rounded-md border border-line bg-white px-3"
            >
              <option value="">Select industry</option>
              {industries.map((industry) => (
                <option key={industry.id} value={industry.id}>
                  {industry.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-ink-soft">Contact name</span>
            <input value={contactName} onChange={(e) => setContactName(e.target.value)} className="h-10 rounded-md border border-line bg-white px-3" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-ink-soft">Contact email</span>
            <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="h-10 rounded-md border border-line bg-white px-3" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-ink-soft">Contact phone</span>
            <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className="h-10 rounded-md border border-line bg-white px-3" />
          </label>
          <label className="flex items-center gap-2 text-ink-soft">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Active
          </label>
        </div>
        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-10 px-3 text-sm text-ink-soft">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="h-10 rounded-md bg-copper px-4 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
