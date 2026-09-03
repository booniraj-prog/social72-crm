export type LeadStatus = {
  id: string;
  key: string;
  name: string;
  color: string;
  isFinal: boolean;
};

export type LeadRow = {
  id: string;
  leadNumber: string;
  fullName: string;
  mobileE164: string;
  email: string | null;
  city: string | null;
  state: string | null;
  temperature: "HOT" | "WARM" | "COLD" | "UNQUALIFIED";
  leadScore: number;
  nextFollowupAt: string | null;
  nextAction: string | null;
  expectedValue: number;
  probabilityPct: number;
  expectedRevenue: number;
  createdAt: string;
  client: { id: string; name: string };
  campaign: { id: string; name: string };
  status: LeadStatus;
  assignedUser: { id: string; name: string } | null;
  source: { id: string; name: string } | null;
  industry: { id: string; key: string; name: string };
};

export type LeadDetail = LeadRow & {
  firstName: string | null;
  lastName: string | null;
  alternateMobile: string | null;
  pincode: string | null;
  gender: string | null;
  occupation: string | null;
  age: number | null;
  sourcePlatform: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  assignedAt: string | null;
  lastActivityAt: string | null;
  wonLostReason: string | null;
  createdBy: { id: string; name: string } | null;
  generatedAt: string | null;
  callLogs: Array<{
    id: string;
    startedAt: string;
    durationSec: number | null;
    notes: string | null;
    nextAction: string | null;
    disposition: { key: string; name: string } | null;
    user: { name: string };
  }>;
  followUps: Array<{
    id: string;
    dueAt: string;
    action: string | null;
    completedAt: string | null;
    user: { name: string };
  }>;
  tasks: Array<{ id: string; title: string; dueAt: string | null }>;
  notes: Array<{ id: string; body: string; createdAt: string; user: { name: string } }>;
  activities: Array<{
    id: string;
    type: string;
    title: string;
    body: string | null;
    createdAt: string;
    user: { name: string } | null;
  }>;
  education?: import("@/modules/education/types").EducationDetailsView | null;
  campusVisits?: import("@/modules/education/types").CampusVisitView[];
  realEstate?: import("@/modules/real-estate/types").RealEstateDetailsView | null;
  siteVisits?: import("@/modules/real-estate/types").SiteVisitView[];
};

export type LeadOptions = {
  statuses: LeadStatus[];
  sources: Array<{ id: string; name: string }>;
  assignees: Array<{ id: string; name: string; email: string; role: { key: string; name: string } }>;
  temperatures: LeadRow["temperature"][];
  dispositions?: Array<{ id: string; key: string; name: string }>;
};
