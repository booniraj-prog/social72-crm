import { NextRequest, NextResponse } from "next/server";
import { jsonError, requirePermission } from "@/lib/session";
import { REPORT_TYPES, reportCsv, type ReportKey } from "@/modules/reports/service";
import { writeAudit } from "@/lib/audit";

export async function GET(request: NextRequest) {
  try {
    const actor = await requirePermission("report.export");
    const typeParam = request.nextUrl.searchParams.get("type") ?? "leads";
    const type = (REPORT_TYPES.some((t) => t.key === typeParam) ? typeParam : "leads") as ReportKey;
    const filters = {
      from: request.nextUrl.searchParams.get("from") ?? undefined,
      to: request.nextUrl.searchParams.get("to") ?? undefined,
      clientId: request.nextUrl.searchParams.get("clientId") ?? undefined,
      campaignId: request.nextUrl.searchParams.get("campaignId") ?? undefined,
    };
    const csv = await reportCsv(actor, type, filters);
    await writeAudit({
      userId: actor.id,
      action: "report.exported",
      entityType: "report",
      entityId: type,
      newValue: filters,
    });
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="social72-${type}.csv"`,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
