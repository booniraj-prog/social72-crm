import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { leadgenEvents, parseMetaLeadFields, verifyMetaSignature } from "./meta-ingest";

test("parseMetaLeadFields maps Instant Form keys", () => {
  const parsed = parseMetaLeadFields([
    { name: "full_name", values: ["Arjun Patel"] },
    { name: "phone_number", values: ["9876543210"] },
    { name: "email", values: ["arjun@example.com"] },
    { name: "city", values: ["Ahmedabad"] },
  ]);
  assert.equal(parsed.fullName, "Arjun Patel");
  assert.equal(parsed.firstName, "Arjun");
  assert.equal(parsed.lastName, "Patel");
  assert.equal(parsed.mobile, "9876543210");
  assert.equal(parsed.email, "arjun@example.com");
  assert.equal(parsed.city, "Ahmedabad");
});

test("verifyMetaSignature accepts HMAC SHA256", () => {
  const body = '{"object":"page"}';
  const secret = "test-secret";
  const hex = createHmac("sha256", secret).update(body, "utf8").digest("hex");
  assert.equal(verifyMetaSignature(body, `sha256=${hex}`, secret), true);
  assert.equal(verifyMetaSignature(body, "sha256=deadbeef", secret), false);
});

test("leadgenEvents reads page changes only", () => {
  const events = leadgenEvents({
    object: "page",
    entry: [
      {
        changes: [
          { field: "leadgen", value: { leadgen_id: "1", form_id: "9" } },
          { field: "feed", value: { post_id: "x" } },
        ],
      },
    ],
  });
  assert.equal(events.length, 1);
  assert.equal(events[0].leadgen_id, "1");
});
