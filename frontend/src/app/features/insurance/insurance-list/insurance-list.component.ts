import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-insurance-list',
  standalone: true,
  imports: [
    CommonModule, RouterLink, FormsModule, ReactiveFormsModule,
    MatTableModule, MatButtonModule, MatIconModule, MatInputModule,
    MatSelectModule, MatTooltipModule, MatDialogModule, MatFormFieldModule, MatCheckboxModule
  ],
  template: `
    <div>
      <div class="page-header">
        <div>
          <h1><mat-icon class="header-icon">health_and_safety</mat-icon> Insurance Companies</h1>
          <p class="subtitle">{{ companies().length }} insurance companies</p>
        </div>
        <div class="header-actions">
          <button mat-stroked-button (click)="exportExcel()">
            <mat-icon>download</mat-icon> Export
          </button>
          <button mat-raised-button color="primary" (click)="openAddDialog()">
            <mat-icon>add</mat-icon> Add Company
          </button>
        </div>
      </div>

      <!-- Filters -->
      <div class="mams-card filters-bar">
        <mat-form-field appearance="outline" class="search-field">
          <mat-label>Search</mat-label>
          <mat-icon matPrefix>search</mat-icon>
          <input matInput [(ngModel)]="search" (ngModelChange)="load()" placeholder="Name, email, contact…">
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Country</mat-label>
          <mat-select [(ngModel)]="countryFilter" (ngModelChange)="load()">
            <mat-option value="">All Countries</mat-option>
            <mat-option *ngFor="let c of countries" [value]="c">{{ c }}</mat-option>
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Status</mat-label>
          <mat-select [(ngModel)]="activeFilter" (ngModelChange)="load()">
            <mat-option value="">All</mat-option>
            <mat-option value="true">Active</mat-option>
            <mat-option value="false">Inactive</mat-option>
          </mat-select>
        </mat-form-field>
      </div>

      <!-- Table -->
      <div class="table-card">
        <table mat-table [dataSource]="companies()">
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>Company Name</th>
            <td mat-cell *matCellDef="let c">
              <a [routerLink]="['/insurance', c.id]" class="company-link">
                <div class="company-avatar">{{ c.name.charAt(0) }}</div>
                <div>
                  <div class="company-name">{{ c.name }}</div>
                  <div class="company-meta" *ngIf="c.website">{{ c.website }}</div>
                </div>
              </a>
            </td>
          </ng-container>

          <ng-container matColumnDef="contact">
            <th mat-header-cell *matHeaderCellDef>Contact</th>
            <td mat-cell *matCellDef="let c">
              <div>{{ c.contact_name || '—' }}</div>
              <div class="meta-text" *ngIf="c.email">{{ c.email }}</div>
            </td>
          </ng-container>

          <ng-container matColumnDef="phone">
            <th mat-header-cell *matHeaderCellDef>Phone</th>
            <td mat-cell *matCellDef="let c">{{ c.phone || '—' }}</td>
          </ng-container>

          <ng-container matColumnDef="country">
            <th mat-header-cell *matHeaderCellDef>Country</th>
            <td mat-cell *matCellDef="let c">{{ c.country || '—' }}</td>
          </ng-container>

          <ng-container matColumnDef="cases">
            <th mat-header-cell *matHeaderCellDef>Cases</th>
            <td mat-cell *matCellDef="let c">
              <span class="badge-count">{{ c.total_cases }}</span>
            </td>
          </ng-container>

          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>Status</th>
            <td mat-cell *matCellDef="let c">
              <span class="status-pill" [class]="c.is_active ? 'status-approved' : 'status-cancelled'">
                {{ c.is_active ? 'Active' : 'Inactive' }}
              </span>
            </td>
          </ng-container>

          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef>Actions</th>
            <td mat-cell *matCellDef="let c">
              <button mat-icon-button [routerLink]="['/insurance', c.id]" matTooltip="View Details">
                <mat-icon>visibility</mat-icon>
              </button>
              <button mat-icon-button color="warn" (click)="deleteCompany(c)" matTooltip="Deactivate">
                <mat-icon>delete</mat-icon>
              </button>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="cols"></tr>
          <tr mat-row *matRowDef="let row; columns: cols" class="table-row"></tr>
        </table>

        <div *ngIf="companies().length === 0" class="empty-state">
          <mat-icon>health_and_safety</mat-icon>
          <h3>No insurance companies found</h3>
          <p>Add your first insurance company to get started.</p>
          <button mat-raised-button color="primary" (click)="openAddDialog()">
            <mat-icon>add</mat-icon> Add Company
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px; }
    .page-header h1 { margin:0; font-size:26px; font-weight:700; color:#1e3870; display:flex; align-items:center; gap:10px; }
    .header-icon { font-size:28px; width:28px; height:28px; color:#1e3870; }
    .subtitle { margin:4px 0 0; color:#888; font-size:13px; }
    .header-actions { display:flex; gap:10px; }
    .filters-bar { display:flex; gap:12px; flex-wrap:wrap; padding:16px 20px; margin-bottom:16px; }
    .search-field { flex:1; min-width:200px; }
    .table-card { background:white; border-radius:12px; box-shadow:0 1px 4px rgba(0,0,0,0.08); overflow:hidden; }
    .table-row:hover { background:#f8f9fa; }
    .company-link { display:flex; align-items:center; gap:12px; text-decoration:none; color:inherit; }
    .company-avatar { width:36px; height:36px; border-radius:50%; background:#1e3870; color:white; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:14px; flex-shrink:0; }
    .company-name { font-weight:600; color:#1e3870; font-size:14px; }
    .company-meta { font-size:11px; color:#888; }
    .meta-text { font-size:11px; color:#888; }
    .badge-count { background:#e8eaf6; color:#1e3870; padding:2px 8px; border-radius:12px; font-size:12px; font-weight:600; }
    .empty-state { display:flex; flex-direction:column; align-items:center; padding:60px 20px; color:#aaa; gap:12px; }
    .empty-state mat-icon { font-size:56px; width:56px; height:56px; }
    .empty-state h3 { margin:0; color:#555; }
    .empty-state p { margin:0; font-size:13px; }
  `]
})
export class InsuranceListComponent implements OnInit {
  private api    = inject(ApiService);
  private toast  = inject(ToastService);
  private dialog = inject(MatDialog);

