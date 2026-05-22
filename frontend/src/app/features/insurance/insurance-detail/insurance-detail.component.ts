import {
  Component, inject, signal, OnInit
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { InsuranceFormDialogComponent } from '../insurance-list/insurance-list.component';

@Component({
  selector: 'app-insurance-detail',
  standalone: true,
  imports: [
    CommonModule, RouterLink, FormsModule, ReactiveFormsModule,
    MatButtonModule, MatIconModule, MatInputModule, MatSelectModule,
    MatFormFieldModule, MatCheckboxModule, MatTabsModule, MatDialogModule,
    MatTooltipModule, MatProgressSpinnerModule
  ],
  template: `
    <div *ngIf="loading()" class="loading-center">
      <mat-spinner diameter="48"></mat-spinner>
    </div>

    <div *ngIf="!loading() && company()">
      <!-- Header -->
      <div class="page-header">
        <div class="breadcrumb">
          <a routerLink="/insurance" class="back-link">
            <mat-icon>arrow_back</mat-icon> Insurance Companies
          </a>
        </div>
        <div class="title-row">
          <div class="company-avatar-lg">{{ company()!.name.charAt(0) }}</div>
          <div>
            <h1>{{ company()!.name }}</h1>
            <span class="status-pill" [class]="company()!.is_active ? 'status-approved' : 'status-cancelled'">
              {{ company()!.is_active ? 'Active' : 'Inactive' }}
            </span>
          </div>
          <div class="header-actions">
            <button mat-stroked-button (click)="openEditDialog()">
              <mat-icon>edit</mat-icon> Edit
            </button>
            <button mat-stroked-button color="warn" (click)="deactivate()">
              <mat-icon>block</mat-icon> Deactivate
            </button>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <mat-tab-group animationDuration="200ms">

        <!-- Overview Tab -->
        <mat-tab label="Overview">
          <div class="tab-content">
            <div class="detail-grid">

              <!-- Basic Info Card -->
              <div class="mams-card info-card">
                <h3 class="card-title"><mat-icon>business</mat-icon> Company Information</h3>
                <div class="info-rows">
                  <div class="info-row"><span class="label">Name</span><span class="value">{{ company()!.name }}</span></div>
                  <div class="info-row"><span class="label">Country</span><span class="value">{{ company()!.country || '—' }}</span></div>
                  <div class="info-row" *ngIf="company()!.website">
                    <span class="label">Website</span>
                    <a [href]="company()!.website" target="_blank" class="link-val">{{ company()!.website }}</a>
                  </div>
                  <div class="info-row"><span class="label">Address</span><span class="value">{{ company()!.address || '—' }}</span></div>
                  <div class="info-row"><span class="label">Total Cases</span><span class="value badge-count">{{ company()!.total_cases }}</span></div>
                  <div class="info-row"><span class="label">Total Revenue</span><span class="value">\${{ company()!.total_revenue | number:'1.0-0' }}</span></div>
                  <div class="info-row"><span class="label">Added</span><span class="value">{{ company()!.created_at | date:'mediumDate' }}</span></div>
                </div>
              </div>

              <!-- Contact Card -->
              <div class="mams-card info-card">
                <h3 class="card-title"><mat-icon>contact_phone</mat-icon> Contact Details</h3>
                <div class="info-rows">
                  <div class="info-row"><span class="label">Contact Person</span><span class="value">{{ company()!.contact_name || '—' }}</span></div>
                  <div class="info-row">
                    <span class="label">Email</span>
                    <a *ngIf="company()!.email" [href]="'mailto:' + company()!.email" class="link-val">{{ company()!.email }}</a>
                    <span class="value" *ngIf="!company()!.email">—</span>
                  </div>
                  <div class="info-row">
                    <span class="label">Phone</span>
                    <a *ngIf="company()!.phone" [href]="'tel:' + company()!.phone" class="link-val">{{ company()!.phone }}</a>
                    <span class="value" *ngIf="!company()!.phone">—</span>
                  </div>
                  <div class="info-row"><span class="label">Fax</span><span class="value">{{ company()!.fax || '—' }}</span></div>
                </div>
              </div>

              <!-- Notes Card -->
              <div class="mams-card info-card full-width" *ngIf="company()!.notes">
                <h3 class="card-title"><mat-icon>notes</mat-icon> Notes & Details</h3>
                <p class="notes-text">{{ company()!.notes }}</p>
              </div>

            </div>
          </div>
        </mat-tab>

        <!-- Contracts Tab -->
        <mat-tab [label]="'Contracts (' + contracts().length + ')'">
          <div class="tab-content">
            <div class="section-header">
              <h3>Service Contracts</h3>
              <button mat-raised-button color="primary" (click)="openAddContractDialog()">
                <mat-icon>add</mat-icon> Add Contract
              </button>
            </div>

            <div *ngIf="contracts().length === 0" class="empty-state">
              <mat-icon>description</mat-icon>
              <h3>No contracts yet</h3>
              <p>Add a contract to manage terms, SLA, and fees.</p>
            </div>

            <div class="contracts-grid">
              <div class="mams-card contract-card" *ngFor="let ct of contracts()">
                <div class="contract-header">
                  <div>
                    <div class="contract-number">{{ ct.contract_number }}</div>
                    <span class="status-pill" [class]="getContractStatusClass(ct.status)">{{ ct.status }}</span>
                  </div>
                  <div class="contract-actions">
                    <button mat-icon-button matTooltip="Upload Document" (click)="triggerUpload(ct.id)">
                      <mat-icon>upload_file</mat-icon>
                    </button>
                    <button mat-icon-button matTooltip="Download Document" *ngIf="ct.has_document" (click)="downloadContract(ct.id)">
                      <mat-icon>download</mat-icon>
                    </button>
                  </div>
                </div>
                <div class="contract-body">
                  <div class="ct-row"><span>Period</span><strong>{{ ct.start_date || '—' }} → {{ ct.end_date || '—' }}</strong></div>
                  <div class="ct-row"><span>Assistance Fee</span><strong>{{ ct.assistance_fee | number:'1.0-2' }} {{ ct.currency }}</strong></div>
                  <div class="ct-row"><span>SLA Response</span><strong>{{ ct.sla_response_hours }}h</strong></div>
                  <div class="ct-row doc-row">
                    <span>Document</span>
                    <span *ngIf="ct.has_document" class="doc-badge has-doc"><mat-icon>check_circle</mat-icon> On file</span>
                    <span *ngIf="!ct.has_document" class="doc-badge no-doc"><mat-icon>cancel</mat-icon> Missing</span>
                  </div>
                  <div class="ct-row" *ngIf="ct.tariff_notes"><span>Tariff Notes</span><span>{{ ct.tariff_notes }}</span></div>
                  <div class="ct-row" *ngIf="ct.special_terms"><span>Special Terms</span><span>{{ ct.special_terms }}</span></div>
                </div>
                <!-- Hidden file input for each contract -->
                <input type="file"
                  [id]="'upload-' + ct.id"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  style="display:none"
                  (change)="uploadContractDoc($event, ct.id)">
              </div>
            </div>
          </div>
        </mat-tab>

        <!-- Cases Tab -->
        <mat-tab [label]="'Cases (' + company()!.total_cases + ')'">
          <div class="tab-content">
            <div class="empty-state" *ngIf="!cases().length && !casesLoaded()">
              <mat-spinner diameter="32"></mat-spinner>
            </div>
            <div *ngIf="casesLoaded()">
              <div class="empty-state" *ngIf="!cases().length">
                <mat-icon>folder_open</mat-icon>
                <h3>No cases linked</h3>
                <p>Cases using this insurance company will appear here.</p>
              </div>
              <div class="table-card" *ngIf="cases().length">
                <table style="width:100%; border-collapse:collapse;">
                  <thead>
                    <tr class="t-head">
                      <th>Case #</th><th>Patient</th><th>Status</th><th>Priority</th><th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let c of cases()" class="t-row" [routerLink]="['/cases', c.id]" style="cursor:pointer">
                      <td><span class="case-num">{{ c.case_number }}</span></td>
                      <td>{{ c.patient?.name || '—' }}</td>
                      <td><span class="status-pill status-open">{{ c.status }}</span></td>
                      <td>{{ c.priority }}</td>
                      <td>{{ c.created_at | date:'shortDate' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </mat-tab>

      </mat-tab-group>
    </div>

    <div *ngIf="!loading() && !company()" class="empty-state">
      <mat-icon>error_outline</mat-icon>
      <h3>Insurance company not found</h3>
      <button mat-button routerLink="/insurance">Go back</button>
    </div>
  `,
  styles: [`
    .loading-center { display:flex; justify-content:center; align-items:center; height:300px; }
    .page-header { margin-bottom:24px; }
    .breadcrumb { margin-bottom:16px; }
    .back-link { display:inline-flex; align-items:center; gap:4px; color:#1e3870; text-decoration:none; font-size:14px; font-weight:500; }
    .back-link mat-icon { font-size:18px; width:18px; height:18px; }
    .title-row { display:flex; align-items:center; gap:16px; }
    .company-avatar-lg { width:56px; height:56px; border-radius:50%; background:#1e3870; color:white; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:22px; flex-shrink:0; }
    .title-row h1 { margin:0 0 6px; font-size:28px; font-weight:700; color:#1e3870; }
    .header-actions { margin-left:auto; display:flex; gap:10px; }
    .tab-content { padding:24px 0; }
    .detail-grid { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
    .full-width { grid-column:1/-1; }
    .info-card { padding:20px; }
    .card-title { display:flex; align-items:center; gap:8px; margin:0 0 16px; font-size:15px; font-weight:600; color:#1e3870; }
    .card-title mat-icon { font-size:18px; width:18px; height:18px; }
    .info-rows { display:flex; flex-direction:column; gap:10px; }
    .info-row { display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid #f0f0f0; }
    .info-row:last-child { border-bottom:none; }
    .label { color:#888; font-size:13px; }
    .value { font-weight:500; color:#333; font-size:13px; }
    .link-val { color:#1e3870; font-size:13px; text-decoration:none; font-weight:500; }
    .notes-text { color:#555; line-height:1.6; white-space:pre-wrap; }
    .badge-count { background:#e8eaf6; color:#1e3870; padding:2px 8px; border-radius:12px; font-size:12px; font-weight:600; }
    .section-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; }
    .section-header h3 { margin:0; color:#1e3870; font-size:17px; font-weight:600; }
    .contracts-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(320px,1fr)); gap:16px; }
    .contract-card { padding:20px; }
    .contract-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px; }
    .contract-number { font-weight:700; color:#1e3870; font-size:15px; margin-bottom:6px; }
    .contract-actions { display:flex; gap:4px; }
    .contract-body { display:flex; flex-direction:column; gap:8px; }
    .ct-row { display:flex; justify-content:space-between; font-size:13px; color:#555; padding:4px 0; border-bottom:1px solid #f5f5f5; }
    .ct-row:last-child { border-bottom:none; }
    .ct-row span:first-child { color:#888; }
    .doc-row { align-items:center; }
    .doc-badge { display:inline-flex; align-items:center; gap:4px; font-size:12px; font-weight:600; padding:2px 8px; border-radius:12px; }
    .doc-badge mat-icon { font-size:14px; width:14px; height:14px; }
    .has-doc { background:#e8f5e9; color:#2e7d32; }
    .no-doc { background:#fff3e0; color:#e65100; }
    .empty-state { display:flex; flex-direction:column; align-items:center; padding:60px 20px; color:#aaa; gap:12px; }
    .empty-state mat-icon { font-size:56px; width:56px; height:56px; }
    .empty-state h3 { margin:0; color:#555; }
    .empty-state p { margin:0; font-size:13px; }
    .table-card { background:white; border-radius:12px; box-shadow:0 1px 4px rgba(0,0,0,0.08); overflow:hidden; }
    .t-head th { padding:12px 16px; text-align:left; font-size:12px; font-weight:600; color:#888; background:#f8f9fa; text-transform:uppercase; letter-spacing:0.5px; }
    .t-row td { padding:12px 16px; font-size:13px; border-bottom:1px solid #f0f0f0; }
    .t-row:hover td { background:#f8f9fa; }
    .case-num { font-weight:700; color:#1e3870; }
  `]
})
export class InsuranceDetailComponent implements OnInit {
  private route  = inject(ActivatedRoute);
  private router = inject(Router);
  private api    = inject(ApiService);
  private toast  = inject(ToastService);
  private dialog = inject(MatDialog);

  loading    = signal(true);
  company    = signal<any>(null);
  contracts  = signal<any[]>([]);
  cases      = signal<any[]>([]);
  casesLoaded = signal(false);

  private companyId = '';

  ngOnInit() {
    this.companyId = this.route.snapshot.paramMap.get('id') || '';
    this.loadCompany();
    this.loadContracts();
    this.loadCases();
  }

  loadCompany() {
    this.api.get<any>(`/insurance-companies/${this.companyId}`).subscribe({
      next: c => { this.company.set(c); this.loading.set(false); },
      error: () => { this.loading.set(false); }
    });
  }

  loadContracts() {
    this.api.get<any[]>(`/insurance-companies/${this.companyId}/contracts`).subscribe(list => {
      this.contracts.set(list);
    });
  }

  loadCases() {
    this.api.get<any[]>('/cases', { client_id: this.companyId, limit: 200 }).subscribe({
      next: list => { this.cases.set(list); this.casesLoaded.set(true); },
      error: () => this.casesLoaded.set(true)
    });
  }

  openEditDialog() {
    const ref = this.dialog.open(InsuranceFormDialogComponent, {
      width: '560px',
      disableClose: true,
      data: this.company()
    });
    ref.afterClosed().subscribe(result => {
      if (result) this.loadCompany();
    });
  }

  deactivate() {
    const c = this.company();
    if (!c) return;
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Deactivate Insurance Company',
        message: `Deactivate "${c.name}"? It will be marked inactive.`,
        confirmLabel: 'Deactivate',
        danger: true
      }
    });
    ref.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.api.delete(`/insurance-companies/${this.companyId}`).subscribe({
        next: () => { this.toast.success('Company deactivated'); this.router.navigate(['/insurance']); },
        error: () => this.toast.error('Failed to deactivate')
      });
    });
  }

  openAddContractDialog() {
    const ref = this.dialog.open(ContractFormDialogComponent, {
      width: '520px',
      disableClose: true,
      data: { clientId: this.companyId }
    });
    ref.afterClosed().subscribe(result => {
      if (result) this.loadContracts();
    });
  }

  triggerUpload(contractId: string) {
    const el = document.getElementById(`upload-${contractId}`) as HTMLInputElement;
    if (el) el.click();
  }

  uploadContractDoc(event: Event, contractId: string) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    const fd = new FormData();
    fd.append('file', file);
    this.api.upload(
      `/insurance-companies/${this.companyId}/contracts/${contractId}/upload`, fd
    ).subscribe({
      next: () => { this.toast.success('Contract document uploaded'); this.loadContracts(); },
      error: () => this.toast.error('Upload failed')
    });
  }

  downloadContract(contractId: string) {
    this.api.download(
      `/insurance-companies/${this.companyId}/contracts/${contractId}/download`
    ).subscribe(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'contract'; a.click();
      URL.revokeObjectURL(url);
    });
  }

  getContractStatusClass(status: string) {
    const map: Record<string, string> = {
      Active: 'status-approved', Expired: 'status-cancelled',
      Pending: 'status-pending', Terminated: 'status-cancelled'
    };
    return map[status] || 'status-open';
  }
}


