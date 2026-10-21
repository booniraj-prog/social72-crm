"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { ActionIcon } from "@/components/ui/action-icon";

function parseSortValue(value: unknown) {
  if (value == null) return "";
  if (typeof value === "number") return value;
  const raw = String(value).trim();
  const numeric = Number(raw.replace(/[₹,%()\s]/g, "").replace(/,/g, ""));
  if (raw !== "" && Number.isFinite(numeric) && /[\d₹]/.test(raw) && !/[a-zA-Z]/.test(raw.replace(/[₹,%()\s,.\-]/g, ""))) {
    return numeric;
  }
  return raw.toLowerCase();
}

export function useTableQuery<T extends Record<string, unknown>>(rows: T[], columns: string[]) {
  const [query, setQuery] = useState("");
  const [filterKey, setFilterKey] = useState(columns.find((c) => /status|client|type|kind|role/i.test(c)) ?? columns[0] ?? "");
  const [filterValue, setFilterValue] = useState("");
  const [sortKey, setSortKey] = useState(columns[0] ?? "");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const options = useMemo(() => {
    const values = new Set<string>();
    for (const row of rows) {
      const value = row[filterKey];
      if (value != null && String(value) !== "") values.add(String(value));
    }
    return [...values].sort((a, b) => a.localeCompare(b)).slice(0, 80);
  }, [rows, filterKey]);

  const view = useMemo(() => {
    const q = query.trim().toLowerCase();
    const next = rows.filter((row) => {
      if (filterValue && String(row[filterKey] ?? "") !== filterValue) return false;
      if (!q) return true;
      return columns.some((column) => String(row[column] ?? "").toLowerCase().includes(q));
    });
    next.sort((a, b) => {
      const av = parseSortValue(a[sortKey]);
      const bv = parseSortValue(b[sortKey]);
      let cmp = 0;
      if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
      else cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
    return next;
  }, [rows, columns, query, filterKey, filterValue, sortKey, sortDir]);

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  return {
    query,
    setQuery,
    filterKey,
    setFilterKey,
    filterValue,
    setFilterValue,
    sortKey,
    sortDir,
    toggleSort,
    setSortKey,
    setSortDir,
    options,
    view,
  };
}

export function TableToolbar({
  columns,
  query,
  setQuery,
  filterKey,
  setFilterKey,
  filterValue,
  setFilterValue,
  sortKey,
  setSortKey,
  sortDir,
  setSortDir,
  options,
}: {
  columns: string[];
  query: string;
  setQuery: (v: string) => void;
  filterKey: string;
  setFilterKey: (v: string) => void;
  filterValue: string;
  setFilterValue: (v: string) => void;
  sortKey: string;
  setSortKey: (v: string) => void;
  sortDir: "asc" | "desc";
  setSortDir: (v: "asc" | "desc") => void;
  options: string[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
      <div className="relative min-w-[160px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" strokeWidth={1.9} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search table"
          className="h-9 w-full rounded-md border border-line bg-white pl-9 pr-3 text-sm"
        />
      </div>
      <select
        value={filterKey}
        onChange={(e) => {
          setFilterKey(e.target.value);
          setFilterValue("");
        }}
        className="h-9 rounded-md border border-line bg-white px-2 text-sm"
      >
        {columns.map((column) => (
          <option key={column} value={column}>
            Filter: {column}
          </option>
        ))}
      </select>
      <select value={filterValue} onChange={(e) => setFilterValue(e.target.value)} className="h-9 max-w-[180px] rounded-md border border-line bg-white px-2 text-sm">
        <option value="">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <select value={sortKey} onChange={(e) => setSortKey(e.target.value)} className="h-9 rounded-md border border-line bg-white px-2 text-sm">
        {columns.map((column) => (
          <option key={column} value={column}>
            Sort: {column}
          </option>
        ))}
      </select>
      <ActionIcon
        action="sort"
        label={sortDir === "asc" ? "Sort A to Z" : "Sort Z to A"}
        onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")}
      />
    </div>
  );
}

export function SortHeader({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <th className="px-3 py-2">
      <button type="button" onClick={onClick} className={`uppercase tracking-wide ${active ? "text-ink" : "text-ink-soft"}`}>
        {label}
        {active ? (dir === "asc" ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );
}

export function HistoryTip({ history, children }: { history?: string | null; children: ReactNode }) {
  if (!history) return <>{children}</>;
  return (
    <span className="group relative inline-flex">
      {children}
      <span className="pointer-events-none invisible absolute left-0 top-full z-30 mt-1 w-72 whitespace-pre-wrap rounded-md bg-ink px-3 py-2 text-left text-xs leading-5 text-white shadow-lg group-hover:visible">
        {history}
      </span>
    </span>
  );
}

export function TableFrame<T extends Record<string, unknown>>({
  rows,
  columns,
  labels,
  empty,
  extraHeaders,
  extraColSpan = 0,
  renderRow,
  rowKey,
  rowClassName,
  showToolbar = true,
}: {
  rows: T[];
  columns: string[];
  labels?: Record<string, string>;
  empty: string;
  extraHeaders?: ReactNode;
  extraColSpan?: number;
  renderRow: (row: T) => ReactNode;
  rowKey?: (row: T, i: number) => string;
  rowClassName?: (row: T) => string;
  showToolbar?: boolean;
}) {
  const table = useTableQuery(rows, columns);
  const span = columns.length + extraColSpan;
  if (rows.length === 0) {
    return <p className="p-6 text-sm text-ink-soft">{empty}</p>;
  }
  return (
    <>
      {showToolbar ? (
        <TableToolbar
          columns={columns}
          query={table.query}
          setQuery={table.setQuery}
          filterKey={table.filterKey}
          setFilterKey={table.setFilterKey}
          filterValue={table.filterValue}
          setFilterValue={table.setFilterValue}
          sortKey={table.sortKey}
          setSortKey={table.setSortKey}
          sortDir={table.sortDir}
          setSortDir={table.setSortDir}
          options={table.options}
        />
      ) : null}
      <table className="min-w-full w-full text-left text-sm">
        <thead className="bg-paper-2 text-xs uppercase tracking-[0.12em] text-ink-soft">
          <tr>
            {columns.map((column) => (
              <SortHeader
                key={column}
                label={labels?.[column] ?? column}
                active={table.sortKey === column}
                dir={table.sortDir}
                onClick={() => table.toggleSort(column)}
              />
            ))}
            {extraHeaders}
          </tr>
        </thead>
        <tbody>
          {table.view.length === 0 ? (
            <tr>
              <td className="px-4 py-8 text-ink-soft" colSpan={span}>
                No rows match this search or filter.
              </td>
            </tr>
          ) : (
            table.view.map((row, i) => (
              <tr
                key={rowKey ? rowKey(row, i) : String(row.id ?? i)}
                className={rowClassName?.(row) ?? "border-t border-line"}
              >
                {renderRow(row)}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </>
  );
}
