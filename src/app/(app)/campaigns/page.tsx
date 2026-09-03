import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/rbac";
import { getAuthUser } from "@/lib/session";
import { listClients } from "@/modules/clients/service";
import { listCampaignBoard } from "@/modules/campaigns/service";
import { CampaignsBoard } from "./campaigns-board";

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; clientId?: string }>;
}) {
  const actor = await getAuthUser();
  if (!actor || !hasPermission(actor, "campaign.read")) redirect("/dashboard");

  const { q = "", clientId = "" } = await searchParams;
  const [board, clients] = await Promise.all([
    listCampaignBoard(actor, { q, clientId }),
    hasPermission(actor, "client.read") ? listClients() : Promise.resolve([]),
  ]);

  return (
    <CampaignsBoard
      campaigns={board.campaigns}
      totals={board.totals}
      platforms={board.platforms}
      types={board.types}
      canWrite={hasPermission(actor, "campaign.write")}
      filters={{ q, clientId }}
      clients={clients.map((c) => ({ id: c.id, name: c.name }))}
    />
  );
}
