export interface Notification {
  id: string; title: string; message: string; notif_type: string;
  is_read: boolean; entity_type?: string; entity_id?: string; created_at: string;
}
