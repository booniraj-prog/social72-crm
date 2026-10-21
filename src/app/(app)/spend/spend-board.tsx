"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { formatInr } from "@/lib/money";
import { SortHeader, TableToolbar, HistoryTip, TableFrame, useTableQuery } from "@/components/platform/table-controls";
import { controlClass, Field, FormBanner, focusInvalid, validateRecord } from "@/components/platform/form-field";
import { FileBrowseField } from "@/components/platform/file-browse-field";
import { ActionIcon, ActionsHeader } from "@/components/ui/action-icon";

type Expense = {
  id: string;
  category: string;
  amount: number;
  status: string;
  claimant: string;
  claimantId: string;
  spentOn: string;
  notes: string | null;
  receiptUrl?: string | null;
  project: string;
  engagementId: string | null;
  history: string;
};
type Purchase = {
  id: string;
  number: string;
  title: string;
  vendor: string;
  status: string;
  amount: number;
  ownerUserId: string | null;
  project: string;
  engagementId: string | null;
  notes: string | null;
  history: string;
};
type License = {
  id: string;
  name: string;
  vendor: string;
  category: string;
  status: string;
  bucket: string;
  expiryDate: string;
  amount: number;
  ownerUserId: string | null;
  project: string;
  engagementId: string | null;
  notes: string | null;
  history: string;
};

