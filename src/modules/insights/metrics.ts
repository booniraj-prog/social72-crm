import { pct, round2, safeDiv } from "@/lib/money";

export function metricsFromCounts(input: {
  leads: number;
  valid: number;
  qualified: number;
  hot: number;
  contacted: number;
  connected: number;
  visits: number;
  won: number;
  lost: number;
  revenue: number;
  spend: number;
  expectedRevenue: number;
  newCount?: number;
  assigned?: number;
  campusVisits?: number;
  siteVisits?: number;
}) {
  return {
    ...input,
    newCount: input.newCount ?? 0,
    assigned: input.assigned ?? 0,
    cpl: round2(safeDiv(input.spend, input.leads)),
    cpql: round2(safeDiv(input.spend, input.qualified)),
    costPerVisit: round2(safeDiv(input.spend, input.visits)),
    cpa: round2(safeDiv(input.spend, input.won)),
    conversionRate: pct(input.won, input.leads),
    roi: round2(safeDiv(input.revenue - input.spend, input.spend) * 100),
    roas: round2(safeDiv(input.revenue, input.spend)),
  };
}
