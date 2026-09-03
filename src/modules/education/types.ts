export const ADMISSION_STATUSES = [
  "Enquiry",
  "Counselling",
  "Application",
  "Offered",
  "Admitted",
  "Waitlisted",
  "Withdrawn",
] as const;

export const PAYMENT_STATUSES = ["Unpaid", "Partial", "Paid", "Refunded"] as const;

export type EducationDetailsView = {
  studentName: string | null;
  parentName: string | null;
  currentClass: string | null;
  completedClass: string | null;
  targetClass: string | null;
  board: string | null;
  course: string | null;
  stream: string | null;
  preferredCourse: string | null;
  entranceExam: string | null;
  academicScore: string | null;
  location: string | null;
  preferredCampus: string | null;
  hostelRequired: boolean | null;
  parentOccupation: string | null;
  budget: number | null;
  admissionTimeline: string | null;
  campusVisitDate: string | null;
  counsellingDate: string | null;
  admissionStatus: string | null;
  fee: number | null;
  scholarship: number | null;
  paymentStatus: string | null;
};

export type CampusVisitView = {
  id: string;
  scheduledAt: string | null;
  completedAt: string | null;
  campus: string | null;
  outcome: string | null;
};

export type EducationPipelineStage = {
  id: string;
  name: string;
  sortOrder: number;
  statusId: string;
  statusKey: string;
  count: number;
};
