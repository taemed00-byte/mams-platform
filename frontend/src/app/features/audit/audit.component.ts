import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-audit',
  standalone: true,
  imports: [CommonModule, FormsModule, MatTableModule, MatButtonModule, MatIconModule, MatInputModule, MatSelectModule, MatProgressSpinnerModule, DatePipe],
  template: `
    <div>
      <div class="page-header">
        <div><h1>Audit Log</h1><p class="subtitle">Complete activity trail — every action logged</p></div>
        <button mat-stroked-button (click)="exportExcel()"><mat-icon>download</mat-icon> Export</button>
      </div>
      <div class="mams-card filters-bar">
        <mat-form-field appearance="outline" class="search-field"><mat-label>Search</mat-label><mat-icon matPrefix>search</mat-icon><input matInput [(ngModel)]="search" (ngModelChange)="load()"></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Action</mat-label><input matInput [(ngModel)]="actionFilter" (ngModelChange)="load()" placeholder="e.g. CREATE_CASE"></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Role</mat-label>
          <mat-select [(ngModel)]="roleFilter" (ngModelChange)="load()">
            <mat-option value="">All</mat-option>
            <mat-option *ngFor="let r of roles" [value]="r">{{r}}</mat-option>
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Entity</mat-label>
          <mat-select [(ngModel)]="entityFilter" (ngModelChange)="load()">
            <mat-option value="">All</mat-option>
            <mat-option *ngFor="let e of entities" [value]="e">{{e}}</mat-option>
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline"><mat-label>From</mat-label><input matInput type="date" [(ngModel)]="dateFrom" (change)="load()"></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>To</mat-label><input matInput type="date" [(ngModel)]="dateTo" (change)="load()"></mat-form-field>
      </div>

      <div *ngIf="loading()" class="loading-center"><mat-progress-spinner mode="indeterminate" diameter="40"/></div>

      <div class="table-card" *ngIf="!loading()">
        <table mat-table [dataSource]="logs()">
          <ng-container matColumnDef="timestamp"><th mat-header-cell *matHeaderCellDef>Timestamp</th><td mat-cell *matCellDef="let l">{{l.created_at | date:'dd/MM/yyyy HH:mm:ss'}}</td></ng-container>
          <ng-container matColumnDef="actor"><th mat-header-cell *matHeaderCellDef>Actor</th><td mat-cell *matCellDef="let l"><strong>{{l.actor_name}}</strong><br><small>{{l.actor_role}}</small></td></ng-container>
          <ng-container matColumnDef="action"><th mat-header-cell *matHeaderCellDef>Action</th><td mat-cell *matCellDef="let l"><code class="action-code">{{l.action}}</code></td></ng-container>
          <ng-container matColumnDef="entity"><th mat-header-cell *matHeaderCellDef>Entity</th><td mat-cell *matCellDef="let l">{{l.entity_type || '—'}}<br><small style="color:#999">{{l.entity_id ? l.entity_id.substring(0,8)+'...' : ''}}</small></td></ng-container>
          <ng-container matColumnDef="description"><th mat-header-cell *matHeaderCellDef>Description</th><td mat-cell *matCellDef="let l">{{l.description || '—'}}</td></ng-container>
          <ng-container matColumnDef="ip"><th mat-header-cell *matHeaderCellDef>IP</th><td mat-cell *matCellDef="let l">{{l.ip_address || '—'}}</td></ng-container>
          <tr mat-header-row *matHeaderRowDef="cols; sticky: true"></tr>
          <tr mat-row *matRowDef="let row; columns: cols" class="table-row"></tr>
        </table>
        <div *ngIf="logs().length === 0" class="empty-state"><mat-icon>history</mat-icon><h3>No audit logs found</h3></div>
      </div>
    </div>
  `,
  styles: [`
    .page-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px}
    .page-header h1{margin:0;font-size:26px;font-weight:700;color:#1e3870}.subtitle{margin:4px 0 0;color:#888;font-size:13px}
    .mams-card{background:white;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,0.08);padding:16px 20px;margin-bottom:16px}
    .filters-bar{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
    .search-field{flex:1;min-width:200px}.filters-bar mat-form-field{min-width:130px}
    .table-card{background:white;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,0.08);overflow:auto;max-height:70vh}
    .action-code{background:#f0f0f0;padding:2px 6px;border-radius:4px;font-size:11px;color:#333}
    .table-row:hover{background:#f8f9fa}
    .loading-center{display:flex;justify-content:center;padding:60px}
    .empty-state{display:flex;flex-direction:column;align-items:center;padding:48px;color:#aaa}
  `]
})
export class AuditComponent implements OnInit {
  private api = inject(ApiService); private toast = inject(ToastService);
  logs = signal<any[]>([]); loading = signal(true);
  search = ''; actionFilter = ''; roleFilter = ''; entityFilter = ''; dateFrom = ''; dateTo = '';
  roles = ['Administrator','Operations','Finance','Sales'];
  entities = ['Case','Invoice','Payment','Provider','Client','Contract','User','Document'];
  cols = ['timestamp','actor','action','entity','description','ip'];
  ngOnInit() { this.load(); }
  load() {
    this.loading.set(true);
    const p: any = {};
    if (this.search) p.search = this.search; if (this.actionFilter) p.action = this.actionFilter;
    if (this.roleFilter) p.actor_role = this.roleFilter; if (this.entityFilter) p.entity_type = this.entityFilter;
    if (this.dateFrom) p.date_from = this.dateFrom; if (this.dateTo) p.date_to = this.dateTo;
    this.api.get<any[]>('/audit', p).subscribe({ next: l => { this.logs.set(l); this.loading.set(false); }, error: () => this.loading.set(false) });
  }
  exportExcel() { this.api.download('/audit/export').subscribe(b => { const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download='audit_log.xlsx';a.click(); this.toast.success('Audit log exported'); }); }
}
