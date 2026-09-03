export const PLATFORMS = [
  "google_ads",
  "meta_ads",
  "linkedin_ads",
  "website",
  "landing_page",
  "organic",
  "referral",
  "other",
] as const;

export const CAMPAIGN_TYPES = ["lead_gen", "brand", "retargeting", "other"] as const;

export const INVALID_STATUS_KEYS = ["INVALID", "DUPLICATE", "DO_NOT_CALL"] as const;

export const QUALIFIED_STATUS_KEYS = [
  "QUALIFIED",
  "INTERESTED",
  "PARENT_CONNECTED",
  "COUNSELLING",
  "CAMPUS_VISIT",
  "SITE_VISIT",
  "SITE_VISIT_COMPLETED",
  "APPLICATION",
  "DOCUMENTATION",
  "FEE_DISCUSSION",
  "PAYMENT_PENDING",
  "ADMISSION_CONFIRMED",
  "PROPERTY_SHARED",
  "NEGOTIATION",
  "BOOKING",
  "REGISTRATION",
  "MEETING",
  "FOLLOW_UP",
] as const;

export const WON_STATUS_KEYS = ["CLOSED_WON"] as const;
