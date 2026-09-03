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
