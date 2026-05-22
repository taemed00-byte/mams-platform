import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';

interface ReportDef { id: string; label: string; icon: string; endpoint: string; }

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, MatCardModule, MatButtonModule, MatIconModule, MatButtonToggleModule, MatSelectModule, MatTableModule, MatProgressSpinnerModule, MatSlideToggleModule],
  template: `
    <div>
      <div class="page-header">
        <div><h1>Reports & Analytics</h1><p class="subtitle">Export, preview, and schedule reports</p></div>
        <button mat-raised-button color="primary" (click)="exportAll()"><mat-icon>download</mat-icon> Export All</button>
      </div>

      <!-- Date Range Controls -->
      <div class="mams-card filter-bar">
        <mat-button-toggle-group [(ngModel)]="selectedPreset" (change)="loadKPIs()">
          <mat-button-toggle value="7d">7D</mat-button-toggle>
          <mat-button-toggle value="30d">30D</mat-button-toggle>
          <mat-button-toggle value="MTD">MTD</mat-button-toggle>
          <mat-button-toggle value="QTD">QTD</mat-button-toggle>
          <mat-button-toggle value="YTD">YTD</mat-button-toggle>
          <mat-button-toggle value="all">All Time</mat-button-toggle>
        </mat-button-toggle-group>
        <div class="custom-range">
          <input type="date" [(ngModel)]="dateFrom" (change)="loadKPIs()" class="date-input" placeholder="From">
          <span>—</span>
          <input type="date" [(ngModel)]="dateTo" (change)="loadKPIs()" class="date-input" placeholder="To">
        </div>
      </div>

      <!-- KPI Summary -->
      <div class="kpi-grid" *ngIf="kpis()">
        <div class="kpi-card"><div class="kpi-label">Total Cases</div><div class="kpi-value">{{kpis()!.total_cases}}</div></div>
        <div class="kpi-card"><div class="kpi-label">Total Cost</div><div class="kpi-value">\${{kpis()!.total_cost | number:'1.0-0'}}</div></div>
        <div class="kpi-card"><div class="kpi-label">SLA Compliance</div><div class="kpi-value">{{kpis()!.sla_compliance}}%</div></div>
        <div class="kpi-card"><div class="kpi-label">SLA Breached</div><div class="kpi-value">{{kpis()!.sla_breached}}</div></div>
      </div>

      <!-- Report Cards -->
      <div class="reports-grid">
        <div class="report-card" *ngFor="let r of reports">
          <div class="report-icon"><mat-icon>{{r.icon}}</mat-icon></div>
          <div class="report-info">
            <h3>{{r.label}}</h3>
            <p>Filtered to selected date range</p>
          </div>
          <div class="report-actions">
            <button mat-stroked-button (click)="exportReport(r)"><mat-icon>download</mat-icon> Export</button>
          </div>
        </div>
      </div>

      <!-- Scheduled Reports -->
      <div class="mams-card">
        <div class="section-header">
          <h2>Scheduled Reports</h2>
          <button mat-stroked-button (click)="showScheduleForm = !showScheduleForm"><mat-icon>schedule</mat-icon> New Schedule</button>
        </div>
        <div class="schedule-form" *ngIf="showScheduleForm">
          <mat-form-field appearance="outline"><mat-label>Report Name</mat-label><input matInput [(ngModel)]="newSchedule.name" class="schedule-input"></mat-form-field>
          <mat-select [(ngModel)]="newSchedule.frequency" class="schedule-select"><mat-option value="Daily">Daily</mat-option><mat-option value="Weekly">Weekly</mat-option><mat-option value="Monthly">Monthly</mat-option></mat-select>
          <button mat-raised-button color="primary" (click)="createSchedule()">Create</button>
        </div>
        <div class="schedule-list">
          <div class="schedule-item" *ngFor="let s of scheduledReports()">
            <div class="schedule-info">
              <span class="schedule-name">{{s.name}}</span>
              <span class="schedule-freq">{{s.frequency}} · {{s.report_type}}</span>
            </div>
            <div class="schedule-actions">
              <mat-slide-toggle [checked]="s.is_active" (change)="toggleSchedule(s.id)"></mat-slide-toggle>
              <button mat-icon-button color="warn" (click)="deleteSchedule(s.id)"><mat-icon>delete</mat-icon></button>
            </div>
          </div>
          <div *ngIf="scheduledReports().length===0" class="empty-state"><mat-icon>schedule</mat-icon><p>No scheduled reports</p></div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px}
    .page-header h1{margin:0;font-size:26px;font-weight:700;color:#1e3870}.subtitle{margin:4px 0 0;color:#888;font-size:13px}
    .mams-card{background:white;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,0.08);padding:20px;margin-bottom:20px}
    .filter-bar{display:flex;gap:20px;align-items:center}
    .custom-range{display:flex;align-items:center;gap:8px}.date-input{border:1px solid #ddd;padding:6px 10px;border-radius:6px;font-size:13px}
    .kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:20px}
    .kpi-card{background:white;border-radius:12px;padding:20px;box-shadow:0 1px 4px rgba(0,0,0,0.08);border-left:4px solid #c9a84c}
    .kpi-label{font-size:12px;font-weight:600;color:#888;text-transform:uppercase;margin-bottom:8px}
    .kpi-value{font-size:26px;font-weight:800;color:#1e3870}
    .reports-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin-bottom:20px}
    .report-card{background:white;border-radius:12px;padding:20px;box-shadow:0 1px 4px rgba(0,0,0,0.08);display:flex;align-items:center;gap:16px}
    .report-icon{width:48px;height:48px;border-radius:12px;background:#e8edf8;display:flex;align-items:center;justify-content:center;flex-shrink:0}
    .report-icon mat-icon{color:#1e3870}
    .report-info{flex:1}.report-info h3{margin:0 0 4px;font-size:15px;font-weight:600;color:#333}
    .report-info p{margin:0;font-size:12px;color:#888}
    .section-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
    .section-header h2{margin:0;font-size:18px;font-weight:700;color:#1e3870}
    .schedule-form{display:flex;gap:12px;align-items:center;margin-bottom:16px;padding:16px;background:#f8f9fa;border-radius:8px}
    .schedule-list{display:flex;flex-direction:column;gap:8px}
    .schedule-item{display:flex;justify-content:space-between;align-items:center;padding:12px;background:#f8f9fa;border-radius:8px}
    .schedule-name{font-weight:600;font-size:14px}.schedule-freq{font-size:12px;color:#888;display:block}
    .schedule-actions{display:flex;align-items:center;gap:8px}
    .empty-state{text-align:center;padding:32px;color:#aaa}
  `]
})
export class ReportsComponent implements OnInit {
  private api = inject(ApiService); private toast = inject(ToastService);
  kpis = signal<any>(null); scheduledReports = signal<any[]>([]);
  selectedPreset = '30d'; dateFrom = ''; dateTo = '';
  showScheduleForm = false; newSchedule = { name: '', report_type: 'Case', frequency: 'Weekly', recipients: '' };

