import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators, ValidatorFn, AbstractControl, ValidationErrors } from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { Client, Contract } from '../../../core/models/client.model';
import { Case } from '../../../core/models/case.model';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { environment } from '../../../../environments/environment';

// ── Contract date validator ───────────────────────────────────────────────
const contractDateOrderValidator: ValidatorFn = (g: AbstractControl): ValidationErrors | null => {
  const s = g.get('start_date')?.value, e = g.get('end_date')?.value;
  return s && e && new Date(e) <= new Date(s) ? { dateOrder: true } : null;
};

// ── Contract Dialog ───────────────────────────────────────────────────────
@Component({
  selector: 'app-contract-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatInputModule, MatSelectModule, MatButtonModule, MatIconModule, MatDividerModule, MatProgressSpinnerModule],
  template: `
    <div class="dialog-container">
      <h2 class="dialog-title">
        <mat-icon>description</mat-icon>
        {{data.contract ? 'Edit Contract' : 'New Contract'}}
      </h2>
      <mat-divider style="margin-bottom:20px"/>

      <form [formGroup]="form">
        <div class="form-grid">

          <mat-form-field appearance="outline">
            <mat-label>Status</mat-label>
            <mat-select formControlName="status">
              <mat-option value="Pending">Pending</mat-option>
              <mat-option value="Active">Active</mat-option>
              <mat-option value="Expired">Expired</mat-option>
              <mat-option value="Terminated">Terminated</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Currency</mat-label>
            <mat-select formControlName="currency">
              <mat-option *ngFor="let c of ['EUR','USD','EGP','AED']" [value]="c">{{c}}</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Start Date</mat-label>
            <input matInput type="date" formControlName="start_date">
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>End Date</mat-label>
            <input matInput type="date" formControlName="end_date">
            <mat-error *ngIf="form.hasError('dateOrder') && form.get('end_date')?.touched">End date must be after start date</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Assistance Fee</mat-label>
            <input matInput type="number" formControlName="assistance_fee" min="0">
            <mat-error *ngIf="form.get('assistance_fee')?.hasError('min')">Must be ≥ 0</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>SLA Response (hours)</mat-label>
            <input matInput type="number" formControlName="sla_response_hours" min="1" max="720">
            <mat-error *ngIf="form.get('sla_response_hours')?.hasError('min')">Minimum 1 hour</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline" class="full">
            <mat-label>Tariff Notes</mat-label>
            <textarea matInput formControlName="tariff_notes" rows="3" placeholder="Rate schedule, tariff limits…"></textarea>
          </mat-form-field>

          <mat-form-field appearance="outline" class="full">
            <mat-label>Special Terms</mat-label>
            <textarea matInput formControlName="special_terms" rows="3" placeholder="Exclusions, special clauses…"></textarea>
          </mat-form-field>

        </div>
      </form>

      <!-- File upload for contract document -->
      <div class="file-section" *ngIf="data.contract">
        <div class="file-label"><mat-icon>attach_file</mat-icon> Contract Document</div>
        <div *ngIf="data.contract.file_path" class="file-existing">
          <mat-icon>check_circle</mat-icon>
          <span>Document attached</span>
          <a [href]="getDocUrl(data.contract)" target="_blank" mat-stroked-button>
            <mat-icon>download</mat-icon> Download
          </a>
        </div>
        <div class="upload-zone-sm" (click)="fileInput.click()" (dragover)="$event.preventDefault()" (drop)="onDrop($event)">
          <mat-icon>cloud_upload</mat-icon>
          <span>{{selectedFile ? selectedFile.name : 'Upload / Replace contract document'}}</span>
          <input #fileInput type="file" style="display:none" accept=".pdf,.doc,.docx" (change)="onFileChange($event)">
        </div>
      </div>

      <div class="dialog-actions">
        <button mat-button (click)="ref.close()">Cancel</button>
        <button mat-raised-button color="primary" (click)="save()" [disabled]="form.invalid || saving()">
          <mat-progress-spinner *ngIf="saving()" diameter="18" mode="indeterminate"/>
          <span *ngIf="!saving()">{{data.contract ? 'Update' : 'Create'}} Contract</span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .dialog-container { min-width: 600px; padding: 24px; }
    .dialog-title { display: flex; align-items: center; gap: 10px; margin: 0 0 16px; font-size: 20px; font-weight: 700; color: #1e3870; }
    .dialog-title mat-icon { color: #c9a84c; }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .full { grid-column: 1 / -1; }
    mat-form-field { width: 100%; }
    .file-section { margin-top: 16px; border-top: 1px solid #f0f0f0; padding-top: 16px; }
    .file-label { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: #555; margin-bottom: 10px; }
    .file-existing { display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: #f0f9f0; border-radius: 8px; margin-bottom: 10px; color: #2e7d32; font-size: 13px; }
    .file-existing mat-icon { font-size: 18px; }
    .upload-zone-sm { border: 1.5px dashed #d0d7e6; border-radius: 8px; padding: 12px 16px; display: flex; align-items: center; gap: 10px; cursor: pointer; color: #888; font-size: 13px; transition: all 0.2s; }
    .upload-zone-sm:hover { border-color: #1e3870; background: #f0f4ff; }
    .upload-zone-sm mat-icon { color: #c9a84c; }
    .dialog-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; border-top: 1px solid #f0f0f0; padding-top: 16px; }
  `]
})
export class ContractDialogComponent {
  form: any;
  saving = signal(false);
  selectedFile: File | null = null;
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private toast = inject(ToastService);
  ref = inject(MatDialogRef<ContractDialogComponent>);
  data: {clientId: string, contract?: Contract} = inject(MAT_DIALOG_DATA);