// ── Contract Add Dialog ───────────────────────────────────────────────────────

@Component({
  selector: 'app-contract-form-dialog',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule,
    MatButtonModule, MatIconModule, MatInputModule,
    MatSelectModule, MatFormFieldModule, MatDialogModule
  ],
  template: `
    <h2 mat-dialog-title>Add Contract</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="form-grid">
        <mat-form-field appearance="outline">
          <mat-label>Status</mat-label>
          <mat-select formControlName="status">
            <mat-option *ngFor="let s of statuses" [value]="s">{{ s }}</mat-option>
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Currency</mat-label>
          <mat-select formControlName="currency">
            <mat-option *ngFor="let c of currencies" [value]="c">{{ c }}</mat-option>
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Start Date</mat-label>
          <input matInput type="date" formControlName="start_date">
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>End Date</mat-label>
          <input matInput type="date" formControlName="end_date">
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Assistance Fee</mat-label>
          <input matInput type="number" formControlName="assistance_fee">
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>SLA Response Hours</mat-label>
          <input matInput type="number" formControlName="sla_response_hours">
        </mat-form-field>
        <mat-form-field appearance="outline" class="full">
          <mat-label>Tariff Notes</mat-label>
          <textarea matInput formControlName="tariff_notes" rows="2"></textarea>
        </mat-form-field>
        <mat-form-field appearance="outline" class="full">
          <mat-label>Special Terms</mat-label>
          <textarea matInput formControlName="special_terms" rows="2"></textarea>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-raised-button color="primary" [disabled]="saving()" (click)="submit()">
        {{ saving() ? 'Saving…' : 'Add Contract' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .form-grid { display:grid; grid-template-columns:1fr 1fr; gap:0 16px; padding-top:8px; }
    .full { grid-column:1/-1; }
    mat-form-field { width:100%; }
  `]
})
export class ContractFormDialogComponent {
  private api     = inject(ApiService);
  private toast   = inject(ToastService);
  private dialogRef = inject(MatDialogRef<ContractFormDialogComponent>);
  data = inject(MAT_DIALOG_DATA);

  saving = signal(false);
  statuses  = ['Pending', 'Active', 'Expired', 'Terminated'];
  currencies = ['USD', 'EUR', 'EGP', 'AED', 'GBP'];

  form = inject(FormBuilder).group({
    client_id:          [this.data.clientId, Validators.required],
    status:             ['Pending'],
    start_date:         [null as string | null],
    end_date:           [null as string | null],
    assistance_fee:     [0],
    currency:           ['USD'],
    sla_response_hours: [24],
    tariff_notes:       [''],
    special_terms:      [''],
  });

  submit() {
    this.saving.set(true);
    this.api.post(`/clients/${this.data.clientId}/contracts`, this.form.value).subscribe({
      next: () => {
        this.toast.success('Contract added');
        this.dialogRef.close(true);
      },
      error: () => { this.toast.error('Failed to add contract'); this.saving.set(false); }
    });
  }
}
