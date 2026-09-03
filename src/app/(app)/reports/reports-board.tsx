export function ReportsBoard({
  type,
  types,
  summary,
  rows,
  canExport,
  filters,
  clients,
  campaigns,
}: {
  type: string;
  types: Array<{ key: string; label: string }>;
  summary: string;
  rows: Array<Record<string, unknown>>;
  canExport: boolean;
  filters: { from: string; to: string; clientId: string; campaignId: string };
  clients: Array<{ id: string; name: string }>;
  campaigns: Array<{ id: string; name: string }>;
}) {
  const columns = rows[0] ? Object.keys(rows[0]) : [];
  const query = new URLSearchParams({
    type,
    ...(filters.from ? { from: filters.from } : {}),
    ...(filters.to ? { to: filters.to } : {}),
    ...(filters.clientId ? { clientId: filters.clientId } : {}),
    ...(filters.campaignId ? { campaignId: filters.campaignId } : {}),
  }).toString();

  return (
    <div>
      <p className="text-xs uppercase tracking-[0.18em] text-ink-soft">Performance</p>
      <h1 className="mt-2 font-display text-4xl text-ink">Reports</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-soft">{summary}</p>

      <form className="mt-6 flex flex-wrap gap-2" action="/reports">
        <select name="type" defaultValue={type} className="h-10 rounded-md border border-line bg-white px-3 text-sm">
          {types.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
        <input type="date" name="from" defaultValue={filters.from} className="h-10 rounded-md border border-line bg-white px-3 text-sm" />
        <input type="date" name="to" defaultValue={filters.to} className="h-10 rounded-md border border-line bg-white px-3 text-sm" />
        <select name="clientId" defaultValue={filters.clientId} className="h-10 rounded-md border border-line bg-white px-3 text-sm">
          <option value="">All clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select name="campaignId" defaultValue={filters.campaignId} className="h-10 rounded-md border border-line bg-white px-3 text-sm">
          <option value="">All campaigns</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button type="submit" className="h-10 rounded-md bg-ink px-4 text-sm text-white">
          Run
        </button>
        {canExport ? (
          <a
            href={`/api/reports/export?${query}`}
            className="inline-flex h-10 items-center rounded-md border border-line bg-white px-4 text-sm"
          >
            Download CSV
          </a>
        ) : null}
      </form>

      <div className="mt-6 overflow-x-auto rounded-lg border border-line bg-white">
        {rows.length === 0 ? (
          <p className="p-6 text-sm text-ink-soft">No rows for this report and filter.</p>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
                {columns.map((col) => (
                  <th key={col} className="px-3 py-2 font-medium">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 200).map((row, i) => (
                <tr key={i} className="border-b border-line last:border-0">
                  {columns.map((col) => (
                    <td key={col} className="px-3 py-2 whitespace-nowrap">
                      {row[col] == null ? "" : String(row[col])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
