import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/rbac";
import { getAuthUser } from "@/lib/session";
import { listRoles, listUsers } from "@/modules/users/service";
import { UsersManager } from "./users-manager";

export default async function UsersPage() {
  const actor = await getAuthUser();
  if (!actor || !hasPermission(actor, "user.read")) redirect("/dashboard");

  const [users, roles] = await Promise.all([listUsers(), listRoles()]);

  return (
    <UsersManager
      users={users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        mobile: u.mobile,
        isActive: u.isActive,
        lastLoginAt: u.lastLoginAt,
        role: { id: u.role.id, name: u.role.name, key: u.role.key },
      }))}
      roles={roles.map((r) => ({ id: r.id, key: r.key, name: r.name }))}
    />
  );
}
