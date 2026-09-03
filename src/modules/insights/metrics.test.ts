import assert from "node:assert/strict";
import { test } from "node:test";
import { metricsFromCounts } from "./metrics";

test("CPL, CPA, ROI, conversion from counts", () => {
  const kpis = metricsFromCounts({
    leads: 10,
    valid: 9,
    qualified: 4,
    hot: 2,
    contacted: 8,
    connected: 6,
    visits: 2,
    won: 1,
    lost: 1,
    revenue: 200000,
    spend: 40000,
    expectedRevenue: 500000,
  });
  assert.equal(kpis.cpl, 4000);
  assert.equal(kpis.cpql, 10000);
  assert.equal(kpis.costPerVisit, 20000);
  assert.equal(kpis.cpa, 40000);
  assert.equal(kpis.conversionRate, 10);
  assert.equal(kpis.roi, 400);
  assert.equal(kpis.roas, 5);
});

test("zero spend does not explode ROI", () => {
  const kpis = metricsFromCounts({
    leads: 5,
    valid: 5,
    qualified: 1,
    hot: 0,
    contacted: 2,
    connected: 1,
    visits: 0,
    won: 0,
    lost: 0,
    revenue: 0,
    spend: 0,
    expectedRevenue: 0,
  });
  assert.equal(kpis.cpl, 0);
  assert.equal(kpis.roi, 0);
});
