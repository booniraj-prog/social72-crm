import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/rbac";
import { getAuthUser } from "@/lib/session";
import SettingsView from "./settings-view";

export default async function SettingsGate() {
  const actor = await getAuthUser();
  if (!actor || !hasPermission(actor, "settings.write")) redirect("/dashboard");
  return <SettingsView />;
}
