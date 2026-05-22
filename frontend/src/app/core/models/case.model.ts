export type CaseType = 'Outpatient'|'Inpatient'|'Evacuation & Repatriation'|'Telemedicine'|'Concierge';
export type Priority = 'Low'|'Medium'|'High'|'Critical';
export type CaseStatus = 'Open'|'Pending'|'Approved'|'Closed'|'Cancelled';
export type Currency = 'EUR'|'USD'|'EGP'|'AED';
export type Country = 'Egypt'|'Germany'|'Spain'|'UAE'|'USA';

export interface Patient {
  id: string; name: string; nationality?: string; passport_number?: string;
  date_of_birth?: string; gender?: string; phone?: string; email?: string;
}
export interface Case {
  id: string; case_number: string; case_type: CaseType; priority: Priority; status: CaseStatus;
  country?: Country; city?: string; location_lat?: number; location_lng?: number; location_address?: string;
  estimated_cost: number; actual_cost: number; currency: Currency;
  sla_target_hours: number; sla_actual_hours?: number; sla_breached: boolean;
  insurance_policy_number?: string; description?: string;
  opened_at: string; closed_at?: string; created_at: string;
  patient?: Patient;
  assigned_user_id?: string; provider_id?: string; client_id?: string; contract_id?: string;
}
export interface Communication {
  id: string; case_id: string; user_id: string; comm_type: string;
  content: string; direction: string; created_at: string;
}