  companies = signal<any[]>([]);
  search = '';
  countryFilter = '';
  activeFilter = '';

  countries = ['Egypt', 'Germany', 'Spain', 'UAE', 'USA', 'Other'];
  cols = ['name', 'contact', 'phone', 'country', 'cases', 'status', 'actions'];

  ngOnInit() { this.load(); }

  load() {
    const p: any = {};
    if (this.search)        p.search    = this.search;
    if (this.countryFilter) p.country   = this.countryFilter;
    if (this.activeFilter)  p.is_active = this.activeFilter;
    this.api.get<any[]>('/insurance-companies', p).subscribe(list => this.companies.set(list));
  }

  openAddDialog() {
    const ref = this.dialog.open(InsuranceFormDialogComponent, {
      width: '560px',
      disableClose: true
    });
    ref.afterClosed().subscribe(result => {
      if (result) this.load();
    });
  }

  deleteCompany(c: any) {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Deactivate Insurance Company',
        message: `Deactivate "${c.name}"? The company will be marked inactive and hidden from dropdowns.`,
        confirmLabel: 'Deactivate',
        danger: true
      }
    });
    ref.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.api.delete(`/insurance-companies/${c.id}`).subscribe({
        next: () => { this.toast.success('Company deactivated'); this.load(); },
        error: () => this.toast.error('Failed to deactivate company')
      });
    });
  }

  exportExcel() {
    this.api.download('/insurance-companies/export/excel').subscribe(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'insurance_companies.xlsx'; a.click();
      URL.revokeObjectURL(url);
    });
  }
}


