import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { Provider, ProviderTariff } from '../../../core/models/provider.model';
import { Case } from '../../../core/models/case.model';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-provider-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, MatTabsModule, MatButtonModule, MatIconModule, MatTableModule, MatChipsModule, MatTooltipModule, MatDialogModule],
  template: `
    <div *ngIf="provider()">
      <!-- Header -->
      <div class="detail-header">
        <button mat-icon-button routerLink="/providers"><mat-icon>arrow_back</mat-icon></button>
        <div class="header-info">
          <h1>{{provider()!.name}}</h1>
          <p class="header-sub">{{provider()!.category}} &nbsp;·&nbsp; {{provider()!.city || ''}}{{provider()!.city && provider()!.country ? ', ' : ''}}{{provider()!.country || ''}}</p>
        </div>
        <span class="status-pill" [class]="'tier-' + provider()!.tier.toLowerCase()">{{provider()!.tier}}</span>
        <div style="flex:1"></div>
        <button mat-stroked-button [routerLink]="['/providers/new']" [queryParams]="{edit: provider()!.id}">
          <mat-icon>edit</mat-icon> Edit
        </button>
        <button mat-stroked-button color="warn" (click)="deleteProvider()">
          <mat-icon>delete</mat-icon> Delete
        </button>
      </div>

      <!-- KPI bar -->
      <div class="quick-stats">
        <div class="stat-item">
          <span class="stat-label">Total Cases</span>
          <span class="stat-value">{{provider()!.total_cases}}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Avg Cost</span>
          <span class="stat-value">\${{provider()!.average_cost | number:'1.0-0'}}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Approval Rate</span>
          <span class="stat-value">{{provider()!.approval_rate || 0}}%</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Rating</span>
          <span class="stat-value">★ {{(provider()!.rating || 0) | number:'1.1-1'}}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Phone</span>
          <span class="stat-value">{{provider()!.phone || '—'}}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Email</span>
          <span class="stat-value">{{provider()!.email || '—'}}</span>
        </div>
      </div>

      <!-- Info + Tabs -->
      <div class="mams-card">
        <mat-tab-group>

          <!-- Tariffs -->
          <mat-tab label="Tariffs ({{tariffs().length}})">
            <div class="tab-body">
              <table mat-table [dataSource]="tariffs()" *ngIf="tariffs().length > 0">
                <ng-container matColumnDef="service">
                  <th mat-header-cell *matHeaderCellDef>Service</th>
                  <td mat-cell *matCellDef="let t">{{t.service_name}}</td>
                </ng-container>
                <ng-container matColumnDef="price">
                  <th mat-header-cell *matHeaderCellDef>Unit Price</th>
                  <td mat-cell *matCellDef="let t"><strong>{{t.unit_price | number:'1.2-2'}}</strong> {{t.currency}}</td>
                </ng-container>
                <ng-container matColumnDef="effective">
                  <th mat-header-cell *matHeaderCellDef>Effective Date</th>
                  <td mat-cell *matCellDef="let t">{{t.effective_date || '—'}}</td>
                </ng-container>
                <ng-container matColumnDef="notes">
                  <th mat-header-cell *matHeaderCellDef>Notes</th>
                  <td mat-cell *matCellDef="let t">{{t.notes || '—'}}</td>
                </ng-container>
                <tr mat-header-row *matHeaderRowDef="['service','price','effective','notes']"></tr>
                <tr mat-row *matRowDef="let row; columns:['service','price','effective','notes']" class="table-row"></tr>
              </table>
              <div *ngIf="tariffs().length === 0" class="empty-state">
                <mat-icon>price_change</mat-icon>
                <p>No tariffs defined for this provider</p>
              </div>
            </div>
          </mat-tab>

          <!-- Case History -->
          <mat-tab label="Case History ({{cases().length}})">
            <div class="tab-body">
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
                <p>No cases linked to this provider</p>
              </div>
            </div>
          </mat-tab>

          <!-- Contract -->
          <mat-tab label="Contract">
            <div class="tab-body contract-tab">
              <div class="contract-grid">
                <div class="contract-field">
                  <label>Contract Start</label>
                  <span>{{provider()!.contract_start || 'Not set'}}</span>
                </div>
                <div class="contract-field">
                  <label>Contract End</label>
                  <span [class.text-danger]="isExpiringSoon()">{{provider()!.contract_end || 'Not set'}}</span>
                </div>
                <div class="contract-field">
                  <label>Specialties</label>
                  <span>{{provider()!.specialties || '—'}}</span>
                </div>
                <div class="contract-field">
                  <label>Address</label>
                  <span>{{provider()!.address || '—'}}</span>
                </div>
                <div class="contract-field">
                  <label>Accreditation</label>
                  <span>{{provider()!.accreditation || '—'}}</span>
                </div>
              </div>
              <div class="contract-doc" *ngIf="provider()!.contract_file_path">
                <mat-icon>description</mat-icon>
                <span>Contract document attached</span>
                <a mat-stroked-button [href]="provider()!.contract_file_path" target="_blank">
                  <mat-icon>download</mat-icon> Download
                </a>
              </div>
              <div class="empty-state" *ngIf="!provider()!.contract_file_path">
                <mat-icon>upload_file</mat-icon>
                <p>No contract document uploaded</p>
              </div>
            </div>
          </mat-tab>

        </mat-tab-group>
      </div>
    </div>

    <!-- Loading -->
    <div *ngIf="!provider()" class="loading-center">
      <mat-icon style="font-size:48px;color:#ddd">local_hospital</mat-icon>
      <p style="color:#aaa">Loading provider…</p>
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
    .empty-state { display: flex; flex-direction: column; align-items: center; padding: 40px; color: #aaa; gap: 8px; }
    .empty-state mat-icon { font-size: 48px; width: 48px; height: 48px; color: #ddd; }
    .link { color: #1e3870; font-weight: 600; text-decoration: none; }
    .link:hover { text-decoration: underline; }
    .type-chip { background: #f0f4ff; color: #1e3870; padding: 2px 8px; border-radius: 8px; font-size: 11px; font-weight: 500; }
    .table-row:hover { background: #f8f9fa; }
    .contract-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
    .contract-field label { display: block; font-size: 11px; font-weight: 600; color: #999; text-transform: uppercase; margin-bottom: 4px; }
    .contract-field span { font-size: 14px; color: #333; }
    .contract-doc { display: flex; align-items: center; gap: 10px; padding: 14px; background: #f0f4ff; border-radius: 8px; }
    .text-danger { color: #c62828 !important; }
    .loading-center { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px; gap: 16px; }
  `]
})
export class ProviderDetailComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private dialog = inject(MatDialog);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  provider = signal<Provider | null>(null);
  tariffs = signal<ProviderTariff[]>([]);
  cases = signal<Case[]>([]);
  caseCols = ['case_number', 'patient', 'type', 'status', 'cost', 'opened'];

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.api.get<Provider>(`/providers/${id}`).subscribe(p => this.provider.set(p));
    this.api.get<ProviderTariff[]>(`/providers/${id}/tariffs`).subscribe(t => this.tariffs.set(t));
    this.api.get<Case[]>('/cases', { provider_id: id }).subscribe(c => this.cases.set(c));
  }

  isExpiringSoon(): boolean {
    const end = this.provider()?.contract_end;
    if (!end) return false;
    const diff = (new Date(end).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 30;
  }

  deleteProvider() {
    const p = this.provider()!;
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: { title: 'Delete Provider', message: `Delete "${p.name}"? This cannot be undone.`, confirmLabel: 'Delete', danger: true }
    });
    ref.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.api.delete(`/providers/${p.id}`).subscribe({
        next: () => { this.toast.success('Provider deleted'); this.router.navigate(['/providers']); },
        error: () => this.toast.error('Failed to delete provider')
      });
    });
  }
}
