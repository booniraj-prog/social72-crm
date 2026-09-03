import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/rbac";
import { getAuthUser } from "@/lib/session";
import { listClients } from "@/modules/clients/service";
import { listRealEstateBoard } from "@/modules/real-estate/service";
import { RealEstateBoard } from "./real-estate-board";

export default async function RealEstatePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; statusKey?: string; visit?: string }>;
}) {
  const actor = await getAuthUser();
  if (!actor || !hasPermission(actor, "lead.read")) redirect("/dashboard");

  const { q = "", statusKey = "", visit = "" } = await searchParams;
  const [board, clients] = await Promise.all([
    listRealEstateBoard(actor, { q, statusKey, visit }),
    hasPermission(actor, "client.read") ? listClients() : Promise.resolve([]),
  ]);

  return (
    <RealEstateBoard
      pipeline={board.pipeline}
      kpis={board.kpis}
      items={board.items as never}
      inventory={board.inventory}
      filters={{ q, statusKey, visit }}
      canManageInventory={hasPermission(actor, "campaign.write")}
      clients={clients.map((c) => ({ id: c.id, name: c.name }))}
    />
  );
}
