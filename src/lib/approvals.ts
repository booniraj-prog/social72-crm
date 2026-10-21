import { prisma } from "@/lib/db";
import { ROLE_DESK, ROLE_KEYS, type AuthUser, type RoleKey } from "@/lib/rbac";

export const APPROVAL_KINDS = ["people", "project", "proposal", "invoice"] as const;
export type ApprovalKind = (typeof APPROVAL_KINDS)[number];

export const APPROVAL_KIND_META: Record<ApprovalKind, { label: string; hint: string }> = {
  people: { label: "New employees", hint: "Login stays off until someone on this list approves." },
  project: { label: "New projects", hint: "New jobs wait in the project queue until approved." },
  proposal: { label: "Proposals", hint: "Quotes stay draft until approved." },
  invoice: { label: "Invoices", hint: "Tax invoices stay draft until approved." },
};

export const DEFAULT_APPROVAL_ROLES: Record<ApprovalKind, RoleKey[]> = {
  people: ["hr_admin", "crm_manager"],
  project: ["project_manager", "crm_manager"],
  proposal: ["accounts", "crm_manager"],
  invoice: ["accounts", "crm_manager"],
};

export const ASSIGNABLE_APPROVER_ROLES: RoleKey[] = ROLE_KEYS.filter((key) => key !== "client" && key !== "super_admin");

const SETTING_KEY = "approval_authorities";

let cache: { at: number; value: Record<ApprovalKind, RoleKey[]> } | null = null;

function asRoleList(value: unknown, fallback: RoleKey[]): RoleKey[] {
  if (!Array.isArray(value)) return fallback;
  const allowed = new Set<string>(ROLE_KEYS);
  const next = value.filter((key): key is RoleKey => typeof key === "string" && allowed.has(key) && key !== "client");
  return next.length ? [...new Set(next)] : fallback;
}

function parseMatrix(raw: unknown): Record<ApprovalKind, RoleKey[]> {
  const value = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    people: asRoleList(value.people, DEFAULT_APPROVAL_ROLES.people),
    project: asRoleList(value.project, DEFAULT_APPROVAL_ROLES.project),
    proposal: asRoleList(value.proposal, DEFAULT_APPROVAL_ROLES.proposal),
    invoice: asRoleList(value.invoice, DEFAULT_APPROVAL_ROLES.invoice),
  };
}

export async function getApprovalMatrix() {
  if (cache && Date.now() - cache.at < 15_000) return cache.value;
  try {
    const row = await prisma.setting.findUnique({ where: { key: SETTING_KEY } });
    const value = parseMatrix(row?.value);
    cache = { at: Date.now(), value };
    return value;
  } catch {
    return DEFAULT_APPROVAL_ROLES;
  }
}

export function invalidateApprovalCache() {
  cache = null;
}

export async function saveApprovalMatrix(next: Record<ApprovalKind, RoleKey[]>) {
  const value = parseMatrix(next);
  await prisma.setting.upsert({
    where: { key: SETTING_KEY },
    update: { value },
    create: { key: SETTING_KEY, value },
  });
  cache = { at: Date.now(), value };
  return value;
}

export async function approvalRoles(kind: ApprovalKind) {
  const matrix = await getApprovalMatrix();
  return matrix[kind];
}

export async function canApprove(user: AuthUser, kind: ApprovalKind) {
  if (user.roleKey === "super_admin") return true;
  const roles = await approvalRoles(kind);
  return roles.includes(user.roleKey);
}

export async function nextApproverLabel(kind: ApprovalKind) {
  const roles = await approvalRoles(kind);
  const names = roles.map((key) => ROLE_DESK[key] || key);
  const unique = [...new Set(names)];
  if (!unique.length) return "a Super Admin";
  if (unique.length === 1) return unique[0];
  return `${unique.slice(0, -1).join(", ")} or ${unique.at(-1)}`;
}

export function roleLabel(key: RoleKey) {
  if (key === "super_admin") return "Super Admin";
  if (key === "crm_manager") return "Business / CRM manager";
  if (key === "hr_admin") return "HR";
  if (key === "accounts") return "Accounts";
  if (key === "project_manager") return "Project manager";
  if (key === "sales_manager") return "Sales manager";
  if (key === "marketing_manager") return "Marketing manager";
  if (key === "bpo_leader") return "BPO team leader";
  if (key === "bpo_executive") return "BPO executive";
  if (key === "employee") return "Employee";
  return key;
}
