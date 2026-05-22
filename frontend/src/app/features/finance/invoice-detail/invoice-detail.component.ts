import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatTableModule } from '@angular/material/table';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { Invoice } from '../../../core/models/finance.model';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-invoice-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, MatButtonModule, MatIconModule, MatDividerModule,
            MatTableModule, MatDialogModule, MatTooltipModule],
  template: `
    <div *ngIf="invoice()" class="invoice-page">

      <!-- Header -->
      <div class="detail-header">
        <button mat-icon-button routerLink="/finance"><mat-icon>arrow_back</mat-icon></button>
        <div>
          <h1>{{invoice()!.invoice_number}}</h1>
          <p class="subtitle">{{invoice()!.invoice_type}} Invoice &nbsp;·&nbsp; Created {{invoice()!.created_at | date:'dd MMM yyyy'}}</p>
        </div>
        <span class="status-pill" [class]="'inv-' + invoice()!.status.toLowerCase()">{{invoice()!.status}}</span>
        <div style="flex:1"></div>
        <div class="header-actions">
          <button mat-stroked-button (click)="printInvoice()"><mat-icon>print</mat-icon> Print</button>
          <button mat-raised-button color="accent" *ngIf="invoice()!.status === 'Draft'"
                  (click)="updateStatus('Sent')">
            <mat-icon>send</mat-icon> Send Invoice
          </button>
          <button mat-raised-button color="primary" *ngIf="invoice()!.status === 'Sent' || invoice()!.status === 'Overdue'"
                  (click)="updateStatus('Paid')">
            <mat-icon>check_circle</mat-icon> Mark Paid
          </button>
          <button mat-stroked-button color="warn" *ngIf="invoice()!.status !== 'Paid' && invoice()!.status !== 'Cancelled'"
                  (click)="cancelInvoice()">
            <mat-icon>cancel</mat-icon> Cancel
          </button>
        </div>
      </div>

      <!-- Invoice card (printable) -->
      <div class="invoice-card mams-card" id="printable-invoice">

        <!-- Invoice header -->
        <div class="inv-header">
          <div class="inv-from">
            <div class="company-name">TMASI Global</div>
            <div class="company-sub">Medical Assistance Management</div>
          </div>
          <div class="inv-meta">
            <div class="inv-number">{{invoice()!.invoice_number}}</div>
            <table class="meta-table">
              <tr><td>Type</td><td>{{invoice()!.invoice_type}}</td></tr>
              <tr><td>Status</td><td><span class="status-pill" [class]="'inv-' + invoice()!.status.toLowerCase()">{{invoice()!.status}}</span></td></tr>
              <tr *ngIf="invoice()!.due_date"><td>Due</td><td class="due-date" [class.overdue]="isOverdue()">{{invoice()!.due_date | date:'dd MMM yyyy'}}</td></tr>
              <tr *ngIf="invoice()!.paid_date"><td>Paid</td><td style="color:#2e7d32">{{invoice()!.paid_date | date:'dd MMM yyyy'}}</td></tr>
            </table>
          </div>
        </div>

        <mat-divider style="margin:20px 0"/>

        <!-- Line items -->
        <table mat-table [dataSource]="invoice()!.line_items" class="line-items-table">
          <ng-container matColumnDef="description">
            <th mat-header-cell *matHeaderCellDef>Description</th>
            <td mat-cell *matCellDef="let item">{{item.description}}</td>
          </ng-container>
          <ng-container matColumnDef="qty">
            <th mat-header-cell *matHeaderCellDef class="text-right">Qty</th>
            <td mat-cell *matCellDef="let item" class="text-right">{{item.quantity}}</td>
          </ng-container>
          <ng-container matColumnDef="unit_price">
            <th mat-header-cell *matHeaderCellDef class="text-right">Unit Price</th>
            <td mat-cell *matCellDef="let item" class="text-right">{{item.unit_price | number:'1.2-2'}}</td>
          </ng-container>
          <ng-container matColumnDef="amount">
            <th mat-header-cell *matHeaderCellDef class="text-right">Amount</th>
            <td mat-cell *matCellDef="let item" class="text-right"><strong>{{item.amount | number:'1.2-2'}}</strong></td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="lineCols"></tr>
          <tr mat-row *matRowDef="let row; columns:lineCols"></tr>
        </table>

        <!-- Totals -->
        <div class="totals-section">
          <div class="total-row"><span>Subtotal</span><span>{{invoice()!.subtotal | number:'1.2-2'}} {{invoice()!.currency}}</span></div>
          <div class="total-row" *ngIf="invoice()!.tax_rate > 0">
            <span>Tax ({{invoice()!.tax_rate}}%)</span>
            <span>{{invoice()!.tax_amount | number:'1.2-2'}} {{invoice()!.currency}}</span>
          </div>
          <mat-divider style="margin:8px 0"/>
          <div class="total-row total-final">
            <span>Total</span>
            <span>{{invoice()!.total | number:'1.2-2'}} {{invoice()!.currency}}</span>
          </div>
        </div>

        <!-- Notes -->
        <div class="notes-section" *ngIf="invoice()!.notes">
          <strong>Notes:</strong>
          <p>{{invoice()!.notes}}</p>
        </div>
      </div>

      <!-- Status timeline -->
      <div class="mams-card timeline-card">
        <div class="timeline-title">Status Workflow</div>
        <div class="timeline">
          <div class="timeline-step" *ngFor="let s of statusFlow; let last = last"
               [class.done]="isStatusDone(s)"
               [class.current]="invoice()!.status === s">
            <div class="step-dot"><mat-icon>{{isStatusDone(s) ? 'check' : 'radio_button_unchecked'}}</mat-icon></div>
            <div class="step-label">{{s}}</div>
            <div class="step-line" *ngIf="!last"></div>
          </div>
        </div>
      </div>
    </div>

    <div *ngIf="!invoice()" class="loading-center">
      <mat-icon style="font-size:48px;color:#ddd">receipt</mat-icon>
      <p style="color:#aaa">Loading invoice…</p>
    </div>
  `,
  styles: [`
    .invoice-page { max-width: 900px; }
    .detail-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
    .detail-header h1 { margin: 0; font-size: 24px; font-weight: 700; color: #1e3870; }
    .subtitle { margin: 4px 0 0; color: #888; font-size: 13px; }
    .header-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .mams-card { background: white; border-radius: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); padding: 28px; margin-bottom: 16px; }

    /* Invoice status pills */
    .inv-draft { background: #f5f5f5 !important; color: #757575 !important; }
    .inv-sent { background: #e3f2fd !important; color: #1565c0 !important; }
    .inv-paid { background: #e8f5e9 !important; color: #2e7d32 !important; }
    .inv-overdue { background: #fce4ec !important; color: #c62828 !important; }
    .inv-cancelled { background: #f5f5f5 !important; color: #bdbdbd !important; }

    /* Invoice layout */
    .inv-header { display: flex; justify-content: space-between; align-items: flex-start; }
    .company-name { font-size: 22px; font-weight: 800; color: #1e3870; }
    .company-sub { font-size: 12px; color: #888; margin-top: 4px; }
    .inv-number { font-size: 20px; font-weight: 700; color: #c9a84c; text-align: right; margin-bottom: 12px; }
    .meta-table { border-collapse: collapse; font-size: 13px; }
    .meta-table td { padding: 4px 8px; color: #555; }
    .meta-table td:first-child { color: #999; font-weight: 600; text-align: right; }
    .due-date { color: #333; }
    .due-date.overdue { color: #c62828; font-weight: 700; }

    /* Line items */
    .line-items-table { width: 100%; }
    .text-right { text-align: right !important; }

    /* Totals */
    .totals-section { display: flex; flex-direction: column; align-items: flex-end; margin-top: 20px; gap: 6px; min-width: 260px; margin-left: auto; }
    .total-row { display: flex; justify-content: space-between; gap: 60px; font-size: 14px; color: #555; width: 260px; }
    .total-final { font-size: 18px; font-weight: 800; color: #1e3870; margin-top: 4px; }

    /* Notes */
    .notes-section { margin-top: 20px; padding: 12px 16px; background: #f8f9fa; border-radius: 8px; font-size: 13px; color: #555; }
    .notes-section p { margin: 6px 0 0; }

    /* Timeline */
    .timeline-card { padding: 20px 28px; }
    .timeline-title { font-size: 13px; font-weight: 600; color: #1e3870; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.5px; }
    .timeline { display: flex; align-items: center; }
    .timeline-step { display: flex; flex-direction: column; align-items: center; position: relative; flex: 1; }
    .step-dot { width: 32px; height: 32px; border-radius: 50%; border: 2px solid #e0e0e0; display: flex; align-items: center; justify-content: center; background: white; color: #bbb; }
    .step-dot mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .timeline-step.done .step-dot { background: #e8f5e9; border-color: #2e7d32; color: #2e7d32; }
    .timeline-step.current .step-dot { background: #1e3870; border-color: #1e3870; color: white; }
    .step-label { font-size: 11px; font-weight: 600; color: #aaa; margin-top: 6px; text-transform: uppercase; }
    .timeline-step.done .step-label, .timeline-step.current .step-label { color: #1e3870; }
    .step-line { position: absolute; top: 16px; left: 50%; width: 100%; height: 2px; background: #e0e0e0; z-index: 0; }
    .timeline-step.done .step-line { background: #2e7d32; }

    .loading-center { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px; gap: 16px; }

    @media print {
      .detail-header button, .header-actions, .timeline-card { display: none !important; }
      .invoice-page { max-width: 100%; }
    }
  `]
})
export class InvoiceDetailComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private dialog = inject(MatDialog);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  invoice = signal<Invoice | null>(null);
  lineCols = ['description','qty','unit_price','amount'];
  statusFlow = ['Draft','Sent','Paid'];

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.api.get<Invoice>(`/finance/invoices/${id}`).subscribe(i => this.invoice.set(i));
  }

  isOverdue(): boolean {
    const inv = this.invoice();
    if (!inv?.due_date || inv.status === 'Paid') return false;
    return new Date(inv.due_date) < new Date();
  }

  isStatusDone(status: string): boolean {
    const order = ['Draft','Sent','Paid'];
    const current = this.invoice()?.status || 'Draft';
    return order.indexOf(status) < order.indexOf(current);
  }

  updateStatus(status: string) {
    const inv = this.invoice()!;
    this.api.put<Invoice>(`/finance/invoices/${inv.id}`, { status }).subscribe({
      next: (updated) => { this.invoice.set(updated); this.toast.success(`Invoice marked as ${status}`); },
      error: () => this.toast.error('Failed to update status')
    });
  }

  cancelInvoice() {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: { title: 'Cancel Invoice', message: 'Cancel this invoice? This cannot be undone.', confirmLabel: 'Cancel Invoice', danger: true }
    });
    ref.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.updateStatus('Cancelled');
    });
  }

  printInvoice() { window.print(); }
}
