export const SERVICE_LINES = [
  "Website Design",
  "Website Development",
  "Digital Marketing",
  "SEO",
  "Google Ads",
  "Meta Ads",
  "LinkedIn Ads",
  "YouTube Ads",
  "Lead Generation",
  "Lead Nurturing",
  "WhatsApp / SMS Nurturing",
  "Outbound Calling",
  "Events Marketing",
  "Mergers & Acquisitions",
  "Branding",
  "Creative Services",
  "Custom Digital Marketing",
] as const;

export const PROJECT_TYPES = [
  "Website",
  "Digital Marketing",
  "Lead Generation",
  "Lead Nurturing",
  "Outbound Calling",
  "Events",
  "M&A",
  "Custom",
] as const;

export const BILLING_MODELS = ["RETAINER", "FIXED", "MILESTONE", "HOURLY", "PO"] as const;

export const CLIENT_CATEGORIES = ["RETAINER", "PROJECT", "AGENCY", "PARTNER", "INTERNAL"] as const;

export const DELIVERABLE_STATUSES = [
  "PENDING",
  "IN_PROGRESS",
  "INTERNAL_REVIEW",
  "SENT_TO_CLIENT",
  "REVISION",
  "APPROVED",
  "COMPLETED",
] as const;

export const ENGAGEMENT_STATUSES = [
  "NOT_STARTED",
  "PLANNING",
  "IN_PROGRESS",
  "REVIEW",
  "CLIENT_APPROVAL",
  "COMPLETED",
  "ON_HOLD",
  "OPEN",
  "DELIVERED",
  "INVOICED",
  "CLOSED",
] as const;

export const CAPTURE_CHANNELS = [
  "website",
  "landing_page",
  "whatsapp",
  "social",
  "phone",
  "manual",
] as const;

export const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

export const TASK_STATUSES = [
  "OPEN",
  "NOT_STARTED",
  "IN_PROGRESS",
  "WAITING_CLIENT",
  "INTERNAL_REVIEW",
  "CLIENT_REVIEW",
  "BLOCKED",
  "DONE",
  "CANCELLED",
] as const;

export const LICENSE_CATEGORIES = [
  "SaaS",
  "Marketing",
  "CRM",
  "Design",
  "Development",
  "Hosting",
  "Domain",
  "SSL",
  "API",
  "Cloud",
  "Email",
  "Plugin",
  "Other",
] as const;

export const BILLING_CYCLES = ["MONTHLY", "QUARTERLY", "YEARLY", "ONE_TIME"] as const;

export const INVOICE_KINDS = ["QUOTE", "PROFORMA", "INVOICE", "CREDIT_NOTE", "DEBIT_NOTE"] as const;

export const INVOICE_STATUSES = ["DRAFT", "SENT", "PARTIAL", "PAID", "OVERDUE", "VOID"] as const;

export const PURCHASE_STATUSES = [
  "REQUESTED",
  "APPROVED",
  "ORDERED",
  "DELIVERED",
  "INVOICED",
  "PAID",
  "REJECTED",
] as const;

export const EXPENSE_CATEGORIES = [
  "Travel",
  "Office",
  "Advertising",
  "Software",
  "SaaS",
  "Hosting",
  "Domains",
  "Marketing tools",
  "Client",
  "Project",
  "Employee",
  "Vendor",
  "Petty cash",
  "Other",
] as const;

export const EXPENSE_STATUSES = ["SUBMITTED", "APPROVED", "REJECTED", "REIMBURSED"] as const;

export const DOCUMENT_KINDS = [
  "CONTRACT",
  "BRIEF",
  "CLIENT_PO",
  "VENDOR_PO",
  "INVOICE",
  "PROPOSAL",
  "AGREEMENT",
  "LEAD_IMPORT",
  "OTHER",
] as const;
