"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { controlClass, Field, FormBanner, focusInvalid } from "@/components/platform/form-field";
import { ActionIcon, ActionsHeader } from "@/components/ui/action-icon";
import { ActiveToggle } from "@/components/platform/active-toggle";
import { TableFrame } from "@/components/platform/table-controls";

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
          <p className="text-xs uppercase tracking-[0.18em] text-ink-soft">Company</p>
          <h1 className="mt-2 font-display text-4xl text-ink">Clients</h1>
          <p className="mt-2 max-w-xl text-sm text-ink-soft">
            Onboard clients so campaigns, projects, POs and invoices stay isolated per account.
          </p>
        </div>
        {canWrite ? (
          <ActionIcon
            action="new"
            label="New client"
            onClick={() => {
              setEditing(null);
              setError("");
              setOpen(true);
            }}
          />
        ) : null}
      </div>

      <div className="mt-8 overflow-hidden rounded-lg border border-line bg-white">
        <TableFrame
          rows={clients.map((c) => ({
            ...c,
            client: c.name,
            industry: c.industry?.name ?? "—",
            contact: c.contactName ?? "—",
            status: c.isActive ? "Active" : "Paused",
          }))}
          columns={["client", "industry", "contact", "status"]}
          empty="No clients yet. Onboard the first Social72 client to isolate campaigns, projects and leads."
          extraHeaders={canWrite ? <ActionsHeader className="px-4 py-3" /> : null}
          extraColSpan={canWrite ? 1 : 0}
          rowClassName={(client) => `border-t border-line ${client.isActive ? "" : "opacity-60"}`}
          renderRow={(client) => (
            <>
              <td className="px-4 py-3">
                <a className="text-copper underline" href={`/clients/${client.id}`}>
                  {client.name}
                </a>
              </td>
              <td className="px-4 py-3 text-ink-soft">{String(client.industry)}</td>
              <td className="px-4 py-3 text-ink-soft">{String(client.contact)}</td>
              <td className="px-4 py-3">{String(client.status)}</td>
              {canWrite ? (
                <td className="px-4 py-3 text-right">
                  <span className="flex justify-end gap-0.5">
                    <ActiveToggle entity="client" id={client.id} active={client.isActive} name={client.name} />
                    <ActionIcon
                      action="edit"
                      onClick={() => {
                        setEditing(clients.find((c) => c.id === client.id) ?? null);
                        setError("");
                        setOpen(true);
                      }}
                    />
                  </span>
                </td>
              ) : null}
            </>
          )}
        />
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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const title = useMemo(() => (client ? "Edit client" : "New client"), [client]);

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-ink/40 p-4">
      <form
        noValidate
        className="w-full max-w-md rounded-lg bg-paper p-6"
        onSubmit={(e) => {
          e.preventDefault();
          const next: Record<string, string> = {};
          if (!name.trim()) next.name = "Client name is required";
          if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) next.contactEmail = "Enter a valid email address";
          if (contactPhone && !/^[0-9+\-\s]{8,20}$/.test(contactPhone)) next.contactPhone = "Enter a valid phone number";
          setFieldErrors(next);
          if (Object.keys(next).length > 0) {
            requestAnimationFrame(() => focusInvalid(e.currentTarget));
            return;
          }
          void onSave({
            name: name.trim(),
            industryId: industryId || null,
            contactName,
            contactEmail,
            contactPhone,
            isActive,
          });
        }}
      >
        <h2 className="font-display text-2xl">{title}</h2>
        <FormBanner message={error} />
        <div className="mt-5 flex flex-col gap-3 text-sm">
          <Field label="Client name" required error={fieldErrors.name}>
            <input value={name} aria-invalid={Boolean(fieldErrors.name)} onChange={(e) => { setName(e.target.value); setFieldErrors((c) => ({ ...c, name: "" })); }} className={controlClass(Boolean(fieldErrors.name))} />
          </Field>
          <Field label="Industry">
            <select value={industryId} onChange={(e) => setIndustryId(e.target.value)} className={controlClass()}>
              <option value="">Select industry</option>
              {industries.map((industry) => (
                <option key={industry.id} value={industry.id}>
                  {industry.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Contact name">
            <input value={contactName} onChange={(e) => setContactName(e.target.value)} className={controlClass()} />
          </Field>
          <Field label="Contact email" error={fieldErrors.contactEmail}>
            <input type="email" value={contactEmail} aria-invalid={Boolean(fieldErrors.contactEmail)} onChange={(e) => { setContactEmail(e.target.value); setFieldErrors((c) => ({ ...c, contactEmail: "" })); }} className={controlClass(Boolean(fieldErrors.contactEmail))} />
          </Field>
          <Field label="Contact phone" error={fieldErrors.contactPhone}>
            <input value={contactPhone} aria-invalid={Boolean(fieldErrors.contactPhone)} onChange={(e) => { setContactPhone(e.target.value); setFieldErrors((c) => ({ ...c, contactPhone: "" })); }} className={controlClass(Boolean(fieldErrors.contactPhone))} />
          </Field>
          <label className="flex items-center gap-2 text-ink-soft">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Active
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <ActionIcon action="cancel" onClick={onClose} />
          <ActionIcon type="submit" action="save" disabled={saving} />
        </div>
      </form>
    </div>
  );
}
