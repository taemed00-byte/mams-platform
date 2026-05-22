import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ApiService } from '../../../core/services/api.service';
import { Case } from '../../../core/models/case.model';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-cases-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, MatTableModule, MatButtonModule, MatIconModule, MatInputModule, MatSelectModule, MatProgressSpinnerModule, MatTooltipModule, MatMenuModule, MatChipsModule, MatDialogModule],
  template: `
    <div class="cases-page">
      <div class="page-header">
        <div><h1>Cases</h1><p class="subtitle">{{cases().length}} cases</p></div>
        <div class="header-actions">
          <button mat-stroked-button (click)="exportExcel()"><mat-icon>download</mat-icon> Export</button>
          <button mat-raised-button color="primary" routerLink="/cases/new"><mat-icon>add</mat-icon> New Case</button>
        </div>
      </div>

      <!-- Filters -->
      <div class="mams-card filters-bar">
        <mat-form-field appearance="outline" class="search-field">
          <mat-label>Search cases or patients</mat-label>
          <mat-icon matPrefix>search</mat-icon>
          <input matInput [(ngModel)]="filters.search" (ngModelChange)="loadCases()" placeholder="Case # or patient name...">
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Status</mat-label>
          <mat-select [(ngModel)]="filters.status" (ngModelChange)="loadCases()">
            <mat-option value="">All</mat-option>
            <mat-option *ngFor="let s of statuses" [value]="s">{{s}}</mat-option>
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Priority</mat-label>
          <mat-select [(ngModel)]="filters.priority" (ngModelChange)="loadCases()">
            <mat-option value="">All</mat-option>
            <mat-option *ngFor="let p of priorities" [value]="p">{{p}}</mat-option>
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Type</mat-label>
          <mat-select [(ngModel)]="filters.case_type" (ngModelChange)="loadCases()">
            <mat-option value="">All</mat-option>
            <mat-option *ngFor="let t of caseTypes" [value]="t">{{t}}</mat-option>
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Country</mat-label>
          <mat-select [(ngModel)]="filters.country" (ngModelChange)="loadCases()">
            <mat-option value="">All</mat-option>
            <mat-option *ngFor="let c of countries" [value]="c">{{c}}</mat-option>
          </mat-select>
        </mat-form-field>
        <button mat-icon-button (click)="clearFilters()" matTooltip="Clear filters"><mat-icon>filter_alt_off</mat-icon></button>
      </div>

      <div *ngIf="loading()" class="loading-center"><mat-progress-spinner mode="indeterminate" diameter="40"/></div>

      <!-- Table -->
      <div class="table-card" *ngIf="!loading()">
        <div *ngIf="cases().length === 0" class="empty-state">
          <mat-icon>folder_open</mat-icon>
          <h3>No cases found</h3>
          <p>Create your first case or adjust your filters</p>
          <button mat-raised-button color="primary" routerLink="/cases/new">Create Case</button>
        </div>
        <table mat-table [dataSource]="cases()" *ngIf="cases().length > 0">
          <ng-container matColumnDef="case_number">
            <th mat-header-cell *matHeaderCellDef>Case #</th>
            <td mat-cell *matCellDef="let c"><a [routerLink]="['/cases', c.id]" class="case-link">{{c.case_number}}</a></td>
          </ng-container>
          <ng-container matColumnDef="patient">
            <th mat-header-cell *matHeaderCellDef>Patient</th>
            <td mat-cell *matCellDef="let c">{{c.patient?.name || '—'}}</td>
          </ng-container>
          <ng-container matColumnDef="case_type">
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
          <ng-container matColumnDef="country">
            <th mat-header-cell *matHeaderCellDef>Country</th>
            <td mat-cell *matCellDef="let c">{{c.country || '—'}}</td>
          </ng-container>
          <ng-container matColumnDef="cost">
            <th mat-header-cell *matHeaderCellDef>Actual Cost</th>
            <td mat-cell *matCellDef="let c">{{c.actual_cost | number:'1.2-2'}} {{c.currency}}</td>
          </ng-container>
          <ng-container matColumnDef="sla">
            <th mat-header-cell *matHeaderCellDef>SLA</th>
            <td mat-cell *matCellDef="let c">
              <mat-icon [style.color]="c.sla_breached ? '#c62828' : '#2e7d32'" [matTooltip]="c.sla_breached ? 'SLA Breached' : 'On Track'">
                {{c.sla_breached ? 'timer_off' : 'timer'}}
              </mat-icon>
            </td>
          </ng-container>
          <ng-container matColumnDef="opened_at">
            <th mat-header-cell *matHeaderCellDef>Opened</th>
            <td mat-cell *matCellDef="let c">{{c.opened_at | date:'dd/MM/yyyy'}}</td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef>Actions</th>
            <td mat-cell *matCellDef="let c">
              <button mat-icon-button [routerLink]="['/cases', c.id]" matTooltip="View"><mat-icon>visibility</mat-icon></button>
              <button mat-icon-button [routerLink]="['/cases', c.id, 'edit']" matTooltip="Edit"><mat-icon>edit</mat-icon></button>
              <button mat-icon-button (click)="printCase(c)" matTooltip="Print"><mat-icon>print</mat-icon></button>
              <button mat-icon-button color="warn" (click)="deleteCase(c)" matTooltip="Delete"><mat-icon>delete</mat-icon></button>
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns;" class="table-row"></tr>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .cases-page { }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
    .page-header h1 { margin: 0; font-size: 26px; font-weight: 700; color: #1e3870; }
    .subtitle { margin: 4px 0 0; color: #888; font-size: 13px; }
    .header-actions { display: flex; gap: 10px; }
    .filters-bar { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; padding: 16px 20px; }
    .search-field { flex: 1; min-width: 220px; }
    .filters-bar mat-form-field { min-width: 140px; }
    .table-card { background: white; border-radius: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); overflow: hidden; }
    .loading-center { display: flex; justify-content: center; padding: 60px; }
    .case-link { color: #1e3870; font-weight: 600; text-decoration: none; }
    .case-link:hover { text-decoration: underline; }
    .type-chip { background: #f0f4ff; color: #1e3870; padding: 2px 8px; border-radius: 8px; font-size: 11px; font-weight: 500; }
    .table-row:hover { background: #f8f9fa; }
    .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 64px; gap: 12px; color: #999; }
    .empty-state mat-icon { font-size: 56px; width: 56px; height: 56px; color: #ddd; }
    .empty-state h3 { margin: 0; color: #555; }
    .empty-state p { margin: 0; font-size: 14px; }
  `]
})
export class CasesListComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private dialog = inject(MatDialog);
  cases = signal<Case[]>([]);
  loading = signal(true);

  filters: any = { search: '', status: '', priority: '', case_type: '', country: '' };
  statuses = ['Open','Pending','Approved','Closed','Cancelled'];
  priorities = ['Low','Medium','High','Critical'];
  caseTypes = ['Outpatient','Inpatient','Evacuation & Repatriation','Telemedicine','Concierge'];
  countries = ['Egypt','Germany','Spain','UAE','USA'];
  displayedColumns = ['case_number','patient','case_type','priority','status','country','cost','sla','opened_at','actions'];

  ngOnInit() { this.loadCases(); }

  loadCases() {
    this.loading.set(true);
    const params: any = {};
    if (this.filters.search) params.search = this.filters.search;
    if (this.filters.status) params.status = this.filters.status;
    if (this.filters.priority) params.priority = this.filters.priority;
    if (this.filters.case_type) params.case_type = this.filters.case_type;
    if (this.filters.country) params.country = this.filters.country;
    this.api.get<Case[]>('/cases', params).subscribe({
      next: c => { this.cases.set(c); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  clearFilters() { this.filters = { search: '', status: '', priority: '', case_type: '', country: '' }; this.loadCases(); }

  exportExcel() {
    this.api.download('/cases/export/excel').subscribe(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'cases.xlsx'; a.click();
      URL.revokeObjectURL(url);
    });
  }

  printCase(c: Case) { window.open(`/cases/${c.id}?print=true`, '_blank'); }

  deleteCase(c: Case) {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: { title: 'Delete Case', message: `Are you sure you want to delete case ${c.case_number}? This action cannot be undone.`, confirmLabel: 'Delete', danger: true }
    });
    ref.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.api.delete(`/cases/${c.id}`).subscribe({
        next: () => { this.toast.success('Case deleted'); this.cases.update(list => list.filter(x => x.id !== c.id)); },
        error: () => this.toast.error('Failed to delete case')
      });
    });
  }
}
