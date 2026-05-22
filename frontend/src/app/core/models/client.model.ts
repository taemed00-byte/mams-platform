export type PipelineStage = 'Lead'|'Opportunity'|'Won'|'Lost';
export type ClientType = 'Insurance Company'|'Assistance Company'|'Corporate'|'Hotel'|'Individual';
export type ContractStatus = 'Active'|'Pending'|'Expired'|'Terminated';
export interface Client {
  id: string; name: string; client_type: ClientType; contact_name?: string;
  email?: string; phone?: string; country?: string; pipeline_stage: PipelineStage;
  is_active: boolean; total_cases: number; total_revenue: number; created_at: string;
  notes?: string;
}
export interface Contract {
  id: string; contract_number: string; client_id: string; status: ContractStatus;
  start_date?: string; end_date?: string; assistance_fee: number; currency: string;
  sla_response_hours: number; tariff_notes?: string; special_terms?: string; file_path?: string; created_at: string;
}