  reports: ReportDef[] = [
    { id:'case', label:'Case Report', icon:'folder_open', endpoint:'/reports/cases/export' },
    { id:'financial', label:'Financial Report', icon:'account_balance', endpoint:'/reports/financial/export' },
    { id:'provider', label:'Provider Performance', icon:'local_hospital', endpoint:'/reports/provider-performance/export' },
    { id:'sla', label:'SLA Compliance', icon:'timer', endpoint:'/reports/sla/export' },
    { id:'audit', label:'Audit Report', icon:'history', endpoint:'/reports/audit/export' },
  ];

  ngOnInit() { this.loadKPIs(); this.loadScheduledReports(); }

  loadKPIs() {
    this.api.get<any>('/reports/cases/data', { preset: this.selectedPreset }).subscribe(d => this.kpis.set(d));
  }
  loadScheduledReports() { this.api.get<any[]>('/reports/scheduled').subscribe(s => this.scheduledReports.set(s)); }

  exportReport(r: ReportDef) {
    this.api.download(r.endpoint, { preset: this.selectedPreset }).subscribe(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `${r.id}_report.xlsx`; a.click();
      this.toast.success(`${r.label} exported`);
    });
  }
  exportAll() { this.reports.forEach(r => this.exportReport(r)); }
  createSchedule() {
    this.api.post(`/reports/scheduled?name=${encodeURIComponent(this.newSchedule.name)}&report_type=${encodeURIComponent(this.newSchedule.report_type)}&frequency=${this.newSchedule.frequency}&recipients=`, {}).subscribe(() => { this.loadScheduledReports(); this.showScheduleForm = false; this.toast.success('Schedule created'); });
  }
  toggleSchedule(id: string) { this.api.put(`/reports/scheduled/${id}/toggle`, {}).subscribe(() => this.loadScheduledReports()); }
  deleteSchedule(id: string) { this.api.delete(`/reports/scheduled/${id}`).subscribe(() => { this.loadScheduledReports(); this.toast.info('Schedule deleted'); }); }
}
