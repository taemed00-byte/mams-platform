export type Role = 'Administrator' | 'Operations' | 'Finance' | 'Sales';
export interface User {
  id: string; name: string; email: string; role: Role;
  is_active: boolean; last_login?: string; created_at: string;
}
export interface AuthState { user: User | null; token: string | null; }
