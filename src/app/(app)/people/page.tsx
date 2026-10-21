import { redirect } from "next/navigation";
import { canDeleteRecords, hasPermission } from "@/lib/rbac";
import { canApprove } from "@/lib/approvals";
import { getAuthUser } from "@/lib/session";
import { listPeople } from "@/modules/platform/service";
import { listRoles } from "@/modules/users/service";
import { PeopleBoard } from "./people-board";

export default async function PeoplePage() {
  const actor = await getAuthUser();
  if (!actor || !hasPermission(actor, "user.read")) redirect("/dashboard");
  const [people, roles, approver] = await Promise.all([listPeople(), listRoles(), canApprove(actor, "people")]);
  return (
    <PeopleBoard
      canApprove={approver}
      canDelete={canDeleteRecords(actor)}
      people={people}
      roles={roles.map((r) => ({ id: r.id, key: r.key, name: r.name }))}
    />
  );
}
