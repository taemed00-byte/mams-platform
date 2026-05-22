export type ProviderCategory = 'Hospital'|'Clinic'|'Pharmacy'|'Ambulance'|'Laboratory';
export type ProviderTier = 'Preferred'|'Standard'|'Blacklisted';
export interface Provider {
  id: string; name: string; category: ProviderCategory; tier: ProviderTier;
  contact_name?: string; phone?: string; email?: string; country?: string; city?: string;
  specialties?: string; contract_start?: string; contract_end?: string; contract_file_path?: string;
  address?: string; accreditation?: string;
  total_cases: number; average_cost: number; approval_rate: number; rating: number; created_at: string;
}
export interface ProviderTariff {
  id: string; provider_id: string; service_name: string; unit_price: number; currency: string;
  effective_date?: string; notes?: string;
}
