export function toCsv(rows: Array<Record<string, string | number | null | undefined>>) {
  if (rows.length === 0) return "empty\n";
  const keys = Object.keys(rows[0]);
  const escape = (value: string | number | null | undefined) => {
    const text = value == null ? "" : String(value);
    if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
    return text;
  };
  return [keys.join(","), ...rows.map((row) => keys.map((key) => escape(row[key])).join(","))].join("\n");
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') {
      quoted = true;
      continue;
    }
    if (ch === ",") {
      row.push(cell.trim());
      cell = "";
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += ch;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

export type CsvLeadRow = {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  mobile?: string;
  alternateMobile?: string;
  email?: string;
  city?: string;
  state?: string;
  pincode?: string;
  gender?: string;
  occupation?: string;
  sourcePlatform?: string;
  nextAction?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  adId?: string;
  adSet?: string;
  captureChannel?: string;
  serviceLine?: string;
};

export const LEAD_IMPORT_FIELDS = [
  { key: "fullName", label: "Full name", aliases: ["name", "fullname", "contact", "contactname", "lead", "customer", "customername"] },
  { key: "firstName", label: "First name", aliases: ["firstname", "first", "givenname"] },
  { key: "lastName", label: "Last name", aliases: ["lastname", "last", "surname", "familyname"] },
  { key: "mobile", label: "Mobile", aliases: ["mobile", "phone", "phonenumber", "mobilee164", "whatsapp", "contactno", "contactnumber", "mobileno", "cell"] },
  { key: "alternateMobile", label: "Alternate mobile", aliases: ["alternate", "alternatemobile", "altmobile", "secondaryphone", "phone2"] },
  { key: "email", label: "Email", aliases: ["email", "mail", "emailid", "emailaddress"] },
  { key: "city", label: "City", aliases: ["city", "location", "town"] },
  { key: "state", label: "State", aliases: ["state", "region", "province"] },
  { key: "pincode", label: "Pincode", aliases: ["pincode", "pin", "zip", "zipcode", "postalcode"] },
  { key: "gender", label: "Gender", aliases: ["gender", "sex"] },
  { key: "occupation", label: "Occupation", aliases: ["occupation", "job", "profession", "designation"] },
  { key: "sourcePlatform", label: "Source platform", aliases: ["source", "platform", "leadsource", "channel"] },
  { key: "nextAction", label: "Next action", aliases: ["nextaction", "action", "remarks", "comment", "notes", "note"] },
  { key: "utmSource", label: "UTM source", aliases: ["utmsource"] },
  { key: "utmMedium", label: "UTM medium", aliases: ["utmmedium"] },
  { key: "utmCampaign", label: "UTM campaign", aliases: ["utmcampaign"] },
  { key: "adId", label: "Ad ID", aliases: ["adid", "ad"] },
  { key: "adSet", label: "Ad set", aliases: ["adset", "adsetid"] },
  { key: "captureChannel", label: "Capture channel", aliases: ["capturechannel", "form"] },
  { key: "serviceLine", label: "Service line", aliases: ["serviceline", "service", "product", "course", "project"] },
] as const;

export type LeadImportField = (typeof LEAD_IMPORT_FIELDS)[number]["key"];
export type LeadColumnMap = Partial<Record<LeadImportField, string>>;

function headerKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function csvLeadTable(text: string): { headers: string[]; rows: string[][] } {
  const table = parseCsv(text);
  if (table.length === 0) return { headers: [], rows: [] };
  const first = table[0];
  const keyed = first.map(headerKey);
  const looksLikeHeader = keyed.some((cell) =>
    LEAD_IMPORT_FIELDS.some((field) => (field.aliases as readonly string[]).includes(cell)),
  );
  if (looksLikeHeader) {
    return { headers: first.map((cell, i) => cell || `Column ${i + 1}`), rows: table.slice(1) };
  }
  return {
    headers: first.map((_, i) => `Column ${i + 1}`),
    rows: table,
  };
}

export function guessLeadColumnMap(headers: string[]): LeadColumnMap {
  const map: LeadColumnMap = {};
  const used = new Set<number>();
  for (const field of LEAD_IMPORT_FIELDS) {
    const found = headers.findIndex((header, i) => !used.has(i) && (field.aliases as readonly string[]).includes(headerKey(header)));
    if (found >= 0) {
      map[field.key] = headers[found];
      used.add(found);
    }
  }
  return map;
}

export function applyLeadColumnMap(headers: string[], rows: string[][], map: LeadColumnMap): CsvLeadRow[] {
  const indexFor = (field: LeadImportField) => {
    const header = map[field];
    if (!header) return -1;
    return headers.findIndex((item) => item === header || headerKey(item) === headerKey(header));
  };
  return rows.map((cols) => {
    const row: CsvLeadRow = {};
    for (const field of LEAD_IMPORT_FIELDS) {
      const idx = indexFor(field.key);
      const value = idx >= 0 ? cols[idx]?.trim() : "";
      if (value) row[field.key] = value;
    }
    return row;
  });
}

export function csvToLeadRows(text: string, map?: LeadColumnMap): CsvLeadRow[] {
  const { headers, rows } = csvLeadTable(text);
  if (headers.length === 0) return [];
  const guessed = map ?? guessLeadColumnMap(headers);
  const resolved =
    Object.keys(guessed).length > 0
      ? guessed
      : {
          fullName: headers[0],
          mobile: headers[1],
          email: headers[2],
          city: headers[3],
        };
  return applyLeadColumnMap(headers, rows, resolved);
}
