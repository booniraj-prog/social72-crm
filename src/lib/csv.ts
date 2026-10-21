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
  email?: string;
  city?: string;
};

function headerKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

const NAME_KEYS = new Set(["name", "fullname", "contact", "contactname", "lead"]);
const FIRST_KEYS = new Set(["firstname", "first"]);
const LAST_KEYS = new Set(["lastname", "last", "surname"]);
const MOBILE_KEYS = new Set(["mobile", "phone", "phonenumber", "mobilee164", "whatsapp", "contactno", "contactnumber"]);
const EMAIL_KEYS = new Set(["email", "mail", "emailid"]);
const CITY_KEYS = new Set(["city", "location", "town"]);

export function csvToLeadRows(text: string): CsvLeadRow[] {
  const table = parseCsv(text);
  if (table.length === 0) return [];
  const first = table[0].map(headerKey);
  const looksLikeHeader = first.some((cell) => NAME_KEYS.has(cell) || MOBILE_KEYS.has(cell) || EMAIL_KEYS.has(cell));
  const header = looksLikeHeader ? first : [];
  const body = looksLikeHeader ? table.slice(1) : table;
  const index = (keys: Set<string>, fallback: number) => {
    const found = header.findIndex((cell) => keys.has(cell));
    return found >= 0 ? found : fallback;
  };
  const nameIdx = index(NAME_KEYS, 0);
  const firstIdx = index(FIRST_KEYS, -1);
  const lastIdx = index(LAST_KEYS, -1);
  const mobileIdx = index(MOBILE_KEYS, looksLikeHeader ? 1 : 1);
  const emailIdx = index(EMAIL_KEYS, looksLikeHeader ? 2 : 2);
  const cityIdx = index(CITY_KEYS, looksLikeHeader ? 3 : 3);
  return body.map((cols) => ({
    fullName: cols[nameIdx] || undefined,
    firstName: firstIdx >= 0 ? cols[firstIdx] || undefined : undefined,
    lastName: lastIdx >= 0 ? cols[lastIdx] || undefined : undefined,
    mobile: cols[mobileIdx] || undefined,
    email: cols[emailIdx] || undefined,
    city: cols[cityIdx] || undefined,
  }));
}
