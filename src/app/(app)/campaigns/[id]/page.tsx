import { notFound, redirect } from "next/navigation";
import { hasPermission } from "@/lib/rbac";
import { getAuthUser, HttpError } from "@/lib/session";
import { getCampaign } from "@/modules/campaigns/service";
import { CampaignWorkspace } from "./campaign-workspace";

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await getAuthUser();
  if (!actor || !hasPermission(actor, "campaign.read")) redirect("/dashboard");
  try {
    const { id } = await params;
    const detail = await getCampaign(actor, id);
    return (
      <CampaignWorkspace
        detail={detail as never}
        canWrite={hasPermission(actor, "campaign.write")}
      />
    );
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) notFound();
    throw error;
  }
}
