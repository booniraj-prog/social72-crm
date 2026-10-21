"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { HistoryTip, SortHeader, TableToolbar, useTableQuery } from "@/components/platform/table-controls";
import { controlClass, Field, FormBanner, focusInvalid } from "@/components/platform/form-field";
import { ActionIcon, ActionsHeader } from "@/components/ui/action-icon";
import { ActiveToggle } from "@/components/platform/active-toggle";
import { FileBrowseField } from "@/components/platform/file-browse-field";

type Role = { id: string; key: string; name: string };
export type PersonRow = {
  id: string;
  name: string;
  email: string;
  mobile: string | null;
  alertEmail?: string | null;
  alertPhone?: string | null;
  isActive: boolean;
  approvalStatus: string;
  role: { id: string; name: string; key: string };
  department: string | null;
  designation: string | null;
  employeeNo: string | null;
  photoUrl?: string | null;
  resumeUrl?: string | null;
  history?: string;
};

export function PeopleBoard({
  people,
  roles,
  canApprove,
  canDelete,
}: {
  people: PersonRow[];
  roles: Role[];
  canApprove: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PersonRow | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const pending = people.filter((p) => p.approvalStatus === "PENDING");
  const columns = ["name", "email", "role", "department", "status"];
  const tableRows = people.map((p) => ({
    ...p,
    roleName: p.role.name,
    role: p.role.name,
    department: p.department ?? p.designation ?? "—",
    status: p.approvalStatus === "APPROVED" ? (p.isActive ? "Active" : "Inactive") : p.approvalStatus,
  }));
  const table = useTableQuery(tableRows, columns);

  async function decide(id: string, status: "APPROVED" | "REJECTED") {
    setError("");
    const res = await fetch("/api/platform?kind=people-decide", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error?.message ?? "Could not update approval");
      return;
    }
    router.refresh();
  }

  async function remove(id: string) {
    if (!window.confirm("Remove this person? They will be deactivated and cannot sign in.")) return;
    setError("");
    const res = await fetch("/api/platform?kind=people-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error?.message ?? "Could not remove this person");
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-ink-soft">Company</p>
          <h1 className="mt-1 font-display text-3xl text-ink">Employees</h1>
          <p className="mt-1 max-w-xl text-sm text-ink-soft">
            Onboard employees, assign roles, and activate login. New people stay pending until HR or a manager approves.
          </p>
        </div>
        <ActionIcon
          action="new"
          label="New person"
          onClick={() => {
            setEditing(null);
            setError("");
            setOpen(true);
          }}
        />
      </div>

      {error && !open ? <p className="mt-4 text-sm text-danger">{error}</p> : null}

      {pending.length > 0 ? (
        <section className="surface mt-5 rounded-lg p-4">
          <h2 className="font-display text-xl">Awaiting approval ({pending.length})</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {pending.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <ProfileThumb url={p.photoUrl} name={p.name} />
                  {p.name} · {p.email} · {p.role.name}
                </span>
                {canApprove ? (
                  <span className="flex gap-0.5">
                    <ActionIcon action="approve" onClick={() => void decide(p.id, "APPROVED")} />
                    <ActionIcon action="reject" onClick={() => void decide(p.id, "REJECTED")} />
                  </span>
                ) : (
                  <span className="text-ink-soft">Pending</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="surface mt-5 overflow-x-auto rounded-lg">
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
            {table.view.map((p) => (
              <tr key={p.id} className={`border-b border-line last:border-0 ${p.isActive ? "" : "opacity-60"}`}>
                <td className="px-3 py-2">
                  <HistoryTip history={p.history}>
                    <span className="flex items-center gap-2">
                      <ProfileThumb url={p.photoUrl} name={p.name} />
                      <span>{p.name}</span>
                    </span>
                  </HistoryTip>
                </td>
                <td className="px-3 py-2 text-ink-soft">{p.email}</td>
                <td className="px-3 py-2">{p.role}</td>
                <td className="px-3 py-2">{p.department}</td>
                <td className="px-3 py-2">{p.status}</td>
                <td className="px-3 py-2 text-right">
                  <span className="flex justify-end gap-0.5">
                    {(canApprove || canDelete) && p.approvalStatus === "APPROVED" ? (
                      <ActiveToggle entity="employee" id={p.id} active={p.isActive} name={p.name} />
                    ) : null}
                    <ActionIcon
                      action="edit"
                      onClick={() => {
                        const original = people.find((row) => row.id === p.id);
                        if (!original) return;
                        setEditing(original);
                        setError("");
                        setOpen(true);
                      }}
                    />
                    {canDelete ? <ActionIcon action="delete" onClick={() => void remove(p.id)} /> : null}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open ? (
        <PersonDialog
          key={editing?.id ?? "new"}
          roles={roles}
          person={editing}
          error={error}
          saving={saving}
          onClose={() => setOpen(false)}
          onSave={async (payload) => {
            setSaving(true);
            setError("");
            const url = editing ? "/api/platform?kind=people-update" : "/api/platform?kind=people";
            const res = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(editing ? { ...payload, userId: editing.id } : payload),
            });
            const json = await res.json().catch(() => ({}));
            setSaving(false);
            if (!res.ok) {
              setError(json.error?.message ?? "Could not save");
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

function PersonDialog({
  roles,
  person,
  error,
  saving,
  onClose,
  onSave,
}: {
  roles: Role[];
  person: PersonRow | null;
  error: string;
  saving: boolean;
  onClose: () => void;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [name, setName] = useState(person?.name ?? "");
  const [email, setEmail] = useState(person?.email ?? "");
  const [mobile, setMobile] = useState(person?.mobile ?? "");
  const [roleId, setRoleId] = useState(person?.role.id ?? roles.find((r) => r.key === "employee")?.id ?? roles[0]?.id ?? "");
  const [password, setPassword] = useState("");
  const [designation, setDesignation] = useState(person?.designation ?? "");
  const [employeeNo, setEmployeeNo] = useState(person?.employeeNo ?? "");
  const [departmentName, setDepartmentName] = useState(person?.department ?? "");
  const [photoUrl, setPhotoUrl] = useState(person?.photoUrl ?? "");
  const [resumeUrl, setResumeUrl] = useState(person?.resumeUrl ?? "");
  const title = useMemo(() => (person ? "Edit person" : "New person"), [person]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function clearField(name: string) {
    setFieldErrors((current) => ({ ...current, [name]: "" }));
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-ink/40 p-4">
      <form
        noValidate
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-paper p-6"
        onSubmit={(e) => {
          e.preventDefault();
          const next: Record<string, string> = {};
          if (!name.trim()) next.name = "Employee name is required";
          if (!person && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = "Enter a valid work email";
          if (!person && password.length < 8) next.password = "Password must be at least 8 characters";
          if (person && password && password.length < 8) next.password = "Password must be at least 8 characters";
          if (!roleId) next.roleId = "Select a role";
          if (mobile && !/^[0-9+\-\s]{8,20}$/.test(mobile)) next.mobile = "Enter a valid mobile number";
          setFieldErrors(next);
          if (Object.keys(next).length > 0) {
            requestAnimationFrame(() => focusInvalid(e.currentTarget));
            return;
          }
          const payload: Record<string, unknown> = {
            name: name.trim(),
            mobile,
            roleId,
            designation,
            employeeNo,
            departmentName,
            photoUrl,
            resumeUrl,
          };
          if (!person) {
            payload.email = email.trim();
            payload.password = password;
          } else if (password) {
            payload.password = password;
          }
          void onSave(payload);
        }}
      >
        <h2 className="font-display text-2xl">{title}</h2>
        <p className="mt-1 text-sm text-ink-soft">{person ? "Updates the login and employee record." : "Goes to the approval queue before they can sign in."}</p>
        <FormBanner message={error} />
        <div className="mt-4 grid gap-3 text-sm">
          <Field label="Employee name" required error={fieldErrors.name}>
            <input autoComplete="off" value={name} aria-invalid={Boolean(fieldErrors.name)} onChange={(e) => { setName(e.target.value); clearField("name"); }} className={controlClass(Boolean(fieldErrors.name))} />
          </Field>
          {!person ? (
            <Field label="Work email" required error={fieldErrors.email}>
              <input type="email" value={email} aria-invalid={Boolean(fieldErrors.email)} onChange={(e) => { setEmail(e.target.value); clearField("email"); }} className={controlClass(Boolean(fieldErrors.email))} />
            </Field>
          ) : null}
          <Field label="Mobile" error={fieldErrors.mobile}>
            <input value={mobile} aria-invalid={Boolean(fieldErrors.mobile)} onChange={(e) => { setMobile(e.target.value); clearField("mobile"); }} className={controlClass(Boolean(fieldErrors.mobile))} />
          </Field>
          <Field label="Role" required error={fieldErrors.roleId}>
            <select value={roleId} aria-invalid={Boolean(fieldErrors.roleId)} onChange={(e) => { setRoleId(e.target.value); clearField("roleId"); }} className={controlClass(Boolean(fieldErrors.roleId))}>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Department">
            <input value={departmentName} onChange={(e) => setDepartmentName(e.target.value)} className={controlClass()} />
          </Field>
          <Field label="Designation">
            <input value={designation} onChange={(e) => setDesignation(e.target.value)} className={controlClass()} />
          </Field>
          <Field label="Employee no.">
            <input value={employeeNo} onChange={(e) => setEmployeeNo(e.target.value)} className={controlClass()} />
          </Field>
          <Field label="Profile photo">
            <FileBrowseField
              name="photoUrl"
              defaultUrl={photoUrl}
              accept="image/*"
              folder="people"
              preview
              onChange={setPhotoUrl}
            />
          </Field>
          <Field label="Resume">
            <FileBrowseField
              name="resumeUrl"
              defaultUrl={resumeUrl}
              accept=".pdf,.doc,.docx,application/pdf"
              folder="resumes"
              onChange={setResumeUrl}
            />
          </Field>
          <Field label={person ? "New password (optional)" : "Password"} required={!person} error={fieldErrors.password} hint={person ? "Leave blank to keep the current password." : "Minimum 8 characters."}>
            <input type="password" value={password} aria-invalid={Boolean(fieldErrors.password)} onChange={(e) => { setPassword(e.target.value); clearField("password"); }} className={controlClass(Boolean(fieldErrors.password))} />
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <ActionIcon action="cancel" onClick={onClose} />
          <ActionIcon type="submit" action="save" disabled={saving} label={person ? "Save" : "Submit for approval"} />
        </div>
      </form>
    </div>
  );
}

function ProfileThumb({ url, name }: { url?: string | null; name: string }) {
  if (url) {
    return <img src={url} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />;
  }
  return (
    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-paper-2 text-xs font-medium text-ink-soft">
      {(name.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}