// ── Add/Edit dialog ──────────────────────────────────────────────────────────

@Component({
  selector: 'app-insurance-form-dialog',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule,
    MatButtonModule, MatIconModule, MatInputModule,
    MatSelectModule, MatFormFieldModule, MatDialogModule, MatCheckboxModule
  ],
  template: `
    <h2 mat-dialog-title>{{ data?.id ? 'Edit' : 'Add' }} Insurance Company</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="form-grid">
        <mat-form-field appearance="outline" class="full">
          <mat-label>Company Name *</mat-label>
          <input matInput formControlName="name">
          <mat-error *ngIf="form.get('name')?.invalid">Name is required</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Contact Person</mat-label>
          <input matInput formControlName="contact_name">
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Country</mat-label>
          <mat-select formControlName="country">
            <mat-option value="">— None —</mat-option>
            <mat-option *ngFor="let c of countries" [value]="c">{{ c }}</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Email</mat-label>
          <input matInput formControlName="email" type="email">
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Phone</mat-label>
          <input matInput formControlName="phone">
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Fax</mat-label>
          <input matInput formControlName="fax">
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Website</mat-label>
          <input matInput formControlName="website" placeholder="https://…">
        </mat-form-field>

        <mat-form-field appearance="outline" class="full">
          <mat-label>Address</mat-label>
          <input matInput formControlName="address">
        </mat-form-field>

        <mat-form-field appearance="outline" class="full">
          <mat-label>Notes / Details</mat-label>
          <textarea matInput formControlName="notes" rows="4" placeholder="Coverage types, special terms, key contacts…"></textarea>
        </mat-form-field>

        <div class="full">
          <mat-checkbox formControlName="is_active">Active</mat-checkbox>
        </div>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-raised-button color="primary" [disabled]="form.invalid || saving()" (click)="submit()">
        <mat-icon>save</mat-icon> {{ saving() ? 'Saving…' : 'Save' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .form-grid { display:grid; grid-template-columns:1fr 1fr; gap:0 16px; padding-top:8px; }
    .full { grid-column: 1 / -1; }
    mat-form-field { width:100%; }
  `]
})
export class InsuranceFormDialogComponent {
  private api    = inject(ApiService);
  private toast  = inject(ToastService);
  private dialogRef = inject(MatDialogRef<InsuranceFormDialogComponent>);
  data = inject(MAT_DIALOG_DATA, { optional: true });

  saving = signal(false);
  countries = ['Egypt', 'Germany', 'Spain', 'UAE', 'USA', 'Other'];

  form = inject(FormBuilder).group({
    name:         [this.data?.name         || '', Validators.required],
    contact_name: [this.data?.contact_name || ''],
    email:        [this.data?.email        || ''],
    phone:        [this.data?.phone        || ''],
    fax:          [this.data?.fax          || ''],
    website:      [this.data?.website      || ''],
    address:      [this.data?.address      || ''],
    country:      [this.data?.country      || ''],
    notes:        [this.data?.notes        || ''],
    is_active:    [this.data?.is_active ?? true],
    client_type:  ['Insurance Company'],
    pipeline_stage: [this.data?.pipeline_stage || 'Won'],
  });

  submit() {
    if (this.form.invalid) return;
    this.saving.set(true);
    const payload = this.form.value;
    const req = this.data?.id
      ? this.api.put(`/insurance-companies/${this.data.id}`, payload)
      : this.api.post('/insurance-companies', payload);
    req.subscribe({
      next: () => {
        this.toast.success(this.data?.id ? 'Company updated' : 'Company created');
        this.dialogRef.close(true);
      },
      error: () => { this.toast.error('Failed to save'); this.saving.set(false); }
    });
  }
}
