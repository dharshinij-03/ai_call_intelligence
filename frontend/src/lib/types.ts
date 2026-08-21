// Types mirror each backend service's Pydantic schemas exactly (field names,
// nullability). See the corresponding service's app/schemas.py.

export type UserRole = 'citizen' | 'operator' | 'officer' | 'admin';

export const DEPARTMENTS = [
  'Water Supply & Sewerage',
  'Sanitation & Solid Waste',
  'Roads & Public Works',
  'Electricity & Street Lighting',
  'Public Transport',
  'Traffic Management',
  'Public Health',
  'Emergency & Disaster Management',
  'Police & Public Safety',
  'Municipal Services',
  'Environment',
  'Revenue & Civic Administration',
] as const;
export type Department = (typeof DEPARTMENTS)[number];

// ---- user-management-service ----
export interface User {
  id: string;
  email: string;
  phone_number: string | null;
  full_name: string;
  role: UserRole;
  department: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Token {
  access_token: string;
  token_type: string;
}

// ---- call-analysis-service ----
export type Sentiment = 'distressed' | 'angry' | 'negative' | 'neutral' | 'positive';
export type Urgency = 'critical' | 'high' | 'medium' | 'low';

export interface CallAnalysisOut {
  id: string;
  call_id: string;
  summary: string;
  sentiment: Sentiment;
  urgency: Urgency;
  department: string;
  location: string | null;
  tags: string[];
  reasoning: string | null;
  latitude: number | null;
  longitude: number | null;
  is_duplicate: boolean;
  duplicate_of_call_id: string | null;
  created_at: string;
}

// ---- complaint-assignment-service ----
export type AssignmentStatus =
  | 'UNASSIGNED'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'PENDING_INFORMATION'
  | 'RESOLVED'
  | 'CLOSED'
  | 'REOPENED';

export interface AssignmentOut {
  id: string;
  call_id: string;
  department_id: string;
  department_name: string;
  priority: string;
  officer_id: string | null;
  officer_name: string | null;
  status: AssignmentStatus;
  sla_due_at: string | null;
  assigned_at: string | null;
  created_at: string;
}

export type RecommendationType =
  | 'FIELD_INSPECTION'
  | 'DISPATCH_REPAIR_TEAM'
  | 'DESK_RESOLUTION'
  | 'ESCALATE_TO_SENIOR_OFFICER'
  | 'COORDINATE_WITH_OTHER_DEPARTMENT'
  | 'MONITOR_SITUATION';

export interface RecommendationOut {
  id: string;
  call_id: string;
  recommendation_text: string;
  recommendation_type: RecommendationType;
  confidence: number;
  accepted_by_officer: boolean | null;
  officer_action: string | null;
  generated_at: string;
  created_at: string;
}

export interface DepartmentMasterOut {
  id: string;
  code: string;
  name: string;
}

// ---- admin-service ----
export interface DepartmentSummaryOut {
  id: string;
  code: string;
  name: string;
  officer_count: number;
  total_complaints: number;
  open_complaints: number;
  resolved_complaints: number;
  critical_complaints: number;
  sla_breaches: number;
}

export interface OfficerSummaryOut {
  id: string;
  full_name: string;
  email: string;
  department: string | null;
  is_active: boolean;
  open_workload: number;
  resolved_count: number;
  avg_resolution_hours: number | null;
  sla_compliance_pct: number | null;
}

export interface ComplaintOut {
  call_id: string;
  source: string | null;
  call_status: string | null;
  created_at: string;
  department_id: string | null;
  department_name: string | null;
  sentiment: string | null;
  urgency: string | null;
  summary: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  tags: string[] | null;
  is_duplicate: boolean | null;
  duplicate_of_call_id: string | null;
  assignment_status: string | null;
  officer_id: string | null;
  officer_name: string | null;
  sla_due_at: string | null;
}

export interface ComplaintDetailOut extends ComplaintOut {
  reasoning: string | null;
  recommendation_text: string | null;
  recommendation_type: string | null;
  recommendation_confidence: number | null;
  officer_action: string | null;
}

export interface ComplaintListOut {
  total: number;
  items: ComplaintOut[];
}

export interface HeatmapCellOut {
  latitude: number;
  longitude: number;
  complaint_count: number;
  critical_count: number;
  dominant_department: string | null;
}

export interface TrendPointOut {
  day: string;
  department_name: string | null;
  count: number;
}

export interface OverviewOut {
  total_complaints: number;
  open_complaints: number;
  resolved_complaints: number;
  critical_complaints: number;
  duplicate_complaints: number;
  sla_breaches: number;
  departments: DepartmentSummaryOut[];
}

// ---- citizen-service ----
export type CallSessionStatus = 'WAITING' | 'CONNECTED' | 'ENDED' | 'CANCELLED';

export interface CallSessionOut {
  id: string;
  citizen_id: string;
  citizen_name: string;
  operator_id: string | null;
  operator_name: string | null;
  status: CallSessionStatus;
  requested_at: string;
  connected_at: string | null;
  ended_at: string | null;
}

export interface ComplaintStatusOut {
  call_id: string;
  call_session_id: string;
  requested_at: string;
  department_name: string | null;
  summary: string | null;
  urgency: string | null;
  sentiment: string | null;
  location: string | null;
  assignment_status: string | null;
  officer_name: string | null;
  sla_due_at: string | null;
  feedback_submitted: boolean;
  feedback_rating: number | null;
  feedback_comments: string | null;
}
