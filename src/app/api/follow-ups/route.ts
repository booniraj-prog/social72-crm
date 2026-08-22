import { NextRequest, NextResponse } from "next/server";
import { jsonError, requirePermission } from "@/lib/session";
import {
  FOLLOWUP_BUCKETS,
  countFollowupBuckets,
  listFollowupBucket,
  type FollowupBucket,
} from "@/modules/followups/service";

export async function GET(request: NextRequest) {
  try {
    const actor = await requirePermission("lead.read");
    const bucket = (request.nextUrl.searchParams.get("bucket") ?? "today") as FollowupBucket;
    if (!FOLLOWUP_BUCKETS.includes(bucket)) {
      return NextResponse.json(
        { error: { code: "VALIDATION", message: "Unknown follow-up bucket" } },
        { status: 400 },
      );
    }
    const [counts, items] = await Promise.all([
      countFollowupBuckets(actor),
      listFollowupBucket(actor, bucket),
    ]);
    return NextResponse.json({ bucket, counts, items });
  } catch (error) {
    return jsonError(error);
  }
}
