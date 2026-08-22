import { NextResponse } from "next/server";
import { jsonError, requirePermission } from "@/lib/session";
import { listAssignees, listLeadSources, listLeadStatuses } from "@/modules/leads/service";
import { listDispositions } from "@/modules/calling/service";

export async function GET() {
  try {
    await requirePermission("lead.read");
    const [statuses, sources, assignees, dispositions] = await Promise.all([
      listLeadStatuses(),
      listLeadSources(),
      listAssignees(),
      listDispositions(),
    ]);
    return NextResponse.json({
      statuses,
      sources,
      assignees,
      dispositions,
      temperatures: ["HOT", "WARM", "COLD", "UNQUALIFIED"],
    });
  } catch (error) {
    return jsonError(error);
  }
}
