import assert from "node:assert/strict";
import { test } from "node:test";
import { formatInr, pct, round2, safeDiv } from "./money";

test("safeDiv returns 0 for empty denominator", () => {
  assert.equal(safeDiv(100, 0), 0);
  assert.equal(safeDiv(50, 2), 25);
});

test("pct is one decimal percent", () => {
  assert.equal(pct(1, 3), 33.3);
  assert.equal(pct(0, 10), 0);
});

test("round2", () => {
  assert.equal(round2(1.226), 1.23);
});

test("formatInr uses Indian grouping", () => {
  assert.equal(formatInr(280000), "2,80,000");
  assert.equal(formatInr(4590), "4,590");
});
