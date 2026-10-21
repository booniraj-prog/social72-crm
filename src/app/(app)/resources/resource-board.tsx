"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { ActionIcon } from "@/components/ui/action-icon";
import { controlClass, Field, FormBanner, focusInvalid, validateRecord } from "@/components/platform/form-field";
import { IconChip } from "@/components/ui/icons";

type Person = {
  id: string;
  name: string;
  role: string;
  designation: string | null;
  photoUrl?: string | null;
  capacity: number;
  used: number;
  available: number;
  over: boolean;
  allocations: Array<{ id: string; project: string; client: string; role: string; hoursWeek: number }>;
};

export function ResourceBoard({
  people,
  projects,
}: {
  people: Person[];
  projects: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const overloaded = people.filter((p) => p.over).length;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-ink-soft">Projects</p>
          <h1 className="mt-1 font-display text-3xl text-ink">Resources</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-soft">
            40-hour week. Allocate people to projects without going over capacity. Over-allocation is blocked.
          </p>
        </div>
        <ActionIcon
          action="new"
          label="Allocate"
          onClick={() => {
            setError("");
            setFieldErrors({});
            setOpen(true);
          }}
        />
      </div>

      <dl className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="surface flex items-center gap-3 rounded-xl px-4 py-3">
          <IconChip icon={AlertTriangle} tone={overloaded ? "danger" : "pine"} />
          <div>
            <p className="text-[10px] uppercase tracking-[0.14em] text-ink-soft">Over-allocated</p>
            <p className="font-display text-2xl leading-none">{overloaded}</p>
          </div>
        </div>
        <div className="surface rounded-xl px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.14em] text-ink-soft">People</p>
          <p className="font-display text-2xl leading-none">{people.length}</p>
        </div>
        <div className="surface rounded-xl px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.14em] text-ink-soft">Free hours this week</p>
          <p className="font-display text-2xl leading-none">{people.reduce((s, p) => s + p.available, 0)}</p>
        </div>
      </dl>

      <div className="mt-5 space-y-3">
        {people.map((person) => (
          <section key={person.id} className="surface rounded-xl p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-start gap-3">
              {person.photoUrl ? (
                <img src={person.photoUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-paper-2 text-sm text-ink-soft">
                  {(person.name.trim()[0] ?? "?").toUpperCase()}
                </span>
              )}
              <div>
                <p className="font-medium text-ink">{person.name}</p>
                <p className="text-xs text-ink-soft">
                  {person.designation || person.role} · {person.used}/{person.capacity}h used · {person.available}h free
                </p>
              </div>
              </div>
              {person.over ? <span className="text-xs text-danger">Over capacity</span> : null}
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-paper-2">
              <div
                className={`h-2 rounded-full ${person.over ? "bg-danger" : "bg-pine"}`}
                style={{ width: `${Math.min(100, Math.round((person.used / person.capacity) * 100))}%` }}
              />
            </div>
            {person.allocations.length ? (
              <ul className="mt-3 space-y-1 text-sm">
                {person.allocations.map((row) => (
                  <li key={row.id} className="flex justify-between gap-2">
                    <span>
                      {row.project}
                      <span className="text-ink-soft"> · {row.role}</span>
                    </span>
                    <span>{row.hoursWeek}h</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-ink-soft">Not on a project this week.</p>
            )}
          </section>
        ))}
      </div>

      {open ? (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-ink/40 p-4">
          <form
            noValidate
            className="w-full max-w-md rounded-lg bg-paper p-6"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const data = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
              const next = validateRecord(data, [
                { name: "userId", label: "Person", required: true },
                { name: "engagementId", label: "Project", required: true },
                { name: "hoursWeek", label: "Hours / week", required: true, type: "number", min: 0.5 },
              ]);
              setFieldErrors(next);
              if (Object.keys(next).length) {
                setError("Please fix the highlighted fields.");
                requestAnimationFrame(() => focusInvalid(form));
                return;
              }
              setSaving(true);
              setError("");
              const res = await fetch("/api/platform?kind=allocation", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  userId: data.userId,
                  engagementId: data.engagementId,
                  roleLabel: data.roleLabel,
                  hoursWeek: data.hoursWeek,
                }),
              });
              const json = await res.json().catch(() => ({}));
              setSaving(false);
              if (!res.ok) {
                setError(json.error?.message ?? "Could not allocate");
                return;
              }
              setOpen(false);
              router.refresh();
            }}
          >
            <h2 className="font-display text-2xl">Allocate to a project</h2>
            <FormBanner message={error} />
            <div className="mt-4 grid gap-3">
              <Field label="Person" required error={fieldErrors.userId}>
                <select name="userId" className={controlClass(Boolean(fieldErrors.userId))}>
                  <option value="">Select</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {p.available}h free
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Project" required error={fieldErrors.engagementId}>
                <select name="engagementId" className={controlClass(Boolean(fieldErrors.engagementId))}>
                  <option value="">Select</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Role on project">
                <input name="roleLabel" placeholder="e.g. SEO, Developer" className={controlClass()} />
              </Field>
              <Field label="Hours / week" required error={fieldErrors.hoursWeek}>
                <input name="hoursWeek" type="number" min={0.5} step="0.5" className={controlClass(Boolean(fieldErrors.hoursWeek))} />
              </Field>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <ActionIcon action="cancel" onClick={() => setOpen(false)} />
              <ActionIcon type="submit" action="save" disabled={saving} label="Allocate" />
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
