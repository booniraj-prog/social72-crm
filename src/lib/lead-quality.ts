export const ISSUE_FILTERS = [
  { key: "working", label: "Callable" },
  { key: "dnc", label: "Don't call" },
  { key: "wrong", label: "Wrong number" },
  { key: "unavailable", label: "Not available" },
  { key: "unwanted", label: "Unwanted" },
  { key: "invalid", label: "Invalid" },
  { key: "duplicate", label: "Duplicates" },
] as const;

export type IssueFilter = (typeof ISSUE_FILTERS)[number]["key"];

export const ISSUE_STATUS_KEYS: Record<Exclude<IssueFilter, "working">, string[]> = {
  dnc: ["DO_NOT_CALL"],
  wrong: ["WRONG_NUMBER"],
  unavailable: ["NOT_AVAILABLE", "NO_RESPONSE"],
  unwanted: ["UNWANTED", "NOT_INTERESTED"],
  invalid: ["INVALID"],
  duplicate: ["DUPLICATE"],
};

export const ALL_ISSUE_STATUS_KEYS = Object.values(ISSUE_STATUS_KEYS).flat();

export const QUALITY_STATUSES = [
  {
    key: "WRONG_NUMBER",
    name: "Wrong number",
    color: "#b91c1c",
    isFinal: true,
    sortOrder: 191,
    description: "Number belongs to someone else or is incorrect",
  },
  {
    key: "NOT_AVAILABLE",
    name: "Not available",
    color: "#b45309",
    isFinal: false,
    sortOrder: 261,
    description: "Busy, switched off, or asked to try later",
  },
  {
    key: "UNWANTED",
    name: "Unwanted",
    color: "#7c2d12",
    isFinal: true,
    sortOrder: 201,
    description: "Do not pursue — junk, abusive, or out of market",
  },
] as const;

export function issueBadge(statusKey: string) {
  if (statusKey === "DO_NOT_CALL") return { label: "Don't call", className: "bg-[#7f1d1d] text-white" };
  if (statusKey === "WRONG_NUMBER") return { label: "Wrong number", className: "bg-[#b91c1c] text-white" };
  if (statusKey === "NOT_AVAILABLE" || statusKey === "NO_RESPONSE") {
    return { label: "Not available", className: "bg-[#f3e6d8] text-[#7c2d12]" };
  }
  if (statusKey === "UNWANTED") return { label: "Unwanted", className: "bg-[#7c2d12] text-white" };
  if (statusKey === "NOT_INTERESTED") return { label: "Not interested", className: "bg-[#f3e6d8] text-[#7c2d12]" };
  if (statusKey === "INVALID") return { label: "Invalid", className: "bg-[#57534d] text-white" };
  if (statusKey === "DUPLICATE") return { label: "Duplicate", className: "bg-[#44403c] text-white" };
  return null;
}
