"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ActionIcon, ActionsHeader } from "@/components/ui/action-icon";
import { TableFrame } from "@/components/platform/table-controls";

type Role = { id: string; key: string; name: string };
type UserRow = {
  id: string;
  name: string;
  email: string;
  mobile: string | null;
  alertEmail?: string | null;
  alertPhone?: string | null;
  notifyEmail?: boolean;
  notifySms?: boolean;
  isActive: boolean;
  lastLoginAt: string | Date | null;
  role: { id: string; name: string; key: string };
};

export function UsersManager({ users, roles }: { users: UserRow[]; roles: Role[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-ink-soft">Admin</p>
          <h1 className="mt-2 font-display text-4xl text-ink">Users</h1>
        </div>
        <ActionIcon
          action="new"
          label="New user"
          onClick={() => {
            setEditing(null);
            setError("");
            setOpen(true);
          }}
        />
      </div>

      <div className="mt-8 overflow-hidden rounded-lg border border-line bg-white">
        <TableFrame
          rows={users.map((u) => ({
            ...u,
            phone: u.alertPhone || u.mobile || "—",
            role: u.role.name,
            status: u.isActive ? "Active" : "Inactive",
          }))}
          columns={["name", "email", "phone", "role", "status"]}
          labels={{ phone: "Alert phone" }}
          empty="No users yet."
          extraHeaders={<ActionsHeader className="px-4 py-3" />}
          extraColSpan={1}
          renderRow={(user) => (
            <>
              <td className="px-4 py-3">{String(user.name)}</td>
              <td className="px-4 py-3 text-ink-soft">{String(user.email)}</td>
              <td className="px-4 py-3 text-ink-soft">{String(user.phone)}</td>
              <td className="px-4 py-3">{String(user.role)}</td>
              <td className="px-4 py-3">{String(user.status)}</td>
              <td className="px-4 py-3 text-right">
                <ActionIcon
                  action="edit"
                  onClick={() => {
                    setEditing(users.find((u) => u.id === user.id) ?? null);
                    setError("");
                    setOpen(true);
                  }}
                />
              </td>
            </>
          )}
        />
      </div>

      {open ? (
        <UserDialog
          key={editing?.id ?? "new"}
          roles={roles}
          user={editing}
          error={error}
          saving={saving}
          onClose={() => setOpen(false)}
          onSave={async (payload) => {
            setSaving(true);
            setError("");
            const url = editing ? `/api/users/${editing.id}` : "/api/users";
            const res = await fetch(url, {
              method: editing ? "PATCH" : "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
            const json = await res.json();
            setSaving(false);
            if (!res.ok) {
              setError(json.error?.message ?? "Could not save user");
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

function UserDialog({
  roles,
  user,
  error,
  saving,
  onClose,
  onSave,
}: {
  roles: Role[];
  user: UserRow | null;
  error: string;
  saving: boolean;
  onClose: () => void;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [mobile, setMobile] = useState(user?.mobile ?? "");
  const [alertEmail, setAlertEmail] = useState(user?.alertEmail ?? user?.email ?? "");
  const [alertPhone, setAlertPhone] = useState(user?.alertPhone ?? user?.mobile ?? "");
  const [notifyEmail, setNotifyEmail] = useState(user?.notifyEmail ?? true);
  const [notifySms, setNotifySms] = useState(user?.notifySms ?? false);
  const [roleId, setRoleId] = useState(
    user?.role.id ?? roles.find((r) => r.key === "employee")?.id ?? roles[0]?.id ?? "",
  );
  const [password, setPassword] = useState("");
  const [isActive, setIsActive] = useState(user?.isActive ?? true);
  const title = useMemo(() => (user ? "Edit user" : "New user"), [user]);

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-ink/40 p-4">
      <form
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-lg bg-paper p-6 shadow-none"
        onSubmit={(e) => {
          e.preventDefault();
          const payload: Record<string, unknown> = {
            name,
            mobile,
            alertEmail,
            alertPhone,
            notifyEmail,
            notifySms,
            roleId,
            isActive,
          };
          if (!user) {
            payload.email = email;
            payload.password = password;
          } else if (password) {
            payload.password = password;
          }
          void onSave(payload);
        }}
      >
        <h2 className="font-display text-2xl">{title}</h2>
        <div className="mt-5 flex flex-col gap-3 text-sm">
          <Field label="Employee name">
            <input
              required
              name="name"
              autoComplete="off"
              placeholder="Type the employee's full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10 rounded-md border border-line bg-white px-3"
            />
          </Field>
          {!user ? (
            <Field label="Email">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10 rounded-md border border-line bg-white px-3"
              />
            </Field>
          ) : null}
          <Field label="Mobile">
            <input value={mobile} onChange={(e) => setMobile(e.target.value)} className="h-10 rounded-md border border-line bg-white px-3" />
          </Field>
          <Field label="Alert email (notifications)">
            <input
              type="email"
              value={alertEmail}
              onChange={(e) => setAlertEmail(e.target.value)}
              className="h-10 rounded-md border border-line bg-white px-3"
              placeholder="Defaults to login email"
            />
          </Field>
          <Field label="Alert phone (SMS / WhatsApp)">
            <input
              value={alertPhone}
              onChange={(e) => setAlertPhone(e.target.value)}
              className="h-10 rounded-md border border-line bg-white px-3"
              placeholder="Defaults to mobile"
            />
          </Field>
          <label className="flex items-center gap-2 text-ink-soft">
            <input type="checkbox" checked={notifyEmail} onChange={(e) => setNotifyEmail(e.target.checked)} />
            Send alerts to email
          </label>
          <label className="flex items-center gap-2 text-ink-soft">
            <input type="checkbox" checked={notifySms} onChange={(e) => setNotifySms(e.target.checked)} />
            Send alerts to phone
          </label>
          <Field label="Role">
            <select value={roleId} onChange={(e) => setRoleId(e.target.value)} className="h-10 rounded-md border border-line bg-white px-3">
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={user ? "New password (optional)" : "Password"}>
            <input
              type="password"
              required={!user}
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10 rounded-md border border-line bg-white px-3"
            />
          </Field>
          <label className="flex items-center gap-2 text-ink-soft">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Active
          </label>
        </div>
        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
        <div className="mt-6 flex justify-end gap-2">
          <ActionIcon action="cancel" onClick={onClose} />
          <ActionIcon type="submit" action="save" disabled={saving} />
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-ink-soft">{label}</span>
      {children}
    </label>
  );
}
