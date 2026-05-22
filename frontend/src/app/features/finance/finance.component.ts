import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { Invoice, Payment } from '../../core/models/finance.model';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-finance',
  standalone: true,
  imports: [CommonModule, FormsModule, MatTabsModule, MatTableModule, MatButtonModule, MatIconModule,
            MatInputModule, MatSelectModule, MatTooltipModule, MatDividerModule,
            MatProgressSpinnerModule, RouterLink],
  template: `
    <div>
      <div class="page-header">
        <div>
          <h1>Finance</h1>
          <p class="subtitle">Invoices · Payments · Financial KPIs</p>
        </div>
        <div class="header-actions">
          <button mat-stroked-button (click)="exportInvoices()"><mat-icon>download</mat-icon> Export</button>
          <button mat-raised-button color="primary" routerLink="/finance/invoices/new"><mat-icon>add</mat-icon> New Invoice</button>
        </div>
      </div>

      <!-- KPI Cards -->
      <div class="kpi-grid" *ngIf="kpis()">
        <div class="kpi-card" style="border-color:#2e7d32">
          <mat-icon class="kpi-icon" style="color:#2e7d32">trending_up</mat-icon>
          <div>
            <div class="kpi-label">Total Revenue</div>
            <div class="kpi-value">\${{kpis()!.total_revenue | number:'1.0-0'}}</div>
          </div>
        </div>
        <div class="kpi-card" style="border-color:#f57f17">
          <mat-icon class="kpi-icon" style="color:#f57f17">hourglass_top</mat-icon>
          <div>
            <div class="kpi-label">Outstanding Balance</div>
            <div class="kpi-value">\${{kpis()!.outstanding_balance | number:'1.0-0'}}</div>
          </div>
        </div>
        <div class="kpi-card" style="border-color:#1e3870">
          <mat-icon class="kpi-icon" style="color:#1e3870">account_balance_wallet</mat-icon>
          <div>
            <div class="kpi-label">Collected Amount</div>
            <div class="kpi-value">\${{kpis()!.collected_amount | number:'1.0-0'}}</div>
          </div>
        </div>
        <div class="kpi-card" style="border-color:#c62828">
          <mat-icon class="kpi-icon" style="color:#c62828">warning</mat-icon>
          <div>
            <div class="kpi-label">Overdue Invoices</div>
            <div class="kpi-value">{{overdueCount()}}</div>
          </div>
        </div>
      </div>

      <mat-tab-group class="mams-card">

        <!-- ── Invoices Tab ── -->
        <mat-tab label="Invoices ({{invoices().length}})">
          <div class="tab-filters">
            <mat-form-field appearance="outline">
              <mat-label>Status</mat-label>
              <mat-select [(ngModel)]="invoiceFilters.status" (ngModelChange)="loadInvoices()">
                <mat-option value="">All</mat-option>
                <mat-option *ngFor="let s of invoiceStatuses" [value]="s">{{s}}</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Type</mat-label>
              <mat-select [(ngModel)]="invoiceFilters.type" (ngModelChange)="loadInvoices()">
                <mat-option value="">All</mat-option>
                <mat-option value="Incoming">Incoming (from client)</mat-option>
                <mat-option value="Outgoing">Outgoing (to provider)</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>From</mat-label>
              <input matInput type="date" [(ngModel)]="invoiceFilters.dateFrom" (ngModelChange)="loadInvoices()">
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>To</mat-label>
              <input matInput type="date" [(ngModel)]="invoiceFilters.dateTo" (ngModelChange)="loadInvoices()">
            </mat-form-field>
          </div>

          <table mat-table [dataSource]="invoices()">
            <ng-container matColumnDef="invoice_number">
              <th mat-header-cell *matHeaderCellDef>Invoice #</th>
              <td mat-cell *matCellDef="let i"><strong class="inv-link">{{i.invoice_number}}</strong></td>
            </ng-container>
            <ng-container matColumnDef="type">
              <th mat-header-cell *matHeaderCellDef>Type</th>
              <td mat-cell *matCellDef="let i">
                <span class="type-badge" [class]="i.invoice_type === 'Incoming' ? 'type-in' : 'type-out'">
                  {{i.invoice_type}}
                </span>
              </td>
            </ng-container>
            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Status</th>
              <td mat-cell *matCellDef="let i">
                <span class="status-pill" [class]="'inv-' + i.status.toLowerCase()">{{i.status}}</span>
              </td>
            </ng-container>
            <ng-container matColumnDef="total">
              <th mat-header-cell *matHeaderCellDef>Total</th>
              <td mat-cell *matCellDef="let i"><strong>{{i.total | number:'1.2-2'}} {{i.currency}}</strong></td>
            </ng-container>
            <ng-container matColumnDef="due_date">
              <th mat-header-cell *matHeaderCellDef>Due Date</th>
              <td mat-cell *matCellDef="let i">
                <span [class.text-danger]="isOverdue(i)">{{i.due_date | date:'dd/MM/yyyy'}}</span>
              </td>
            </ng-container>
            <ng-container matColumnDef="created">
              <th mat-header-cell *matHeaderCellDef>Created</th>
              <td mat-cell *matCellDef="let i">{{i.created_at | date:'dd/MM/yyyy'}}</td>
            </ng-container>
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef></th>
              <td mat-cell *matCellDef="let i" (click)="$event.stopPropagation()">
                <button mat-icon-button matTooltip="Record payment" *ngIf="i.status === 'Sent' || i.status === 'Overdue'"
                        (click)="openPaymentForm(i)">
                  <mat-icon style="color:#1e3870">payments</mat-icon>
                </button>
                <button mat-icon-button matTooltip="Send invoice" *ngIf="i.status === 'Draft'"
                        (click)="quickStatus(i, 'Sent')">
                  <mat-icon style="color:#1565c0">send</mat-icon>
                </button>
                <button mat-icon-button matTooltip="Mark as paid" *ngIf="i.status === 'Sent' || i.status === 'Overdue'"
                        (click)="quickStatus(i, 'Paid')">
                  <mat-icon style="color:#2e7d32">check_circle</mat-icon>
                </button>
                <button mat-icon-button matTooltip="View details" (click)="openInvoice(i)">
                  <mat-icon>open_in_new</mat-icon>
                </button>
              </td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="invoiceCols"></tr>
            <tr mat-row *matRowDef="let row; columns:invoiceCols" class="table-row" (click)="openInvoice(row)"></tr>
          </table>

          <div *ngIf="invoices().length === 0" class="empty-state">
            <mat-icon>receipt_long</mat-icon>
            <p>No invoices found</p>
            <button mat-raised-button color="primary" routerLink="/finance/invoices/new">
              <mat-icon>add</mat-icon> Create Invoice
            </button>
          </div>
        </mat-tab>

        <!-- ── Payments Tab ── -->
        <mat-tab label="Payments ({{payments().length}})">

          <!-- Record Payment Form -->
          <div class="payment-form-bar" *ngIf="!showPaymentForm()">
            <div style="color:#555;font-size:13px">Record incoming or outgoing payments against invoices.</div>
            <button mat-raised-button color="primary" (click)="showPaymentForm.set(true)">
              <mat-icon>add</mat-icon> Record Payment
            </button>
          </div>

          <!-- Inline payment form -->
          <div class="payment-form-panel" *ngIf="showPaymentForm()">
            <div class="pf-header">
              <span>Record New Payment</span>
              <button mat-icon-button (click)="closePaymentForm()"><mat-icon>close</mat-icon></button>
            </div>
            <div class="pf-grid">
              <mat-form-field appearance="outline">
                <mat-label>Payment Type *</mat-label>
                <mat-select [(ngModel)]="paymentForm.payment_type">
                  <mat-option value="Incoming">Incoming (from client)</mat-option>
                  <mat-option value="Outgoing">Outgoing (to provider)</mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Method *</mat-label>
                <mat-select [(ngModel)]="paymentForm.method">
                  <mat-option *ngFor="let m of paymentMethods" [value]="m">{{m}}</mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Amount *</mat-label>
                <input matInput type="number" [(ngModel)]="paymentForm.amount" min="0.01">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Currency</mat-label>
                <mat-select [(ngModel)]="paymentForm.currency">
                  <mat-option *ngFor="let c of currencies" [value]="c">{{c}}</mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Link to Invoice (optional)</mat-label>
                <mat-select [(ngModel)]="paymentForm.invoice_id">
                  <mat-option value="">— None —</mat-option>
                  <mat-option *ngFor="let inv of invoices()" [value]="inv.id">
                    {{inv.invoice_number}} — {{inv.total | number:'1.2-2'}} {{inv.currency}}
                  </mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Payment Date</mat-label>
                <input matInput type="date" [(ngModel)]="paymentForm.payment_date">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Reference / Transaction ID</mat-label>
                <input matInput [(ngModel)]="paymentForm.reference" placeholder="TXN-12345">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Notes</mat-label>
                <input matInput [(ngModel)]="paymentForm.notes">
              </mat-form-field>
            </div>

            <div class="pf-actions">
              <button mat-button (click)="closePaymentForm()">Cancel</button>
              <button mat-raised-button color="primary" (click)="submitPayment()"
                      [disabled]="savingPayment() || !paymentForm.amount || paymentForm.amount <= 0">
                <mat-progress-spinner *ngIf="savingPayment()" diameter="16" mode="indeterminate" style="display:inline-block"/>
                <span *ngIf="!savingPayment()">Save Payment</span>
              </button>
            </div>
          </div>

          <mat-divider *ngIf="showPaymentForm()"/>

          <table mat-table [dataSource]="payments()">
            <ng-container matColumnDef="amount">
              <th mat-header-cell *matHeaderCellDef>Amount</th>
              <td mat-cell *matCellDef="let p"><strong>{{p.amount | number:'1.2-2'}} {{p.currency}}</strong></td>
            </ng-container>
            <ng-container matColumnDef="type">
              <th mat-header-cell *matHeaderCellDef>Type</th>
              <td mat-cell *matCellDef="let p">
                <span class="type-badge" [class]="p.payment_type === 'Incoming' ? 'type-in' : 'type-out'">{{p.payment_type}}</span>
              </td>
            </ng-container>
            <ng-container matColumnDef="method">
              <th mat-header-cell *matHeaderCellDef>Method</th>
              <td mat-cell *matCellDef="let p">{{p.method}}</td>
            </ng-container>
            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Status</th>
              <td mat-cell *matCellDef="let p">
                <span class="status-pill" [class]="p.status === 'Cleared' ? 'status-approved' : p.status === 'Failed' ? 'status-cancelled' : 'status-pending'">{{p.status}}</span>
              </td>
            </ng-container>
            <ng-container matColumnDef="reference">
              <th mat-header-cell *matHeaderCellDef>Reference</th>
              <td mat-cell *matCellDef="let p">{{p.reference || '—'}}</td>
            </ng-container>
            <ng-container matColumnDef="date">
              <th mat-header-cell *matHeaderCellDef>Date</th>
              <td mat-cell *matCellDef="let p">{{p.created_at | date:'dd/MM/yyyy'}}</td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="paymentCols"></tr>
            <tr mat-row *matRowDef="let row; columns:paymentCols" class="table-row"></tr>
          </table>
          <div *ngIf="payments().length === 0" class="empty-state">
            <mat-icon>payments</mat-icon>
            <p>No payments recorded yet</p>
          </div>
        </mat-tab>

      </mat-tab-group>
    </div>
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
    .page-header h1 { margin: 0; font-size: 26px; font-weight: 700; color: #1e3870; }
    .subtitle { margin: 4px 0 0; color: #888; font-size: 13px; }
    .header-actions { display: flex; gap: 10px; }

    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 20px; }
    .kpi-card { background: white; border-radius: 12px; padding: 16px 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); border-left: 4px solid #ccc; display: flex; align-items: center; gap: 14px; }
    .kpi-icon { font-size: 32px; width: 32px; height: 32px; flex-shrink: 0; }
    .kpi-label { font-size: 11px; font-weight: 600; color: #888; text-transform: uppercase; margin-bottom: 4px; }
    .kpi-value { font-size: 24px; font-weight: 800; color: #1e3870; }

    .mams-card { border-radius: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); overflow: hidden; }
    .tab-filters { display: flex; gap: 12px; padding: 16px 20px; background: #fafafa; flex-wrap: wrap; }
    .tab-filters mat-form-field { min-width: 140px; }

    /* Payment form */
    .payment-form-bar { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; background: #fafafa; border-bottom: 1px solid #f0f0f0; }
    .payment-form-panel { padding: 20px; background: #f8f9ff; border-bottom: 1px solid #e0e7ff; }
    .pf-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; font-size: 14px; font-weight: 700; color: #1e3870; }
    .pf-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
    .pf-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 12px; }

    .inv-link { color: #1e3870; }
    .type-badge { font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 20px; }
    .type-in { background: #e8f5e9; color: #2e7d32; }
    .type-out { background: #fff3e0; color: #e65100; }

    .inv-draft { background: #f5f5f5 !important; color: #757575 !important; }
    .inv-sent { background: #e3f2fd !important; color: #1565c0 !important; }
    .inv-paid { background: #e8f5e9 !important; color: #2e7d32 !important; }
    .inv-overdue { background: #fce4ec !important; color: #c62828 !important; }
    .inv-cancelled { background: #f5f5f5 !important; color: #bdbdbd !important; }

    .text-danger { color: #c62828; font-weight: 600; }
    .table-row { cursor: pointer; transition: background 0.15s; }
    .table-row:hover { background: #f5f7fa; }
    .empty-state { display: flex; flex-direction: column; align-items: center; padding: 48px; color: #aaa; gap: 12px; }
    .empty-state mat-icon { font-size: 48px; width: 48px; height: 48px; color: #ddd; }
  `]
})
export class FinanceComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private router = inject(Router);

  invoices = signal<Invoice[]>([]);
  payments = signal<Payment[]>([]);
  kpis = signal<any>(null);

  // Payment recording
  showPaymentForm = signal(false);
  savingPayment = signal(false);
  paymentForm = {
    payment_type: 'Incoming',
    method: 'Bank Transfer',
    amount: 0,
    currency: 'USD',
    invoice_id: '',
    payment_date: '',
    reference: '',
    notes: ''
  };

  invoiceFilters = { status: '', type: '', dateFrom: '', dateTo: '' };
  invoiceStatuses = ['Draft','Sent','Paid','Overdue','Cancelled'];
  invoiceCols = ['invoice_number','type','status','total','due_date','created','actions'];
  paymentCols = ['amount','type','method','status','reference','date'];
  paymentMethods = ['Bank Transfer','Credit Card','Cash','Cheque','Wire Transfer','Other'];
  currencies = ['EUR','USD','EGP','AED'];

  ngOnInit() { this.loadInvoices(); this.loadPayments(); this.loadKPIs(); }

  loadInvoices() {
    const p: any = {};
    if (this.invoiceFilters.status) p.status = this.invoiceFilters.status;
    if (this.invoiceFilters.type) p.invoice_type = this.invoiceFilters.type;
    if (this.invoiceFilters.dateFrom) p.date_from = this.invoiceFilters.dateFrom;
    if (this.invoiceFilters.dateTo) p.date_to = this.invoiceFilters.dateTo;
    this.api.get<Invoice[]>('/finance/invoices', p).subscribe(i => this.invoices.set(i));
  }
  loadPayments() { this.api.get<Payment[]>('/finance/payments').subscribe(p => this.payments.set(p)); }
  loadKPIs() { this.api.get<any>('/finance/kpis').subscribe(k => this.kpis.set(k)); }

  overdueCount() { return this.invoices().filter(i => this.isOverdue(i)).length; }
  isOverdue(inv: Invoice): boolean {
    return !!inv.due_date && inv.status !== 'Paid' && inv.status !== 'Cancelled' && new Date(inv.due_date) < new Date();
  }

  openInvoice(inv: Invoice) { this.router.navigate(['/finance/invoices', inv.id]); }

  quickStatus(inv: Invoice, status: string) {
    this.api.put<Invoice>(`/finance/invoices/${inv.id}`, { status }).subscribe({
      next: () => { this.toast.success(`Invoice marked as ${status}`); this.loadInvoices(); this.loadKPIs(); },
      error: () => this.toast.error('Failed to update invoice')
    });
  }

  openPaymentForm(inv: Invoice) {
    this.paymentForm.invoice_id = inv.id;
    this.paymentForm.amount = inv.total;
    this.paymentForm.currency = inv.currency;
    this.paymentForm.payment_type = inv.invoice_type === 'Incoming' ? 'Incoming' : 'Outgoing';
    this.showPaymentForm.set(true);
  }

  closePaymentForm() {
    this.showPaymentForm.set(false);
    this.resetPaymentForm();
  }

  resetPaymentForm() {
    this.paymentForm = { payment_type: 'Incoming', method: 'Bank Transfer', amount: 0, currency: 'USD', invoice_id: '', payment_date: '', reference: '', notes: '' };
  }

  submitPayment() {
    if (!this.paymentForm.amount || this.paymentForm.amount <= 0) {
      this.toast.error('Amount must be greater than 0');
      return;
    }
    this.savingPayment.set(true);
    const payload: any = {
      payment_type: this.paymentForm.payment_type,
      method: this.paymentForm.method,
      amount: this.paymentForm.amount,
      currency: this.paymentForm.currency,
      invoice_id: this.paymentForm.invoice_id || null,
      reference: this.paymentForm.reference || null,
      notes: this.paymentForm.notes || null,
      payment_date: this.paymentForm.payment_date ? new Date(this.paymentForm.payment_date).toISOString() : null
    };
    this.api.post<any>('/finance/payments', payload).subscribe({
      next: () => {
        this.toast.success('Payment recorded successfully');
        this.savingPayment.set(false);
        this.closePaymentForm();
        this.loadPayments();
        this.loadKPIs();
      },
      error: (e) => { this.toast.error(e.error?.detail || 'Failed to record payment'); this.savingPayment.set(false); }
    });
  }

  exportInvoices() {
    this.api.download('/finance/invoices/export/excel').subscribe(blob => {
      const url = URL.createObjectURL(blob); const a = document.createElement('a');
      a.href = url; a.download = 'invoices.xlsx'; a.click();
    });
  }
}
