"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ActionIcon, ActionsHeader } from "@/components/ui/action-icon";
import { SortHeader, TableToolbar, HistoryTip, useTableQuery } from "@/components/platform/table-controls";
import { controlClass, Field, FormBanner, focusInvalid, validateRecord } from "@/components/platform/form-field";
import { FileBrowseField } from "@/components/platform/file-browse-field";
import { ActiveToggle } from "@/components/platform/active-toggle";
import type { LifecycleEntity } from "@/modules/lifecycle/types";

type Field = {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  accept?: string;
  folder?: string;
  preview?: boolean;
  options?: Array<{ value: string; label: string }>;
};

export function SimpleBoard({
  eyebrow,
  title,
  summary,
  columns,
  rows,
  fields,
  kind,
  kpis,
  canCreate = true,
  rowHrefPrefix,
  allowDelete = false,
  deleteKind,
  documentActions = false,
  lifecycleEntity,
}: {
  eyebrow: string;
  title: string;
  summary: string;
  columns: string[];
  rows: Array<Record<string, unknown>>;
  fields: Field[];
  kind: string;
  kpis?: Array<{ label: string; value: string | number }>;
  canCreate?: boolean;
  rowHrefPrefix?: string;
  allowDelete?: boolean;
  deleteKind?: string;
  documentActions?: boolean;
  lifecycleEntity?: LifecycleEntity;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const table = useTableQuery(rows, columns);
  const showActions = allowDelete || documentActions || Boolean(lifecycleEntity);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-ink-soft">{eyebrow}</p>
          <h1 className="mt-1 font-display text-3xl text-ink">{title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-soft">{summary}</p>
        </div>
        {canCreate ? (
          <ActionIcon
            action="new"
            label={`New ${title.toLowerCase()}`}
            onClick={() => {
              setError("");
              setFieldErrors({});
              setOpen(true);
            }}
          />
        ) : null}
      </div>

      {kpis?.length ? (
        <dl className="mt-6 grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="surface rounded-lg px-3 py-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-ink-soft">{kpi.label}</p>
              <p className="mt-1 font-display text-xl leading-none text-ink">{kpi.value}</p>
            </div>
          ))}
        </dl>
      ) : null}

      <div className="surface mt-5 overflow-x-auto rounded-lg">
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
                  {columns.map((col) => (
                    <SortHeader key={col} label={col} active={table.sortKey === col} dir={table.sortDir} onClick={() => table.toggleSort(col)} />
                  ))}
                  {showActions ? <ActionsHeader /> : null}
                </tr>
              </thead>
              <tbody>
                {table.view.length === 0 ? (
                  <tr>
                    <td className="px-3 py-6 text-ink-soft" colSpan={columns.length + (showActions ? 1 : 0)}>
                      No rows match this search or filter.
                    </td>
                  </tr>
                ) : (
                  table.view.map((row, i) => {
                    const href =
                      typeof row.href === "string" && row.href
                        ? row.href
                        : rowHrefPrefix && row.id
                          ? `${rowHrefPrefix}/${row.id}`
                          : null;
                    return (
                      <tr
                        key={String(row.id ?? i)}
                        className={`border-b border-line last:border-0 ${row.isActive === false ? "opacity-60" : ""}`}
                      >
                        {columns.map((col, ci) => (
                          <td key={col} className="px-3 py-2 whitespace-nowrap">
                            {href && ci === 0 ? (
                              <HistoryTip history={typeof row.history === "string" ? row.history : ""}>
                                <a className="text-copper underline" href={href} target={String(href).startsWith("http") ? "_blank" : undefined} rel="noreferrer">
                                  {row[col] == null ? "" : String(row[col])}
                                </a>
                              </HistoryTip>
                            ) : row[col] == null ? (
                              ""
                            ) : (
                              String(row[col])
                            )}
                          </td>
                        ))}
                        {showActions ? (
                          <td className="px-3 py-2 text-right">
                            <span className="flex justify-end gap-0.5">
                              {lifecycleEntity && row.id ? (
                                <ActiveToggle
                                  entity={lifecycleEntity}
                                  id={String(row.id)}
                                  active={row.isActive !== false}
                                  name={typeof row.name === "string" ? row.name : undefined}
                                />
                              ) : null}
                              {documentActions && row.id ? (
                                <>
                                  <ActionIcon
                                    action="preview"
                                    href={`${rowHrefPrefix ?? ""}/${String(row.id)}/print`}
                                    target="_blank"
                                    rel="noreferrer"
                                  />
                                  <ActionIcon action="pdf" href={`/api/invoices/${String(row.id)}/pdf`} />
                                </>
                              ) : null}
                              {allowDelete ? (
                                <ActionIcon
                                  action="delete"
                                  onClick={async () => {
                                    if (!window.confirm("Delete this record? This cannot be undone.")) return;
                                    await fetch(`/api/platform?kind=${deleteKind ?? `${kind}-delete`}`, {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ id: row.id }),
                                    });
                                    router.refresh();
                                  }}
                                />
                              ) : null}
                            </span>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </>
        )}
      </div>

      {open ? (
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
              const res = await fetch(`/api/platform?kind=${kind}`, {
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
              setOpen(false);
              const createdId = json.row?.id;
              if (rowHrefPrefix && typeof createdId === "string") {
                router.push(`${rowHrefPrefix}/${createdId}`);
                return;
              }
              router.refresh();
            }}
          >
            <h2 className="font-display text-2xl">New {title.toLowerCase()}</h2>
            <FormBanner message={error} />
            <div className="mt-4 grid gap-3">
              {fields.map((field) => (
                <Field key={field.name} label={field.label} required={field.required} error={fieldErrors[field.name]}>
                  {field.options ? (
                    <select
                      name={field.name}
                      aria-invalid={Boolean(fieldErrors[field.name])}
                      onChange={() => setFieldErrors((current) => ({ ...current, [field.name]: "" }))}
                      className={controlClass(Boolean(fieldErrors[field.name]))}
                    >
                      <option value="">Select</option>
                      {field.options.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : field.type === "file" ? (
                    <FileBrowseField
                      name={field.name}
                      accept={field.accept}
                      folder={field.folder ?? "files"}
                      preview={field.preview}
                    />
                  ) : (
                    <input
                      name={field.name}
                      type={field.type ?? "text"}
                      autoComplete="off"
                      aria-invalid={Boolean(fieldErrors[field.name])}
                      onChange={() => setFieldErrors((current) => ({ ...current, [field.name]: "" }))}
                      className={controlClass(Boolean(fieldErrors[field.name]))}
                    />
                  )}
                </Field>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <ActionIcon action="cancel" onClick={() => setOpen(false)} />
              <ActionIcon type="submit" action="save" disabled={saving} />
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
