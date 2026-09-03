export const PROPERTY_TYPES = ["Apartment", "Villa", "Plot", "Commercial"] as const;
export const CONFIGURATIONS = ["1BHK", "2BHK", "3BHK", "4BHK", "Plot", "Other"] as const;
export const PURPOSES = ["Buy", "Rent"] as const;
export const USE_TYPES = ["End use", "Investment"] as const;
export const SITE_VISIT_STATUSES = ["Planned", "Completed", "No-show", "Rescheduled"] as const;
export const NEGOTIATION_STATUSES = ["Open", "Price agreed", "Stuck", "Dropped"] as const;
export const REGISTRATION_STATUSES = ["Not started", "In progress", "Registered", "Delayed"] as const;

export type RealEstateDetailsView = {
  propertyId: string | null;
  projectId: string | null;
  location: string | null;
  propertyType: string | null;
  configuration: string | null;
  budget: number | null;
  preferredLocation: string | null;
  purpose: string | null;
  useType: string | null;
  possessionRequirement: string | null;
  loanRequired: boolean | null;
  siteVisitDate: string | null;
  siteVisitStatus: string | null;
  negotiationStatus: string | null;
  bookingAmount: number | null;
  expectedRegistrationDate: string | null;
  registrationStatus: string | null;
  propertyValue: number | null;
  project: { id: string; name: string; location: string | null } | null;
  property: { id: string; name: string; configuration: string | null } | null;
};

export type SiteVisitView = {
  id: string;
  scheduledAt: string | null;
  completedAt: string | null;
  outcome: string | null;
  propertyId: string | null;
  property: { id: string; name: string } | null;
};

export type InventoryProject = {
  id: string;
  name: string;
  location: string | null;
  clientId: string;
  clientName: string;
};

export type InventoryProperty = {
  id: string;
  name: string;
  projectId: string | null;
  clientId: string;
  propertyType: string | null;
  configuration: string | null;
  location: string | null;
  value: number | null;
};
