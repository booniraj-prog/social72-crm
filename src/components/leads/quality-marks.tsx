"use client";

import { issueBadge } from "@/lib/lead-quality";
import { scoreClass } from "@/lib/lead-score";
import type { LeadStatus } from "@/modules/leads/types";

export const QUALITY_MARKS = [
  { key: "DO_NOT_CALL", label: "Don't call" },
  { key: "WRONG_NUMBER", label: "Wrong number" },
  { key: "NOT_AVAILABLE", label: "Not available" },
  { key: "UNWANTED", label: "Unwanted" },
] as const;

export function ScoreMark({ value }: { value: number }) {
  const n = Number(value) || 0;
  return <span className={scoreClass(n)}>{n}</span>;
}

export function IssueBadge({ statusKey }: { statusKey: string }) {
  const badge = issueBadge(statusKey);
  if (!badge) return null;
  return (
    <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] ${badge.className}`}>
      {badge.label}
    </span>
  );
}

export function QualityMarks({
  statuses,
  currentKey,
  disabled,
  onPick,
}: {
  statuses: LeadStatus[];
  currentKey?: string;
  disabled?: boolean;
  onPick: (statusId: string) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] uppercase tracking-[0.14em] text-ink-soft">Number / list quality</p>
      <div className="flex flex-wrap gap-2">
        {QUALITY_MARKS.map((mark) => {
          const status = statuses.find((s) => s.key === mark.key);
          if (!status) return null;
          const active = currentKey === mark.key;
          return (
            <button
              key={mark.key}
              type="button"
              disabled={disabled}
              onClick={() => onPick(status.id)}
              className={`h-8 rounded-md border px-2 text-xs disabled:opacity-50 ${
                active ? "border-ink bg-ink text-white" : "border-line hover:bg-paper-2"
              }`}
            >
              {mark.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
