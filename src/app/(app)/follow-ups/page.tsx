import { redirect } from "next/navigation";
import { hasAnyRole, hasPermission } from "@/lib/rbac";
import { getAuthUser } from "@/lib/session";
import {
  FOLLOWUP_BUCKETS,
  countFollowupBuckets,
  listFollowupBucket,
  type FollowupBucket,
} from "@/modules/followups/service";
import { FollowUpsBoard } from "./follow-ups-board";

export default async function FollowUpsPage({
  searchParams,
}: {
  searchParams: Promise<{ bucket?: string }>;
}) {
  const actor = await getAuthUser();
  if (!actor || !hasPermission(actor, "lead.read")) redirect("/dashboard");
  if (
    !hasAnyRole(actor, ["bpo_executive", "bpo_leader", "crm_manager"]) &&
    actor.roleKey !== "super_admin"
  ) {
    redirect("/leads");
  }

  const raw = (await searchParams).bucket ?? "today";
  const bucket = (FOLLOWUP_BUCKETS.includes(raw as FollowupBucket) ? raw : "today") as FollowupBucket;
  const [counts, items] = await Promise.all([
    countFollowupBuckets(actor),
    listFollowupBucket(actor, bucket),
  ]);

  return <FollowUpsBoard bucket={bucket} counts={counts} items={items as never} />;
}
