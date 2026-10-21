import { createHmac, timingSafeEqual } from "node:crypto";

export type MetaFormField = { name?: string; values?: unknown[] };

export type ParsedMetaLead = {
  firstName: string;
  lastName: string;
  fullName: string;
  mobile: string;
  email: string;
  city: string;
  state: string;
  pincode: string;
};

const PHONE_KEYS = ["phone_number", "phone", "mobile_number", "mobile", "work_phone_number"];
const EMAIL_KEYS = ["email", "email_address"];
const NAME_KEYS = ["full_name", "full name", "name"];
const FIRST_KEYS = ["first_name", "firstname"];
const LAST_KEYS = ["last_name", "lastname"];
const CITY_KEYS = ["city"];
const STATE_KEYS = ["state", "province"];
const ZIP_KEYS = ["zip", "zip_code", "post_code", "pincode", "postal_code"];

function normKey(name: string) {
  return name.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function pick(map: Map<string, string>, keys: string[]) {
  for (const key of keys) {
    const value = map.get(key);
    if (value) return value;
  }
  return "";
}

export function fieldMap(fields: MetaFormField[]) {
  const map = new Map<string, string>();
  for (const field of fields) {
    const key = normKey(String(field.name ?? ""));
    const raw = Array.isArray(field.values) ? field.values[0] : undefined;
    const value = raw == null ? "" : String(raw).trim();
    if (key && value) map.set(key, value);
  }
  return map;
}

export function parseMetaLeadFields(fields: MetaFormField[]): ParsedMetaLead {
  const map = fieldMap(fields);
  const fullFromForm = pick(map, NAME_KEYS);
  const firstName = pick(map, FIRST_KEYS);
  const lastName = pick(map, LAST_KEYS);
  let fullName = fullFromForm;
  if (!fullName) fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  const parts = fullName.split(/\s+/).filter(Boolean);
  return {
    firstName: firstName || parts[0] || "",
    lastName: lastName || (parts.length > 1 ? parts.slice(1).join(" ") : ""),
    fullName: fullName || "Meta lead",
    mobile: pick(map, PHONE_KEYS),
    email: pick(map, EMAIL_KEYS),
    city: pick(map, CITY_KEYS),
    state: pick(map, STATE_KEYS),
    pincode: pick(map, ZIP_KEYS),
  };
}

export function verifyMetaSignature(rawBody: string, header: string | null, appSecret: string) {
  if (!appSecret) return process.env.NODE_ENV !== "production";
  if (!header?.startsWith("sha256=")) return false;
  const expectedHex = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const givenHex = header.slice("sha256=".length).trim();
  try {
    const expected = Buffer.from(expectedHex, "hex");
    const given = Buffer.from(givenHex, "hex");
    if (expected.length !== given.length || expected.length === 0) return false;
    return timingSafeEqual(expected, given);
  } catch {
    return false;
  }
}

export type LeadgenValue = {
  leadgen_id?: string;
  page_id?: string;
  form_id?: string;
  adgroup_id?: string;
  ad_id?: string;
  created_time?: number;
};

export function leadgenEvents(payload: unknown): LeadgenValue[] {
  if (!payload || typeof payload !== "object") return [];
  const body = payload as { object?: string; entry?: unknown[] };
  if (body.object && body.object !== "page") return [];
  const out: LeadgenValue[] = [];
  for (const entry of body.entry ?? []) {
    if (!entry || typeof entry !== "object") continue;
    const changes = (entry as { changes?: unknown[] }).changes ?? [];
    for (const change of changes) {
      if (!change || typeof change !== "object") continue;
      const row = change as { field?: string; value?: LeadgenValue };
      if (row.field !== "leadgen" || !row.value) continue;
      out.push(row.value);
    }
  }
  return out;
}

export async function fetchGraphLead(
  leadgenId: string,
  accessToken: string,
  graphVersion = "v21.0",
) {
  const url = `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(leadgenId)}?access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Meta Graph ${res.status} ${text.slice(0, 180)}`);
  }
  return (await res.json()) as { id?: string; field_data?: MetaFormField[]; created_time?: string };
}
