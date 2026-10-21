import assert from "node:assert/strict";
import { test } from "node:test";
import { csvToLeadRows, parseCsv, toCsv } from "./csv";

test("csv quotes commas and quotes", () => {
  const csv = toCsv([{ name: "A, B", city: 'Pune "West"' }]);
  assert.equal(csv, "name,city\n\"A, B\",\"Pune \"\"West\"\"\"");
});

test("parseCsv respects quoted commas", () => {
  const rows = parseCsv('fullName,city\n"Shah, Priya",Pune');
  assert.deepEqual(rows[1], ["Shah, Priya", "Pune"]);
});

test("csvToLeadRows maps name and mobile headers", () => {
  const rows = csvToLeadRows("Name,Phone,Email,City\nAmit,9876543210,a@x.com,Pune");
  assert.equal(rows[0].fullName, "Amit");
  assert.equal(rows[0].mobile, "9876543210");
  assert.equal(rows[0].city, "Pune");
});
