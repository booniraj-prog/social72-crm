import assert from "node:assert/strict";
import { test } from "node:test";
import { toCsv } from "./csv";

test("csv quotes commas and quotes", () => {
  const csv = toCsv([{ name: "A, B", city: 'Pune "West"' }]);
  assert.equal(csv, "name,city\n\"A, B\",\"Pune \"\"West\"\"\"");
});
