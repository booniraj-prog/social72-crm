export const HIDDEN_INDUSTRY_KEYS = [] as const;

export function isHiddenIndustry(key: string | null | undefined) {
  return Boolean(key && (HIDDEN_INDUSTRY_KEYS as readonly string[]).includes(key));
}

export const INDUSTRY_CATALOG = [
  { key: "education", name: "Education" },
  { key: "real_estate", name: "Real Estate" },
  { key: "events", name: "Events" },
  { key: "technology", name: "Technology" },
  { key: "healthcare", name: "Healthcare" },
  { key: "retail", name: "Retail" },
  { key: "professional_services", name: "Professional Services" },
  { key: "services", name: "Services" },
  { key: "hospitality", name: "Hospitality & Travel" },
  { key: "manufacturing", name: "Manufacturing" },
  { key: "finance", name: "BFSI / Finance" },
  { key: "automotive", name: "Automotive" },
  { key: "media", name: "Media & Entertainment" },
  { key: "fmcg", name: "FMCG" },
  { key: "ecommerce", name: "E-commerce" },
  { key: "construction", name: "Construction" },
  { key: "logistics", name: "Logistics" },
  { key: "telecom", name: "Telecom" },
  { key: "ngo", name: "NGO / Social" },
  { key: "government", name: "Government" },
  { key: "other", name: "Other" },
] as const;

export const GENERIC_PIPELINE_STAGES = [
  { name: "New", key: "NEW", sortOrder: 10 },
  { name: "Contacted", key: "CONNECTED", sortOrder: 20 },
  { name: "Qualified", key: "QUALIFIED", sortOrder: 30 },
  { name: "Requirement", key: "REQUIREMENT", sortOrder: 40 },
  { name: "Proposal", key: "PROPOSAL_SENT", sortOrder: 50 },
  { name: "Negotiation", key: "NEGOTIATION", sortOrder: 60 },
  { name: "Won", key: "CLOSED_WON", sortOrder: 70 },
  { name: "Lost", key: "CLOSED_LOST", sortOrder: 80 },
] as const;
