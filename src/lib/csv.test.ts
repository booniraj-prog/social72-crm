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

test("csvToLeadRows uses an explicit column map", () => {
  const rows = csvToLeadRows(
    "Customer,WhatsApp No,Town,Job\nNeha,9988776655,Nashik,Doctor",
    { fullName: "Customer", mobile: "WhatsApp No", city: "Town", occupation: "Job" },
  );
  assert.equal(rows[0].fullName, "Neha");
  assert.equal(rows[0].mobile, "9988776655");
  assert.equal(rows[0].city, "Nashik");
  assert.equal(rows[0].occupation, "Doctor");
});