  constructor() {
    const c = this.data.contract;
    this.form = this.fb.group({
      status:             [c?.status || 'Pending'],
      currency:           [c?.currency || 'USD'],
      start_date:         [c?.start_date || ''],
      end_date:           [c?.end_date || ''],
      assistance_fee:     [c?.assistance_fee ?? 0, [Validators.min(0)]],
      sla_response_hours: [c?.sla_response_hours ?? 24, [Validators.min(1)]],
      tariff_notes:       [c?.tariff_notes || ''],
      special_terms:      [c?.special_terms || '']
    }, { validators: contractDateOrderValidator });
  }

  onFileChange(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (f) this.selectedFile = f;
  }
  onDrop(e: DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer?.files?.[0];
    if (f) this.selectedFile = f;
  }
  getDocUrl(c: Contract): string {
    const parts = (c.file_path || '').replace(/\\/g, '/').split('/').filter(Boolean);
    const segment = parts.slice(-2).join('/');
    return `${environment.apiUrl.replace(/\/api.*$/, '')}/uploads/${segment}`;
  }

  save() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.saving.set(true);
    const clean = (v: any) => v === '' ? null : v;
    const payload: any = {};
    for (const [k, v] of Object.entries(this.form.value)) payload[k] = clean(v);
    payload.client_id = this.data.clientId;

    const req = this.data.contract
      ? this.api.put(`/clients/contracts/${this.data.contract.id}`, payload)
      : this.api.post(`/clients/${this.data.clientId}/contracts`, payload);

    req.subscribe({
      next: (saved: any) => {
        if (this.selectedFile && saved.id) {
          const fd = new FormData();
          fd.append('file', this.selectedFile);
          this.api.upload(`/clients/contracts/${saved.id}/upload`, fd).subscribe({
            next: () => { this.toast.success('Contract saved with document'); this.ref.close(true); },
            error: () => { this.toast.success('Contract saved (doc upload failed)'); this.ref.close(true); }
          });
        } else {
          this.toast.success(this.data.contract ? 'Contract updated' : 'Contract created');
          this.ref.close(true);
        }
      },
      error: (e: any) => { this.toast.error(e.error?.detail || 'Failed to save contract'); this.saving.set(false); }
    });
  }
}

