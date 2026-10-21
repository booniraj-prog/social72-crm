import { redirect } from "next/navigation";
import { canDeleteRecords } from "@/lib/rbac";
import { canApprove } from "@/lib/approvals";
import { getAuthUser } from "@/lib/session";
import { listTrashItems } from "@/lib/trash";
import { TrashBoard } from "./trash-board";

export default async function TrashPage() {
  const actor = await getAuthUser();
  if (!actor) redirect("/login");
  if (!canDeleteRecords(actor) && !(await canApprove(actor, "people")) && actor.roleKey !== "super_admin") redirect("/today");
  const items = await listTrashItems();
  const now = Date.now();
  return (
    <TrashBoard
      items={items.map((item) => ({
        id: item.id,
        entityType: item.entityType,
        title: item.title,
        summary: item.summary,
        deletedAt: item.deletedAt.toISOString(),
        purgeAt: item.purgeAt.toISOString(),
        daysLeft: Math.max(0, Math.ceil((item.purgeAt.getTime() - now) / 86400000)),
      }))}
    />
  );
}
