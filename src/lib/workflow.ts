import type { AuthUser, RoleKey } from "@/lib/rbac";
import { ROLE_DESK } from "@/lib/rbac";

export type WorkflowQueue =
  | "calls"
  | "followups"
  | "unassigned"
  | "tasks"
  | "deliverables"
  | "spend"
  | "invoices"
  | "quotes"
  | "people"
  | "projects"
  | "untagged";

export type RolePlaybook = {
  desk: string;
  summary: string;
  steps: Array<{ label: string; detail: string }>;
  queues: WorkflowQueue[];
};

const ALL_QUEUES: WorkflowQueue[] = [
  "unassigned",
  "calls",
  "followups",
  "quotes",
  "untagged",
  "invoices",
  "spend",
  "people",
  "projects",
  "tasks",
  "deliverables",
];

const BOOKS: Record<RoleKey, RolePlaybook> = {
  bpo_executive: {
    desk: ROLE_DESK.bpo_executive,
    summary: "You own assigned leads only. Call, log the outcome, and always leave a next follow-up.",
    steps: [
      { label: "Call", detail: "Work the Calling queue. Do not skip assigned leads." },
      { label: "Log", detail: "Disposition, notes, temperature." },
      { label: "Follow up", detail: "Every live lead needs a next date." },
    ],
    queues: ["calls", "followups", "tasks"],
  },
  bpo_leader: {
    desk: ROLE_DESK.bpo_leader,
    summary: "Assign unowned leads, watch the floor, and clear overdue follow-ups on your team.",
    steps: [
      { label: "Assign", detail: "Give NEW leads to an executive." },
      { label: "Monitor", detail: "Overdue follow-ups and missed first calls." },
      { label: "Coach", detail: "Reassign stuck leads inside the team." },
    ],
    queues: ["unassigned", "followups", "calls", "tasks"],
  },
  sales_manager: {
    desk: ROLE_DESK.sales_manager,
    summary: "Turn qualified demand into a proposal, then tag the job once it is won.",
    steps: [
      { label: "Quote", detail: "Build the proposal with costing." },
      { label: "Send", detail: "Accounts approve the commercial document." },
      { label: "Tag", detail: "When won, tag to a project so budget and margin track." },
    ],
    queues: ["quotes", "untagged", "followups", "invoices"],
  },
  marketing_manager: {
    desk: ROLE_DESK.marketing_manager,
    summary: "Run ad campaigns and budgets, then feed clean leads. Outbound calling converts; nurture keeps the rest warm.",
    steps: [
      { label: "Campaign", detail: "Create the ad campaign and set the budget." },
      { label: "Capture", detail: "Import or add leads against that campaign." },
      { label: "Nurture", detail: "Keep cold leads warm until the next outbound call." },
    ],
    queues: ["tasks", "followups"],
  },
  project_manager: {
    desk: ROLE_DESK.project_manager,
    summary: "You own tagged projects: assign people, monitor tasks, and book spend against the job.",
    steps: [
      { label: "Accept", detail: "Approve new projects, then run tasks and spend on the job." },
      { label: "Deliver", detail: "Tasks and deliverables on that job." },
      { label: "Cost", detail: "Raise spend against the project for costing." },
    ],
    queues: ["untagged", "deliverables", "tasks", "spend", "projects"],
  },
  accounts: {
    desk: ROLE_DESK.accounts,
    summary: "Gate for money: client POs, expenses, invoices and collections that feed Social72 profit.",
    steps: [
      { label: "Review", detail: "Pending spend and draft invoices." },
      { label: "Approve", detail: "Approve or reject. Cost then hits the project." },
      { label: "Collect", detail: "Follow up invoices and POs. Track billed vs paid on Social72 profit." },
    ],
    queues: ["spend", "invoices", "quotes", "projects"],
  },
  hr_admin: {
    desk: ROLE_DESK.hr_admin,
    summary: "Onboard employees, assign roles, and activate login. Staff expenses wait on you too.",
    steps: [
      { label: "Hire", detail: "New person is submitted pending." },
      { label: "Approve", detail: "Activate login and role." },
      { label: "Spend", detail: "Approve staff reimbursements." },
    ],
    queues: ["people", "spend", "tasks"],
  },
  employee: {
    desk: ROLE_DESK.employee,
    summary: "Your tasks, delivery work, and expense claims. Approvals sit with your manager or accounts.",
    steps: [
      { label: "Do work", detail: "Tasks and deliverables assigned to you." },
      { label: "Claim", detail: "Submit spend. It stays pending until Accounts/HR." },
    ],
    queues: ["tasks", "deliverables", "spend"],
  },
  client: {
    desk: ROLE_DESK.client,
    summary: "View your campaigns, leads and reports. Social72 runs calling, projects and collections.",
    steps: [{ label: "Review", detail: "Campaign performance and your leads." }],
    queues: ["followups"],
  },
  crm_manager: {
    desk: ROLE_DESK.crm_manager,
    summary: "Full Social72 desk: clients, projects, employees, campaigns, calling, POs, invoices and profit.",
    steps: [
      { label: "Demand", detail: "Leads assigned and being worked on the calling floor." },
      { label: "Sell", detail: "Proposals tagged to projects." },
      { label: "Deliver & collect", detail: "Tasks, spend, POs, invoices and Social72 profit." },
    ],
    queues: ALL_QUEUES,
  },
  super_admin: {
    desk: ROLE_DESK.super_admin,
    summary: "Full operating system. Onboard people and clients, then run the pipeline through to Social72 profit.",
    steps: [
      { label: "People", detail: "Employees, roles and access." },
      { label: "Pipeline", detail: "Leads → campaigns → projects → POs → invoices → profit." },
      { label: "Control", detail: "Approvals and settings." },
    ],
    queues: ALL_QUEUES,
  },
};

export function playbookFor(user: AuthUser): RolePlaybook {
  return BOOKS[user.roleKey] ?? BOOKS.employee;
}

export async function nextActorLabel(kind: "spend" | "invoice" | "people" | "proposal" | "project") {
  if (kind === "spend") return "Accounts or HR";
  const { nextApproverLabel } = await import("@/lib/approvals");
  if (kind === "invoice") return nextApproverLabel("invoice");
  if (kind === "people") return nextApproverLabel("people");
  if (kind === "project") return nextApproverLabel("project");
  return nextApproverLabel("proposal");
}