// ── Main Client Detail Component ──────────────────────────────────────────────
@Component({
  selector: 'app-client-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, MatTabsModule, MatButtonModule, MatIconModule,
            MatTableModule, MatDialogModule, MatTooltipModule, MatDividerModule],
  template: `
    <div *ngIf="client()">
      <!-- Header -->
      <div class="detail-header">
        <button mat-icon-button routerLink="/clients"><mat-icon>arrow_back</mat-icon></button>
        <div class="header-info">
          <h1>{{client()!.name}}</h1>
          <p class="header-sub">{{client()!.client_type}} &nbsp;·&nbsp; {{client()!.country || 'Unknown country'}}</p>
        </div>
        <span class="status-pill" [class]="client()!.is_active ? 'status-approved' : 'status-cancelled'">
          {{client()!.is_active ? 'Active' : 'Inactive'}}
        </span>
        <span class="status-pill status-open">{{client()!.pipeline_stage}}</span>
        <div style="flex:1"></div>
        <button mat-stroked-button [routerLink]="['/clients/new']" [queryParams]="{edit: client()!.id}">
          <mat-icon>edit</mat-icon> Edit
        </button>
        <button mat-stroked-button color="warn" (click)="deactivateClient()">
          <mat-icon>block</mat-icon> Deactivate
        </button>
      </div>

      <!-- KPI bar -->
      <div class="quick-stats">
        <div class="stat-item"><span class="stat-label">Total Cases</span><span class="stat-value">{{client()!.total_cases}}</span></div>
        <div class="stat-item"><span class="stat-label">Total Revenue</span><span class="stat-value">\${{client()!.total_revenue | number:'1.0-0'}}</span></div>
        <div class="stat-item"><span class="stat-label">Open Cases</span><span class="stat-value" style="color:#1e3870">{{openCases()}}</span></div>
        <div class="stat-item"><span class="stat-label">SLA Breaches</span><span class="stat-value" style="color:#c62828">{{slaCases()}}</span></div>
        <div class="stat-item"><span class="stat-label">Contact</span><span class="stat-value">{{client()!.contact_name || '—'}}</span></div>
        <div class="stat-item"><span class="stat-label">Email</span><span class="stat-value">{{client()!.email || '—'}}</span></div>
      </div>

      <!-- Tabs -->
      <div class="mams-card">
        <mat-tab-group>

          <!-- ── Contracts Tab ── -->
          <mat-tab label="Contracts ({{contracts().length}})">
            <div class="tab-body">
              <div class="tab-toolbar">
                <span class="tab-title">Contract Management</span>
                <button mat-raised-button color="primary" (click)="openContractDialog()">
                  <mat-icon>add</mat-icon> New Contract
                </button>
              </div>

              <!-- Active contract highlight -->
              <div class="active-contract-banner" *ngIf="activeContract()">
                <div class="acb-left">
                  <mat-icon style="color:#2e7d32">verified</mat-icon>
                  <div>
                    <div class="acb-number">{{activeContract()!.contract_number}}</div>
                    <div class="acb-period">{{activeContract()!.start_date | date:'dd MMM yyyy'}} — {{activeContract()!.end_date | date:'dd MMM yyyy'}}</div>
                  </div>
                </div>
                <div class="acb-kpis">
                  <div class="acb-kpi"><span>Fee</span><strong>{{activeContract()!.assistance_fee | number:'1.2-2'}} {{activeContract()!.currency}}</strong></div>
                  <div class="acb-kpi"><span>SLA</span><strong>{{activeContract()!.sla_response_hours}}h</strong></div>
                  <div class="acb-kpi"><span>Days Left</span><strong [style.color]="daysLeft(activeContract()!) < 30 ? '#c62828' : '#2e7d32'">{{daysLeft(activeContract()!)}}</strong></div>
                </div>
              </div>

              <table mat-table [dataSource]="contracts()" *ngIf="contracts().length > 0" class="contracts-table">
                <ng-container matColumnDef="number">
                  <th mat-header-cell *matHeaderCellDef>Contract #</th>
                  <td mat-cell *matCellDef="let c"><strong>{{c.contract_number}}</strong></td>
                </ng-container>
                <ng-container matColumnDef="status">
                  <th mat-header-cell *matHeaderCellDef>Status</th>
                  <td mat-cell *matCellDef="let c">
                    <span class="status-pill" [class]="'contract-' + c.status.toLowerCase()">{{c.status}}</span>
                  </td>
                </ng-container>
                <ng-container matColumnDef="dates">
                  <th mat-header-cell *matHeaderCellDef>Period</th>
                  <td mat-cell *matCellDef="let c">{{c.start_date | date:'dd/MM/yy'}} — {{c.end_date | date:'dd/MM/yy'}}</td>
                </ng-container>
                <ng-container matColumnDef="fee">
                  <th mat-header-cell *matHeaderCellDef>Assistance Fee</th>
                  <td mat-cell *matCellDef="let c"><strong>{{c.assistance_fee | number:'1.2-2'}}</strong> {{c.currency}}</td>
                </ng-container>
                <ng-container matColumnDef="sla">
                  <th mat-header-cell *matHeaderCellDef>SLA (h)</th>
                  <td mat-cell *matCellDef="let c">{{c.sla_response_hours}}h</td>
                </ng-container>
                <ng-container matColumnDef="tariff">
                  <th mat-header-cell *matHeaderCellDef>Tariff Notes</th>
                  <td mat-cell *matCellDef="let c" class="tariff-cell">{{c.tariff_notes || '—'}}</td>
                </ng-container>
                <ng-container matColumnDef="doc">
                  <th mat-header-cell *matHeaderCellDef>Doc</th>
                  <td mat-cell *matCellDef="let c">
                    <a *ngIf="c.file_path" mat-icon-button [href]="getDocUrl(c)" target="_blank" matTooltip="Download contract">
                      <mat-icon style="color:#1e3870">download</mat-icon>
                    </a>
                    <span *ngIf="!c.file_path" style="color:#ddd;font-size:12px">—</span>
                  </td>
                </ng-container>
                <ng-container matColumnDef="actions">
                  <th mat-header-cell *matHeaderCellDef></th>
                  <td mat-cell *matCellDef="let c">
                    <button mat-icon-button (click)="openContractDialog(c)" matTooltip="Edit contract">
                      <mat-icon>edit</mat-icon>
                    </button>
                  </td>
                </ng-container>
                <tr mat-header-row *matHeaderRowDef="contractCols"></tr>
                <tr mat-row *matRowDef="let row; columns:contractCols" class="table-row"></tr>
              </table>

              <div *ngIf="contracts().length === 0" class="empty-state">
                <mat-icon>description</mat-icon>
                <p>No contracts yet</p>
                <button mat-raised-button color="primary" (click)="openContractDialog()">
                  <mat-icon>add</mat-icon> Create First Contract
                </button>
              </div>
            </div>
          </mat-tab>

          <!-- ── Cases Tab ── -->
          <mat-tab label="Cases ({{cases().length}})">
            <div class="tab-body">
              <div class="revenue-bar" *ngIf="cases().length > 0">
                <div class="rev-item"><span class="stat-label">Open Cases</span><span class="stat-value" style="color:#1e3870">{{openCases()}}</span></div>
                <div class="rev-item"><span class="stat-label">Closed Cases</span><span class="stat-value" style="color:#2e7d32">{{closedCases()}}</span></div>
                <div class="rev-item"><span class="stat-label">SLA Breaches</span><span class="stat-value" style="color:#c62828">{{slaCases()}}</span></div>
                <div class="rev-item"><span class="stat-label">Total Spend</span><span class="stat-value">\${{totalSpend() | number:'1.0-0'}}</span></div>
              </div>
              <table mat-table [dataSource]="cases()" *ngIf="cases().length > 0">
                <ng-container matColumnDef="case_number">
                  <th mat-header-cell *matHeaderCellDef>Case #</th>
                  <td mat-cell *matCellDef="let c"><a [routerLink]="['/cases', c.id]" class="link">{{c.case_number}}</a></td>
                </ng-container>
                <ng-container matColumnDef="patient">
                  <th mat-header-cell *matHeaderCellDef>Patient</th>
                  <td mat-cell *matCellDef="let c">{{c.patient?.name || '—'}}</td>
                </ng-container>
                <ng-container matColumnDef="type">
                  <th mat-header-cell *matHeaderCellDef>Type</th>
                  <td mat-cell *matCellDef="let c"><span class="type-chip">{{c.case_type}}</span></td>
                </ng-container>
                <ng-container matColumnDef="priority">
                  <th mat-header-cell *matHeaderCellDef>Priority</th>
                  <td mat-cell *matCellDef="let c"><span class="status-pill" [class]="'priority-' + c.priority.toLowerCase()">{{c.priority}}</span></td>
                </ng-container>
                <ng-container matColumnDef="status">
                  <th mat-header-cell *matHeaderCellDef>Status</th>
                  <td mat-cell *matCellDef="let c"><span class="status-pill" [class]="'status-' + c.status.toLowerCase()">{{c.status}}</span></td>
                </ng-container>
                <ng-container matColumnDef="cost">
                  <th mat-header-cell *matHeaderCellDef>Actual Cost</th>
                  <td mat-cell *matCellDef="let c">{{c.actual_cost | number:'1.2-2'}} {{c.currency}}</td>
                </ng-container>
                <ng-container matColumnDef="opened">
                  <th mat-header-cell *matHeaderCellDef>Opened</th>
                  <td mat-cell *matCellDef="let c">{{c.opened_at | date:'dd/MM/yyyy'}}</td>
                </ng-container>
                <tr mat-header-row *matHeaderRowDef="caseCols"></tr>
                <tr mat-row *matRowDef="let row; columns:caseCols" class="table-row"></tr>
              </table>
              <div *ngIf="cases().length === 0" class="empty-state">
                <mat-icon>folder_open</mat-icon>
                <p>No cases linked to this client</p>
              </div>
            </div>
          </mat-tab>

          <!-- ── Info Tab ── -->
          <mat-tab label="Info">
            <div class="tab-body info-grid">
              <div class="info-field"><label>Client Type</label><span>{{client()!.client_type}}</span></div>
              <div class="info-field"><label>Pipeline Stage</label><span>{{client()!.pipeline_stage}}</span></div>
              <div class="info-field"><label>Contact Name</label><span>{{client()!.contact_name || '—'}}</span></div>
              <div class="info-field"><label>Email</label><span>{{client()!.email || '—'}}</span></div>
              <div class="info-field"><label>Phone</label><span>{{client()!.phone || '—'}}</span></div>
              <div class="info-field"><label>Country</label><span>{{client()!.country || '—'}}</span></div>
              <div class="info-field"><label>Created</label><span>{{client()!.created_at | date:'dd MMM yyyy'}}</span></div>
            </div>
          </mat-tab>

        </mat-tab-group>
      </div>
    </div>

    <div *ngIf="!client()" class="loading-center">
      <mat-icon style="font-size:48px;color:#ddd">business</mat-icon>
      <p style="color:#aaa">Loading client…</p>
    </div>
  `,
  styles: [`
    .detail-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
    .header-info h1 { margin: 0; font-size: 24px; font-weight: 700; color: #1e3870; }
    .header-sub { margin: 4px 0 0; color: #888; font-size: 13px; }
    .quick-stats { display: flex; background: white; border-radius: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); margin-bottom: 20px; overflow: hidden; flex-wrap: wrap; }
    .stat-item { flex: 1; min-width: 120px; padding: 16px 20px; border-right: 1px solid #f0f0f0; }
    .stat-item:last-child { border-right: none; }
    .stat-label { display: block; font-size: 11px; font-weight: 600; color: #999; text-transform: uppercase; margin-bottom: 4px; }
    .stat-value { font-size: 15px; font-weight: 600; color: #222; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .mams-card { background: white; border-radius: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
    .tab-body { padding: 20px; }
    .tab-toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .tab-title { font-size: 14px; font-weight: 600; color: #1e3870; }

    /* Active contract banner */
    .active-contract-banner { background: linear-gradient(135deg, #e8f5e9, #f1f8e9); border: 1px solid #a5d6a7; border-radius: 10px; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .acb-left { display: flex; align-items: center; gap: 12px; }
    .acb-number { font-size: 16px; font-weight: 700; color: #1b5e20; }
    .acb-period { font-size: 12px; color: #388e3c; margin-top: 2px; }
    .acb-kpis { display: flex; gap: 24px; }
    .acb-kpi { text-align: center; }
    .acb-kpi span { display: block; font-size: 11px; color: #888; font-weight: 600; text-transform: uppercase; }
    .acb-kpi strong { font-size: 16px; color: #1e3870; }

    .contracts-table { width: 100%; }
    .tariff-cell { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; color: #666; }

    /* Contract status pills */
    .contract-active { background: #e8f5e9 !important; color: #2e7d32 !important; }
    .contract-pending { background: #fff8e1 !important; color: #f57f17 !important; }
    .contract-expired { background: #fce4ec !important; color: #c62828 !important; }
    .contract-terminated { background: #f5f5f5 !important; color: #757575 !important; }

    .revenue-bar { display: flex; background: #f8f9fc; border-radius: 8px; margin-bottom: 16px; overflow: hidden; }
    .rev-item { flex: 1; padding: 12px 16px; border-right: 1px solid #e8ecef; }
    .rev-item:last-child { border-right: none; }
    .empty-state { display: flex; flex-direction: column; align-items: center; padding: 40px; color: #aaa; gap: 12px; }
    .empty-state mat-icon { font-size: 48px; width: 48px; height: 48px; color: #ddd; }
    .link { color: #1e3870; font-weight: 600; text-decoration: none; }
    .link:hover { text-decoration: underline; }
    .type-chip { background: #f0f4ff; color: #1e3870; padding: 2px 8px; border-radius: 8px; font-size: 11px; font-weight: 500; }
    .table-row:hover { background: #f8f9fa; cursor: pointer; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .info-field label { display: block; font-size: 11px; font-weight: 600; color: #999; text-transform: uppercase; margin-bottom: 4px; }
    .info-field span { font-size: 14px; color: #333; }
    .loading-center { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px; gap: 16px; }
  `]
})
export class ClientDetailComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private dialog = inject(MatDialog);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  client = signal<Client | null>(null);
  contracts = signal<Contract[]>([]);
  cases = signal<Case[]>([]);
  contractCols = ['number','status','dates','fee','sla','tariff','doc','actions'];
  caseCols = ['case_number','patient','type','priority','status','cost','opened'];

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.api.get<Client>(`/clients/${id}`).subscribe(c => this.client.set(c));
    this.loadContracts(id);
    this.api.get<Case[]>('/cases', { client_id: id }).subscribe(c => this.cases.set(c));
  }

  loadContracts(id?: string) {
    const clientId = id || this.client()?.id;
    if (!clientId) return;
    this.api.get<Contract[]>(`/clients/${clientId}/contracts`).subscribe(c => this.contracts.set(c));
  }

  activeContract() { return this.contracts().find(c => c.status === 'Active') || null; }
  daysLeft(c: Contract): number {
    if (!c.end_date) return 0;
    return Math.max(0, Math.ceil((new Date(c.end_date).getTime() - Date.now()) / 86400000));
  }
  getDocUrl(c: Contract): string {
    const parts = (c.file_path || '').replace(/\\/g, '/').split('/').filter(Boolean);
    const segment = parts.slice(-2).join('/');
    return `${environment.apiUrl.replace(/\/api.*$/, '')}/uploads/${segment}`;
  }

  openCases() { return this.cases().filter(c => c.status === 'Open' || c.status === 'Pending').length; }
  closedCases() { return this.cases().filter(c => c.status === 'Closed').length; }
  slaCases() { return this.cases().filter(c => c.sla_breached).length; }
  totalSpend() { return this.cases().reduce((s, c) => s + (c.actual_cost || 0), 0); }

  openContractDialog(contract?: Contract) {
    const ref = this.dialog.open(ContractDialogComponent, {
      data: { clientId: this.client()!.id, contract },
      panelClass: 'mams-dialog',
      maxWidth: '700px',
      width: '100%'
    });
    ref.afterClosed().subscribe(saved => { if (saved) this.loadContracts(); });
  }

  deactivateClient() {
    const c = this.client()!;
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: { title: 'Deactivate Client', message: `Deactivate "${c.name}"? They will no longer appear as active.`, confirmLabel: 'Deactivate', danger: true }
    });
    ref.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.api.delete(`/clients/${c.id}`).subscribe({
        next: () => { this.toast.success('Client deactivated'); this.router.navigate(['/clients']); },
        error: () => this.toast.error('Failed to deactivate client')
      });
    });
  }
}
