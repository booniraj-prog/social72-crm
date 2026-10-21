"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ActionIcon } from "@/components/ui/action-icon";
import { controlClass, Field, FormBanner } from "@/components/platform/form-field";
import { FileBrowseField } from "@/components/platform/file-browse-field";
import { DOCUMENT_KINDS } from "@/modules/platform/constants";

export type AttachmentRow = {
  id: string;
  filename: string;
  kind: string;
  url: string;
  client: string;
  project: string;
  invoice: string;
  po: string;
  person?: string;
  followUp: string;
  createdAt: string;
  clientId: string | null;
  engagementId: string | null;
  invoiceId: string | null;
  clientOrderId: string | null;
  userId?: string | null;
};

type Option = { value: string; label: string };

export function AttachmentsPanel({
  title = "Attachments",
  files,
  clients,
  projects,
  invoices,
  orders,
  people,
  defaults,
  canDelete,
  compact,
}: {
  title?: string;
  files: AttachmentRow[];
  clients: Option[];
  projects: Option[];
  invoices: Option[];
  orders: Option[];
  people?: Option[];
  defaults?: {
    clientId?: string;
    engagementId?: string;
    invoiceId?: string;
    clientOrderId?: string;
    userId?: string;
  };
  canDelete?: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AttachmentRow | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const initial = useMemo(
    () => ({
      title: editing?.filename ?? "",
      kind: editing && (DOCUMENT_KINDS as readonly string[]).includes(editing.kind) ? editing.kind : "OTHER",
      url: editing?.url ?? "",
      clientId: editing?.clientId ?? defaults?.clientId ?? "",
      engagementId: editing?.engagementId ?? defaults?.engagementId ?? "",
      invoiceId: editing?.invoiceId ?? defaults?.invoiceId ?? "",
      clientOrderId: editing?.clientOrderId ?? defaults?.clientOrderId ?? "",
      userId: editing?.userId ?? defaults?.userId ?? "",
      followUpAt: editing && editing.followUp !== "—" ? editing.followUp : "",
    }),
    [editing, defaults],
  );

  async function save(form: HTMLFormElement) {
    const data = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
    setSaving(true);
    setError("");
    const res = await fetch(`/api/platform?kind=${editing ? "document-update" : "document"}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editing?.id,
        title: data.title,
        kind: data.kind || "OTHER",
        url: data.url,
        clientId: data.clientId || defaults?.clientId || "",
        engagementId: data.engagementId || defaults?.engagementId || "",
        invoiceId: data.invoiceId || defaults?.invoiceId || "",
        clientOrderId: data.clientOrderId || defaults?.clientOrderId || "",
        userId: data.userId || defaults?.userId || "",
        followUpAt: data.followUpAt || "",
        notes: data.notes || "",
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error?.message ?? "Could not save attachment");
      return;
    }
    setOpen(false);
    setEditing(null);
    router.refresh();
  }

  return (
    <section className={compact ? "rounded-lg border border-line bg-white p-5" : "surface mt-5 rounded-lg p-5"}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {!compact ? <p className="text-xs uppercase tracking-[0.16em] text-ink-soft">Files</p> : null}
          <h2 className={compact ? "text-xs uppercase tracking-[0.16em] text-ink-soft" : "mt-1 font-display text-2xl text-ink"}>{title}</h2>
          {!compact ? (
            <p className="mt-1 max-w-2xl text-sm text-ink-soft">
              Add a file or page URL, then tag it to a client, project, invoice or client PO. View opens the file. Delete removes the tag from the record.
            </p>
          ) : null}
        </div>
        <ActionIcon
          action="new"
          label="Add attachment"
          onClick={() => {
            setError("");
            setEditing(null);
            setOpen(true);
          }}
        />
      </div>

      {files.length === 0 ? (
        <p className="mt-4 text-sm text-ink-soft">No attachments tagged here yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-3 py-2 font-medium">File</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Client</th>
                <th className="px-3 py-2 font-medium">Project</th>
                <th className="px-3 py-2 font-medium">Invoice</th>
                <th className="px-3 py-2 font-medium">PO</th>
                <th className="px-3 py-2 font-medium">Person</th>
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {files.map((file) => (
                <tr key={file.id} className="border-b border-line last:border-0">
                  <td className="px-3 py-2">
                    {file.url ? (
                      <a className="text-copper underline" href={file.url} target="_blank" rel="noreferrer">
                        {file.filename}
                      </a>
                    ) : (
                      file.filename
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{file.kind.replaceAll("_", " ")}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{file.client}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{file.project}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{file.invoice}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{file.po}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{file.person ?? "—"}</td>
                  <td className="px-3 py-2">
                    <span className="flex justify-end gap-0.5">
                      {file.url ? <ActionIcon action="preview" href={file.url} target="_blank" rel="noreferrer" label="View attachment" /> : null}
                      <ActionIcon
                        action="edit"
                        label="Tag attachment"
                        onClick={() => {
                          setError("");
                          setEditing(file);
                          setOpen(true);
                        }}
                      />
                      {canDelete ? (
                        <ActionIcon
                          action="delete"
                          label="Delete attachment"
                          onClick={async () => {
                            if (!window.confirm("Delete this attachment?")) return;
                            await fetch("/api/platform?kind=document-delete", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ id: file.id }),
                            });
                            router.refresh();
                          }}
                        />
                      ) : null}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open ? (
        <form
          className="mt-4 rounded-md border border-line bg-paper-2 p-4"
          key={editing?.id ?? "new"}
          onSubmit={(e) => {
            e.preventDefault();
            void save(e.currentTarget);
          }}
        >
          <h3 className="font-display text-lg text-ink">{editing ? "Tag attachment" : "Add attachment"}</h3>
          <FormBanner message={error} />
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Title" required>
              <input name="title" required defaultValue={initial.title} className={controlClass()} />
            </Field>
            <Field label="Type">
              <select name="kind" defaultValue={initial.kind} className={controlClass()}>
                {DOCUMENT_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {kind.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="File">
              <FileBrowseField name="url" defaultUrl={initial.url} folder="documents" preview />
            </Field>
            <Field label="Follow-up">
              <input name="followUpAt" type="date" defaultValue={initial.followUpAt} className={controlClass()} />
            </Field>
            {defaults?.clientId ? <input type="hidden" name="clientId" value={defaults.clientId} /> : (
              <Field label="Client">
                <select name="clientId" defaultValue={initial.clientId} className={controlClass()}>
                  <option value="">Select</option>
                  {clients.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {defaults?.engagementId ? <input type="hidden" name="engagementId" value={defaults.engagementId} /> : (
              <Field label="Project">
                <select name="engagementId" defaultValue={initial.engagementId} className={controlClass()}>
                  <option value="">Select</option>
                  {projects.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {defaults?.invoiceId ? <input type="hidden" name="invoiceId" value={defaults.invoiceId} /> : (
              <Field label="Invoice">
                <select name="invoiceId" defaultValue={initial.invoiceId} className={controlClass()}>
                  <option value="">Select</option>
                  {invoices.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {defaults?.clientOrderId ? <input type="hidden" name="clientOrderId" value={defaults.clientOrderId} /> : (
              <Field label="Client PO">
                <select name="clientOrderId" defaultValue={initial.clientOrderId} className={controlClass()}>
                  <option value="">Select</option>
                  {orders.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {defaults?.userId ? <input type="hidden" name="userId" value={defaults.userId} /> : people?.length ? (
              <Field label="Person">
                <select name="userId" defaultValue={initial.userId} className={controlClass()}>
                  <option value="">Select</option>
                  {people.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
            <Field label="Notes">
              <input name="notes" className={controlClass()} />
            </Field>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <ActionIcon
              action="cancel"
              onClick={() => {
                setOpen(false);
                setEditing(null);
              }}
            />
            <ActionIcon type="submit" action="save" disabled={saving} label={editing ? "Save tags" : "Add attachment"} />
          </div>
        </form>
      ) : null}
    </section>
  );
}
