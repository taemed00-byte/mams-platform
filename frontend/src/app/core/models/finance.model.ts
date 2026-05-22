export type InvoiceStatus = 'Draft'|'Sent'|'Paid'|'Overdue'|'Cancelled';
export type PaymentMethod = 'Bank Transfer'|'Card'|'Cash'|'Cheque';
export type PaymentStatus = 'Cleared'|'Pending'|'Failed';

export interface InvoiceLineItem {
  id: string; invoice_id: string; description: string; quantity: number; unit_price: number; amount: number;
}
export interface Invoice {
  id: string; invoice_number: string; case_id?: string; client_id?: string; provider_id?: string;
  invoice_type: string; status: InvoiceStatus; currency: string;
  subtotal: number; tax_rate: number; tax_amount: number; total: number;
  notes?: string; due_date?: string; paid_date?: string; created_at: string;
  line_items: InvoiceLineItem[];
}
export interface Payment {
  id: string; invoice_id?: string; provider_id?: string; payment_type: string;
  method: PaymentMethod; status: PaymentStatus; amount: number; currency: string;
  reference?: string; notes?: string; payment_date?: string; created_at: string;
}
