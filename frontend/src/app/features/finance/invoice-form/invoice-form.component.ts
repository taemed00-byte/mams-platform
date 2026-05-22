import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, Validators, ReactiveFormsModule, FormArray } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-invoice-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, MatInputModule, MatSelectModule,
            MatButtonModule, MatIconModule, MatCardModule, MatDividerModule, MatProgressSpinnerModule],
  template: `
    <div class="form-page">
      <div class="form-header">
        <button mat-icon-button routerLink="/finance"><mat-icon>arrow_back</mat-icon></button>
        <div><h1>New Invoice</h1><p class="subtitle">Create invoice and add line items</p></div>
      </div>

      <div class="mams-card" style="padding:28px">
        <form [formGroup]="form" (ngSubmit)="onSubmit()">

          <!-- Section: Invoice Details -->
          <div class="section-title"><mat-icon>receipt</mat-icon> Invoice Details</div>
          <div class="form-grid">

            <mat-form-field appearance="outline">
              <mat-label>Invoice Type *</mat-label>
              <mat-select formControlName="invoice_type">
                <mat-option value="Incoming">Incoming (from client)</mat-option>
                <mat-option value="Outgoing">Outgoing (to provider)</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Currency</mat-label>
              <mat-select formControlName="currency">
                <mat-option *ngFor="let c of currencies" [value]="c">{{c}}</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Tax Rate (%)</mat-label>
              <input matInput type="number" formControlName="tax_rate" min="0" max="100" (input)="recalcTotals()">
              <mat-error *ngIf="form.get('tax_rate')?.hasError('min')">Must be ≥ 0</mat-error>
              <mat-error *ngIf="form.get('tax_rate')?.hasError('max')">Must be ≤ 100</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Due Date</mat-label>
              <input matInput type="date" formControlName="due_date">
            </mat-form-field>

          </div>

          <!-- Section: Links -->
          <div class="section-title" style="margin-top:20px"><mat-icon>link</mat-icon> Link to (optional)</div>
          <div class="form-grid">

            <mat-form-field appearance="outline">
              <mat-label>Client</mat-label>
              <mat-select formControlName="client_id">
                <mat-option value="">— None —</mat-option>
                <mat-option *ngFor="let c of clients()" [value]="c.id">{{c.name}}</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Case #</mat-label>
              <mat-select formControlName="case_id">
                <mat-option value="">— None —</mat-option>
                <mat-option *ngFor="let c of cases()" [value]="c.id">{{c.case_number}} — {{c.patient?.name}}</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Provider</mat-label>
              <mat-select formControlName="provider_id">
                <mat-option value="">— None —</mat-option>
                <mat-option *ngFor="let p of providers()" [value]="p.id">{{p.name}}</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-col">
              <mat-label>Notes</mat-label>
              <textarea matInput formControlName="notes" rows="2"></textarea>
            </mat-form-field>

          </div>

          <!-- Section: Line Items -->
          <mat-divider style="margin:24px 0"/>
          <div class="line-items-header">
            <div class="section-title" style="margin:0"><mat-icon>list</mat-icon> Line Items</div>
            <button mat-stroked-button type="button" (click)="addLineItem()">
              <mat-icon>add</mat-icon> Add Item
            </button>
          </div>

          <div formArrayName="line_items">
            <div *ngFor="let item of lineItems.controls; let i = index" [formGroupName]="i" class="line-item-row">
              <mat-form-field appearance="outline" style="flex:2">
                <mat-label>Description *</mat-label>
                <input matInput formControlName="description">
                <mat-error>Required</mat-error>
              </mat-form-field>
              <mat-form-field appearance="outline" style="flex:0.6">
                <mat-label>Qty</mat-label>
                <input matInput type="number" formControlName="quantity" min="0.01" (input)="calcAmount(i)">
              </mat-form-field>
              <mat-form-field appearance="outline" style="flex:1">
                <mat-label>Unit Price</mat-label>
                <input matInput type="number" formControlName="unit_price" min="0" (input)="calcAmount(i)">
              </mat-form-field>
              <mat-form-field appearance="outline" style="flex:1">
                <mat-label>Amount</mat-label>
                <input matInput type="number" formControlName="amount" readonly>
              </mat-form-field>
              <button mat-icon-button type="button" (click)="removeLineItem(i)" color="warn"
                      [disabled]="lineItems.length === 1">
                <mat-icon>delete</mat-icon>
              </button>
            </div>
          </div>

          <!-- Totals -->
          <div class="invoice-totals">
            <div class="total-row"><span>Subtotal:</span><strong>{{subtotal() | number:'1.2-2'}} {{form.get('currency')?.value}}</strong></div>
            <div class="total-row" *ngIf="(form.get('tax_rate')?.value || 0) > 0">
              <span>Tax ({{form.get('tax_rate')?.value}}%):</span>
              <strong>{{taxAmount() | number:'1.2-2'}}</strong>
            </div>
            <div class="total-row total-final">
              <span>Total:</span>
              <strong>{{total() | number:'1.2-2'}} {{form.get('currency')?.value}}</strong>
            </div>
          </div>

          <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:24px">
            <button mat-button type="button" routerLink="/finance">Cancel</button>
            <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid || loading()">
              <mat-progress-spinner *ngIf="loading()" diameter="18" mode="indeterminate" style="display:inline-block"/>
              <span *ngIf="!loading()">Create Invoice</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .form-page { max-width: 960px; }
    .form-header { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
    .form-header h1 { margin: 0; font-size: 24px; font-weight: 700; color: #1e3870; }
    .subtitle { margin: 4px 0 0; color: #888; font-size: 13px; }
    .mams-card { background: white; border-radius: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
    .section-title { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 700; color: #1e3870; margin-bottom: 16px; }
    .section-title mat-icon { font-size: 18px; color: #c9a84c; }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .full-col { grid-column: 1 / -1; }
    mat-form-field { width: 100%; }
    .line-items-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
    .line-item-row { display: flex; gap: 10px; align-items: flex-start; margin-bottom: 8px; }
    .invoice-totals { margin-top: 16px; border-top: 2px solid #f0f0f0; padding-top: 16px; display: flex; flex-direction: column; gap: 8px; align-items: flex-end; }
    .total-row { display: flex; justify-content: space-between; gap: 60px; font-size: 14px; min-width: 260px; }
    .total-final { font-size: 20px; font-weight: 800; color: #1e3870; margin-top: 4px; }
  `]
})
export class InvoiceFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private router = inject(Router);
  private toast = inject(ToastService);

  loading = signal(false);
  clients = signal<any[]>([]);
  cases = signal<any[]>([]);
  providers = signal<any[]>([]);
  currencies = ['EUR','USD','EGP','AED'];

  form = this.fb.group({
    invoice_type: ['Incoming', Validators.required],
    currency:     ['USD'],
    tax_rate:     [0, [Validators.min(0), Validators.max(100)]],
    due_date:     [''],
    notes:        [''],
    client_id:    [''],
    case_id:      [''],
    provider_id:  [''],
    line_items:   this.fb.array([this.createLineItem()])
  });

  get lineItems() { return this.form.get('line_items') as FormArray; }
  subtotal = signal(0); taxAmount = signal(0); total = signal(0);

  ngOnInit() {
    this.api.get<any[]>('/clients', { limit: 200 }).subscribe(c => this.clients.set(c));
    this.api.get<any[]>('/cases', { limit: 200 }).subscribe(c => this.cases.set(c));
    this.api.get<any[]>('/providers', { limit: 200 }).subscribe(p => this.providers.set(p));
  }

  createLineItem() {
    return this.fb.group({
      description: ['', Validators.required],
      quantity:    [1, [Validators.min(0.01)]],
      unit_price:  [0, [Validators.min(0)]],
      amount:      [{ value: 0, disabled: true }]
    });
  }
  addLineItem() { this.lineItems.push(this.createLineItem()); }
  removeLineItem(i: number) { if (this.lineItems.length > 1) { this.lineItems.removeAt(i); this.recalcTotals(); } }

  calcAmount(i: number) {
    const item = this.lineItems.at(i);
    const qty = item.get('quantity')?.value || 0;
    const price = item.get('unit_price')?.value || 0;
    item.get('amount')?.setValue(+(qty * price).toFixed(2), { emitEvent: false });
    this.recalcTotals();
  }

  recalcTotals() {
    const sub = this.lineItems.controls.reduce((s, c) => s + (c.get('amount')?.value || 0), 0);
    const tax = sub * ((this.form.get('tax_rate')?.value || 0) / 100);
    this.subtotal.set(+sub.toFixed(2));
    this.taxAmount.set(+tax.toFixed(2));
    this.total.set(+(sub + tax).toFixed(2));
  }

  onSubmit() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.loading.set(true);
    const clean = (v: any) => v === '' ? null : v;
    const raw = this.form.getRawValue();
    const payload = {
      invoice_type: raw.invoice_type,
      currency:     raw.currency,
      tax_rate:     raw.tax_rate,
      due_date:     raw.due_date ? new Date(raw.due_date).toISOString() : null,
      notes:        clean(raw.notes),
      client_id:    clean(raw.client_id),
      case_id:      clean(raw.case_id),
      provider_id:  clean(raw.provider_id),
      line_items:   raw.line_items.map((i: any) => ({
        description: i.description,
        quantity:    i.quantity,
        unit_price:  i.unit_price,
        amount:      i.amount
      }))
    };
    this.api.post<any>('/finance/invoices', payload).subscribe({
      next: (inv) => { this.toast.success('Invoice created'); this.router.navigate(['/finance/invoices', inv.id]); },
      error: (e) => { this.toast.error(e.error?.detail || 'Failed to create invoice'); this.loading.set(false); }
    });
  }
}
