export type UserRole =
  | "procurement"
  | "procurement_manager"
  | "engineer"
  | "supplier_contact"
  | "system_admin";

export type RecordStatus = "active" | "inactive";

export type CycleStatus =
  | "DRAFT"
  | "AWAITING_ENGINEER_TIME"
  | "AWAITING_SUPPLIER_RESPONSES"
  | "OVERRIDE_REQUIRED"
  | "RESCHEDULE_REQUIRED"
  | "CONFIRMED"
  | "VISIT_PENDING"
  | "AWAITING_ENGINEER_CLOSE"
  | "AWAITING_PROCUREMENT_CLOSE"
  | "RECIRCULATED"
  | "CLOSED"
  | "CANCELLED";

export const DASHBOARD_ROLES: UserRole[] = ["procurement", "procurement_manager", "system_admin"];

export const CYCLE_STATUS_LABELS: Record<CycleStatus, string> = {
  DRAFT: "Draft",
  AWAITING_ENGINEER_TIME: "Awaiting engineer time",
  AWAITING_SUPPLIER_RESPONSES: "Awaiting supplier responses",
  OVERRIDE_REQUIRED: "Override required",
  RESCHEDULE_REQUIRED: "Reschedule required",
  CONFIRMED: "Confirmed",
  VISIT_PENDING: "Visit pending",
  AWAITING_ENGINEER_CLOSE: "Awaiting engineer close",
  AWAITING_PROCUREMENT_CLOSE: "Awaiting procurement close",
  RECIRCULATED: "Recirculated",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

export interface Profile {
  id: string;
  name: string;
  mobile: string | null;
  email: string | null;
  role: UserRole;
  department: string | null;
  designation: string | null;
  preferred_language: "en" | "si" | "ta";
  status: RecordStatus;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  status: RecordStatus;
}

export interface SubCategory {
  id: string;
  name: string;
  description: string | null;
  rank: number;
  status: RecordStatus;
}

export interface SupplierCompany {
  id: string;
  company_name: string;
  contact_user_id: string;
  tier_id: string;
  address: string | null;
  availability_contact: string | null;
  status: RecordStatus;
  contact?: Profile;
  tier?: SubCategory;
  categories?: Category[];
}

export interface Job {
  id: string;
  pr_reference: string;
  description: string;
  title: string | null;
  engineer_id: string;
  location: string;
  priority: "normal" | "urgent";
  status: "active" | "closed" | "cancelled";
  created_at: string;
  engineer?: Profile;
  cycles?: JobCycle[];
}

export interface JobCycle {
  id: string;
  job_id: string;
  cycle_no: number;
  selected_time: string | null;
  response_cutoff: string | null;
  status: CycleStatus;
  created_at: string;
}
