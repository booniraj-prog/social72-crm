import { redirect } from "next/navigation";
import { hasAnyRole, hasPermission } from "@/lib/rbac";
import { getAuthUser } from "@/lib/session";
import { listCallerPerformance } from "@/modules/bpo/service";
import { BpoBoard } from "./bpo-board";

export default async function BpoPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const actor = await getAuthUser();
  if (!actor || !hasPermission(actor, "lead.read")) redirect("/dashboard");
  if (
    !hasAnyRole(actor, ["bpo_executive", "bpo_leader", "crm_manager"]) &&
    actor.roleKey !== "super_admin"
  ) {
    redirect("/dashboard");
  }

  const q = (await searchParams).q ?? "";
  const callers = await listCallerPerformance(actor, q);
  return <BpoBoard callers={callers} q={q} />;
}
