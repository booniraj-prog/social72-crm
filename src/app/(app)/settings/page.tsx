import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/rbac";
import { getAuthUser } from "@/lib/session";
import { listSettingsBoard } from "@/modules/settings/service";
import { SettingsView } from "./settings-view";

export default async function SettingsGate() {
  const actor = await getAuthUser();
  if (!actor || !hasPermission(actor, "settings.write")) redirect("/dashboard");
  const board = await listSettingsBoard();
  return (
    <SettingsView
      scoring={board.scoring}
      sla={board.sla}
      locale={board.locale}
      roles={board.roles}
      approvals={board.approvals}
      meta={board.meta}
      campaigns={board.campaigns}
      people={board.people}
    />
  );
}