export function SpendBoard({
  expenses,
  purchases,
  licenses,
  actorId,
  canApprove,
  canDelete,
  expenseFields,
  purchaseFields,
  licenseFields,
}: {
  expenses: Expense[];
  purchases: Purchase[];
  licenses: License[];
  actorId: string;
  canApprove: boolean;
  canDelete: boolean;
  expenseFields: Array<{
    name: string;
    label: string;
    type?: string;
    required?: boolean;
    accept?: string;
    folder?: string;
    preview?: boolean;
    options?: Array<{ value: string; label: string }>;
  }>;
  purchaseFields: Array<{
    name: string;
    label: string;
    type?: string;
    required?: boolean;
    accept?: string;
    folder?: string;
    preview?: boolean;
    options?: Array<{ value: string; label: string }>;
  }>;
  licenseFields: Array<{
    name: string;
    label: string;
    type?: string;
    required?: boolean;
    accept?: string;
    folder?: string;
    preview?: boolean;
    options?: Array<{ value: string; label: string }>;
  }>;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"queue" | "expense" | "purchase" | "license">("queue");
  const [create, setCreate] = useState<"expense" | "purchase" | "license" | null>(null);
  const [editRow, setEditRow] = useState<Record<string, unknown> | null>(null);
  const pending = useMemo(
    () => [
      ...expenses
        .filter((e) => e.status === "SUBMITTED")
        .map((e) => ({
          id: e.id,
          kind: "expense-decide" as const,
          deleteKind: "expense-delete",
          title: e.category,
          meta: `${e.claimant} · ${e.spentOn} · ${e.project}`,
          amount: e.amount,
          type: "Expense",
          canRemove: canDelete || e.claimantId === actorId,
        })),
      ...purchases
        .filter((p) => p.status === "REQUESTED")
        .map((p) => ({
          id: p.id,
          kind: "purchase-decide" as const,
          deleteKind: "purchase-delete",
          title: p.title,
          meta: `${p.number} · ${p.vendor} · ${p.project}`,
          amount: p.amount,
          type: "Purchase",
          canRemove: canDelete || p.ownerUserId === actorId,
        })),
      ...licenses
        .filter((l) => l.status === "PENDING")
        .map((l) => ({
          id: l.id,
          kind: "license-decide" as const,
          deleteKind: "license-delete",
          title: l.name,
          meta: `${l.vendor} · ${l.category} · ${l.project}`,
          amount: l.amount,
          type: "License",
          canRemove: canDelete || l.ownerUserId === actorId,
        })),
    ],
    [expenses, purchases, licenses, actorId, canDelete],
  );

  async function decide(kind: string, id: string, status: string) {
    await fetch(`/api/platform?kind=${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    router.refresh();
  }

  async function remove(kind: string, id: string) {
    if (!window.confirm("Delete this record? This cannot be undone.")) return;
    await fetch(`/api/platform?kind=${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    router.refresh();
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-ink-soft">Finance</p>
          <h1 className="mt-1 font-display text-3xl text-ink">Spend</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-soft">
            Claim expenses, raise vendor POs and log tools. Accounts or HR approve before the cost hits the project or Social72 profit.
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          <ActionIcon action="new" label="Claim expense" onClick={() => { setEditRow(null); setCreate("expense"); }} />
          <ActionIcon action="new" label="Request PO" onClick={() => { setEditRow(null); setCreate("purchase"); }} />
          <ActionIcon action="new" label="Add license" onClick={() => { setEditRow(null); setCreate("license"); }} />
        </div>
      </div>

      <dl className="mt-5 grid gap-3 sm:grid-cols-3">
        <Kpi label="Awaiting approval" value={pending.length} />
        <Kpi label="Expense claims" value={expenses.length} />
        <Kpi label="Licenses" value={licenses.length} />
      </dl>

      <div className="mt-5 flex flex-wrap gap-1">
        {(
          [
            ["queue", `Queue (${pending.length})`],
            ["expense", "Expenses"],
            ["purchase", "Purchases"],
            ["license", "Licenses"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`h-9 rounded-md px-3 text-sm ${tab === id ? "bg-ink text-white" : "border border-line bg-white"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "queue" ? (
        <div className="surface mt-4 overflow-x-auto rounded-lg">
          {pending.length === 0 ? (
            <p className="p-6 text-sm text-ink-soft">Nothing waiting for approval.</p>
          ) : (
            <TableFrame
              rows={pending.map((row) => ({
                ...row,
                tableId: `${row.kind}-${row.id}`,
                type: row.type,
                item: row.title,
                detail: row.meta,
              }))}
              columns={["type", "item", "detail", "amount"]}
              empty="Nothing waiting for approval."
              extraHeaders={<ActionsHeader />}
              extraColSpan={1}
              rowKey={(row) => String(row.tableId)}
              renderRow={(row) => (
                <>
                  <td className="px-3 py-2">{String(row.type)}</td>
                  <td className="px-3 py-2">{String(row.item)}</td>
                  <td className="px-3 py-2 text-ink-soft">{String(row.detail)}</td>
                  <td className="px-3 py-2 text-right">₹{formatInr(Number(row.amount))}</td>
                  <td className="px-3 py-2 text-right">
                    <span className="flex justify-end gap-2">
                      {canApprove ? (
                        <>
                          <ActionIcon action="approve" onClick={() => void decide(String(row.kind), String(row.id), "APPROVED")} />
                          <ActionIcon action="reject" onClick={() => void decide(String(row.kind), String(row.id), "REJECTED")} />
                        </>
                      ) : (
                        <span className="text-ink-soft">Pending</span>
                      )}
                      {row.canRemove ? (
                        <ActionIcon action="delete" onClick={() => void remove(String(row.deleteKind), String(row.id))} />
                      ) : null}
                    </span>
                  </td>
                </>
              )}
            />
          )}
        </div>
      ) : null}

      {tab === "expense" ? (
        <Table
          columns={["category", "project", "amountDisplay", "status", "claimant", "spentOn"]}
          rows={expenses.map((e) => ({
            ...e,
            amountDisplay: `₹${formatInr(e.amount)}`,
            canRemove: canDelete || (e.claimantId === actorId && e.status === "SUBMITTED"),
            canEdit: canDelete || (e.claimantId === actorId && e.status === "SUBMITTED"),
          }))}
          onDelete={(id) => void remove("expense-delete", id)}
          onEdit={(row) => {
            setCreate("expense");
            setEditRow(row);
          }}
        />
      ) : null}
      {tab === "purchase" ? (
        <Table
          columns={["number", "title", "project", "vendor", "status", "amountDisplay"]}
          rows={purchases.map((p) => ({
            ...p,
            vendorName: p.vendor,
            amountDisplay: `₹${formatInr(p.amount)}`,
            canRemove: canDelete || (p.ownerUserId === actorId && p.status === "REQUESTED"),
            canEdit: canDelete || (p.ownerUserId === actorId && p.status === "REQUESTED"),
          }))}
          onDelete={(id) => void remove("purchase-delete", id)}
          onEdit={(row) => {
            setCreate("purchase");
            setEditRow(row);
          }}
        />
      ) : null}
      {tab === "license" ? (
        <Table
          columns={["name", "project", "vendor", "status", "bucket", "expiryDate", "amountDisplay"]}
          rows={licenses.map((l) => ({
            ...l,
            amountDisplay: `₹${formatInr(l.amount)}`,
            canRemove: canDelete || (l.ownerUserId === actorId && l.status === "PENDING"),
            canEdit: canDelete || (l.ownerUserId === actorId && l.status === "PENDING"),
          }))}
          onDelete={(id) => void remove("license-delete", id)}
          onEdit={(row) => {
            setCreate("license");
            setEditRow(row);
          }}
        />
      ) : null}

      {create ? (
        <CreateForm
          kind={create}
          fields={create === "expense" ? expenseFields : create === "purchase" ? purchaseFields : licenseFields}
          initial={editRow}
          onClose={() => {
            setCreate(null);
            setEditRow(null);
          }}
          onSaved={() => {
            setCreate(null);
            setEditRow(null);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="surface rounded-lg px-3 py-3">
      <p className="text-[10px] uppercase tracking-[0.14em] text-ink-soft">{label}</p>
      <p className="mt-1 font-display text-xl leading-none text-ink">{value}</p>
    </div>
  );
}

function Table({
  columns,
  rows,
  onDelete,
  onEdit,
}: {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  onDelete: (id: string) => void;
  onEdit: (row: Record<string, unknown>) => void;
}) {
  const table = useTableQuery(rows, columns);
  return (
    <div className="surface mt-4 overflow-x-auto rounded-lg">
      {rows.length === 0 ? (
        <p className="p-6 text-sm text-ink-soft">Nothing here yet.</p>
      ) : (
        <>
          <TableToolbar
            columns={columns}
            query={table.query}
            setQuery={table.setQuery}
            filterKey={table.filterKey}
            setFilterKey={table.setFilterKey}
            filterValue={table.filterValue}
            setFilterValue={table.setFilterValue}
            sortKey={table.sortKey}
            setSortKey={table.setSortKey}
            sortDir={table.sortDir}
            setSortDir={table.setSortDir}
            options={table.options}
          />
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
                {columns.map((c) => (
                  <SortHeader key={c} label={c} active={table.sortKey === c} dir={table.sortDir} onClick={() => table.toggleSort(c)} />
                ))}
                <ActionsHeader />
              </tr>
            </thead>
            <tbody>
              {table.view.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-ink-soft" colSpan={columns.length + 1}>
                    No rows match this search or filter.
                  </td>
                </tr>
              ) : (
                table.view.map((row) => (
                  <tr key={String(row.id)} className="border-b border-line last:border-0">
                    {columns.map((c, ci) => (
                      <td key={c} className="px-3 py-2 whitespace-nowrap">
                        {ci === 0 ? (
                          <HistoryTip history={typeof row.history === "string" ? row.history : ""}>
                            <span>{row[c] == null ? "" : String(row[c])}</span>
                          </HistoryTip>
                        ) : row[c] == null ? (
                          ""
                        ) : (
                          String(row[c])
                        )}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right">
                      <span className="flex justify-end gap-0.5">
                        {row.canEdit ? <ActionIcon action="edit" onClick={() => onEdit(row)} /> : null}
                        {row.canRemove ? <ActionIcon action="delete" onClick={() => onDelete(String(row.id))} /> : null}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

function CreateForm({
  kind,
  fields,
  initial,
  onClose,
  onSaved,
}: {
  kind: "expense" | "purchase" | "license";
  fields: Array<{ name: string; label: string; type?: string; required?: boolean; options?: Array<{ value: string; label: string }> }>;
  initial?: Record<string, unknown> | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const editing = Boolean(initial?.id);
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-ink/40 p-4">
      <form
        noValidate
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-paper p-6"
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          setError("");
          const form = e.currentTarget;
          const data = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
          if (editing) data.id = String(initial?.id);
          const nextErrors = validateRecord(
            data,
            fields.map((field) => ({
              name: field.name,
              label: field.label,
              required: field.required,
              type: field.type,
              min: field.type === "number" ? 0 : undefined,
            })),
          );
          setFieldErrors(nextErrors);
          if (Object.keys(nextErrors).length > 0) {
            setError("Please fix the highlighted fields.");
            setSaving(false);
            requestAnimationFrame(() => focusInvalid(form));
            return;
          }
          const res = await fetch(`/api/platform?kind=${editing ? `${kind}-update` : kind}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          });
          const json = await res.json().catch(() => ({}));
          setSaving(false);
          if (!res.ok) {
            setError(json.error?.message ?? "Could not save");
            return;
          }
          onSaved();
        }}
      >
        <h2 className="font-display text-2xl">{editing ? `Edit ${kind}` : `New ${kind}`}</h2>
        <FormBanner message={error} />
        <div className="mt-4 grid gap-3">
          {fields.map((field) => {
            const raw = initial?.[field.name];
            const defaultValue = raw == null ? "" : String(raw);
            return (
              <Field key={field.name} label={field.label} required={field.required} error={fieldErrors[field.name]}>
                {field.options ? (
                  <select
                    name={field.name}
                    defaultValue={defaultValue}
                    aria-invalid={Boolean(fieldErrors[field.name])}
                    onChange={() => setFieldErrors((current) => ({ ...current, [field.name]: "" }))}
                    className={controlClass(Boolean(fieldErrors[field.name]))}
                  >
                    <option value="">{field.name === "engagementId" ? "Overhead / not project-specific" : "Select"}</option>
                    {field.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : field.type === "file" ? (
                  <FileBrowseField
                    name={field.name}
                    defaultUrl={defaultValue}
                    accept={field.accept}
                    folder={field.folder ?? "files"}
                    preview={field.preview}
                  />
                ) : (
                  <input
                    name={field.name}
                    type={field.type ?? "text"}
                    defaultValue={defaultValue}
                    aria-invalid={Boolean(fieldErrors[field.name])}
                    onChange={() => setFieldErrors((current) => ({ ...current, [field.name]: "" }))}
                    className={controlClass(Boolean(fieldErrors[field.name]))}
                  />
                )}
              </Field>
            );
          })}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <ActionIcon action="cancel" onClick={onClose} />
          <ActionIcon type="submit" action="save" disabled={saving} label={editing ? "Save changes" : "Submit for approval"} />
        </div>
      </form>
    </div>
  );
}
