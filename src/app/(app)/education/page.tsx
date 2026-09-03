import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/rbac";
import { getAuthUser } from "@/lib/session";
import { listEducationBoard } from "@/modules/education/service";
import { EducationBoard } from "./education-board";

export default async function EducationPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; statusKey?: string; visit?: string }>;
}) {
  const actor = await getAuthUser();
  if (!actor || !hasPermission(actor, "lead.read")) redirect("/dashboard");

  const { q = "", statusKey = "", visit = "" } = await searchParams;
  const board = await listEducationBoard(actor, { q, statusKey, visit });

  return (
    <EducationBoard
      pipeline={board.pipeline}
      kpis={board.kpis}
      items={board.items as never}
      filters={{ q, statusKey, visit }}
    />
  );
}
