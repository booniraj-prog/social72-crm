"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Role = { id: string; key: string; name: string };
type UserRow = {
  id: string;
  name: string;
  email: string;
  mobile: string | null;
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
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setError("");
            setOpen(true);
          }}
          className="h-10 rounded-md bg-copper px-4 text-sm font-medium text-white hover:bg-copper-dark"
        >
          New user
        </button>
      </div>

      <div className="mt-8 overflow-hidden rounded-lg border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-paper-2 text-xs uppercase tracking-[0.12em] text-ink-soft">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-line">
                <td className="px-4 py-3">{user.name}</td>
                <td className="px-4 py-3 text-ink-soft">{user.email}</td>
                <td className="px-4 py-3">{user.role.name}</td>
                <td className="px-4 py-3">{user.isActive ? "Active" : "Inactive"}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    className="text-sm text-copper hover:underline"
                    onClick={() => {
                      setEditing(user);
                      setError("");
                      setOpen(true);
                    }}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open ? (
        <UserDialog
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
  const [roleId, setRoleId] = useState(user?.role.id ?? roles[0]?.id ?? "");
  const [password, setPassword] = useState("");
  const [isActive, setIsActive] = useState(user?.isActive ?? true);
  const title = useMemo(() => (user ? "Edit user" : "New user"), [user]);

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-ink/40 p-4">
      <form
        className="w-full max-w-md rounded-lg bg-paper p-6 shadow-none"
        onSubmit={(e) => {
          e.preventDefault();
          const payload: Record<string, unknown> = {
            name,
            mobile,
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
          <Field label="Full name">
            <input required value={name} onChange={(e) => setName(e.target.value)} className="h-10 rounded-md border border-line bg-white px-3" />
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-ink-soft">{label}</span>
      {children}
    </label>
  );
}
