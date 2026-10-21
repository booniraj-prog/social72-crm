import { z, type ZodIssue } from "zod";

export function emptyToUndef(value: unknown) {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
}

const UUID_HINTS: Record<string, string> = {
  clientId: "Select a client",
  campaignId: "Select a campaign",
  engagementId: "Select a project, or leave as overhead",
  leadId: "Select a lead, or leave blank",
  roleId: "Select a role",
  sourceId: "Select a source, or leave blank",
  assignedUserId: "Select an employee",
  assignedTo: "Select an employee",
  ownerUserId: "Select an owner, or leave blank",
  userId: "Select a person",
  statusId: "Select a status",
  dispositionId: "Select a call outcome",
  invoiceId: "Choose a proposal",
  industryId: "Select an industry, or leave blank",
  projectId: "Select a project, or leave blank",
  id: "This record is missing. Close and try again.",
};

export const optionalId = z.preprocess(emptyToUndef, z.string().uuid("Choose an option from the list").optional());

export function requiredId(label: string) {
  return z.preprocess(
    emptyToUndef,
    z.string({ required_error: `Select ${label}` }).uuid(`Select ${label}`),
  );
}

export const optionalEmail = z.preprocess(emptyToUndef, z.string().email("Enter a valid email address").optional());

export const optionalPassword = z.preprocess(
  emptyToUndef,
  z.string().min(8, "Password must be at least 8 characters").max(72).optional(),
);

export function friendlyZodMessage(issue: ZodIssue) {
  const path = issue.path.filter((p) => typeof p === "string").join(".");
  const uuidLike =
    issue.message === "Invalid uuid" ||
    (issue.code === "invalid_string" && "validation" in issue && issue.validation === "uuid");
  if (uuidLike) return UUID_HINTS[path] ?? "Choose an option from the list";
  if (issue.message === "Invalid email" || (issue.code === "invalid_string" && "validation" in issue && issue.validation === "email")) {
    return "Enter a valid email address";
  }
  return issue.message;
}

export function zodFieldMap(issues: ZodIssue[]) {
  const fields: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.filter((p) => typeof p === "string" || typeof p === "number").join(".");
    if (!key || fields[key]) continue;
    fields[key] = friendlyZodMessage(issue);
  }
  return fields;
}
