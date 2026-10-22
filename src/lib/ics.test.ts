import assert from "node:assert/strict";
import { test } from "node:test";
import { buildFollowupIcs, icsEscape, toIcsUtc } from "./ics";

test("toIcsUtc formats UTC compactly", () => {
  assert.equal(toIcsUtc(new Date("2026-10-21T12:30:00.000Z")), "20261021T123000Z");
});

test("icsEscape encodes commas and new lines", () => {
  assert.equal(icsEscape("Hi, there\nNext"), "Hi\\, there\\nNext");
});

test("buildFollowupIcs includes start, meet URL and duration", () => {
  const ics = buildFollowupIcs({
    id: "fu-1",
    title: "Google Meet · Priya Shah",
    description: "Follow-up",
    location: "https://meet.google.com/new",
    url: "https://meet.google.com/new",
    start: new Date("2026-10-22T04:00:00.000Z"),
    durationMin: 45,
    stamp: new Date("2026-10-21T04:00:00.000Z"),
  });
  assert.match(ics, /BEGIN:VCALENDAR/);
  assert.match(ics, /DTSTART:20261022T040000Z/);
  assert.match(ics, /DTEND:20261022T044500Z/);
  assert.match(ics, /meet\.google\.com\/new/);
  assert.match(ics, /UID:fu-1@social72\.crm/);
});
