import { Component, inject, signal, OnInit, AfterViewChecked } from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatButtonModule, MatButtonToggleModule, MatProgressSpinnerModule, FormsModule, DatePipe],
  template: `
    <div class="dashboard-page">
      <div class="page-header">
        <div>
          <h1>Dashboard</h1>
          <p class="subtitle">Real-time operations overview · {{today | date:'EEEE, d MMMM yyyy'}}</p>
        </div>
        <div class="date-range-controls">
          <mat-button-toggle-group [(ngModel)]="selectedPreset" (change)="loadData()">
            <mat-button-toggle value="7d">7D</mat-button-toggle>
            <mat-button-toggle value="30d">30D</mat-button-toggle>
            <mat-button-toggle value="MTD">MTD</mat-button-toggle>
            <mat-button-toggle value="QTD">QTD</mat-button-toggle>
            <mat-button-toggle value="YTD">YTD</mat-button-toggle>
            <mat-button-toggle value="all">All</mat-button-toggle>
          </mat-button-toggle-group>
        </div>
      </div>

      <div *ngIf="loading()" class="loading-center"><mat-progress-spinner mode="indeterminate" diameter="48"/></div>

      <ng-container *ngIf="!loading() && data()">
        <!-- KPI Cards -->
        <div class="kpi-grid">
          <div class="kpi-card" style="border-color:#1e3870">
            <div class="kpi-icon" style="background:#e8edf8"><mat-icon style="color:#1e3870">folder_open</mat-icon></div>
            <div class="kpi-value">{{data()!.kpis.open_cases}}</div>
            <div class="kpi-label">Open Cases</div>
          </div>
          <div class="kpi-card" style="border-color:#c9a84c">
            <div class="kpi-icon" style="background:#fdf8e9"><mat-icon style="color:#c9a84c">account_balance</mat-icon></div>
            <div class="kpi-value">\${{data()!.kpis.total_revenue | number:'1.0-0'}}</div>
            <div class="kpi-label">Total Revenue</div>
          </div>
          <div class="kpi-card" style="border-color:#2e7d32">
            <div class="kpi-icon" style="background:#e8f5e9"><mat-icon style="color:#2e7d32">verified</mat-icon></div>
            <div class="kpi-value">{{data()!.kpis.sla_compliance_rate}}%</div>
            <div class="kpi-label">SLA Compliance</div>
          </div>
          <div class="kpi-card" style="border-color:#c62828">
            <div class="kpi-icon" style="background:#fce4ec"><mat-icon style="color:#c62828">receipt_long</mat-icon></div>
            <div class="kpi-value">{{data()!.kpis.overdue_invoices}}</div>
            <div class="kpi-label">Overdue Invoices</div>
          </div>
        </div>

        <!-- Charts Row 1 -->
        <div class="charts-grid">
          <div class="chart-card wide">
            <h3>Cases Over Time</h3>
            <div class="chart-container"><canvas id="casesTimeChart"></canvas></div>
          </div>
          <div class="chart-card">
            <h3>Status Breakdown</h3>
            <div class="chart-container"><canvas id="statusChart"></canvas></div>
          </div>
        </div>
        <!-- Charts Row 2 -->
        <div class="charts-grid">
          <div class="chart-card">
            <h3>Cost by Case Type</h3>
            <div class="chart-container"><canvas id="costTypeChart"></canvas></div>
          </div>
          <div class="chart-card">
            <h3>Top Providers</h3>
            <div class="chart-container"><canvas id="providersChart"></canvas></div>
          </div>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    .dashboard-page { padding: 0; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
    .page-header h1 { margin: 0; font-size: 26px; font-weight: 700; color: #1e3870; }
    .subtitle { margin: 4px 0 0; color: #888; font-size: 13px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
    .kpi-card { background: white; border-radius: 12px; padding: 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); border-left: 4px solid #ccc; display: flex; flex-direction: column; gap: 8px; }
    .kpi-icon { width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; margin-bottom: 4px; }
    .kpi-value { font-size: 28px; font-weight: 800; color: #1e3870; }
    .kpi-label { font-size: 12px; font-weight: 600; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
    .charts-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 16px; margin-bottom: 16px; }
    .chart-card { background: white; border-radius: 12px; padding: 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
    .chart-card h3 { margin: 0 0 16px; font-size: 15px; font-weight: 600; color: #333; }
    .chart-container { position: relative; height: 200px; }
    .loading-center { display: flex; justify-content: center; padding: 80px; }
    @media(max-width:900px) { .kpi-grid{grid-template-columns:1fr 1fr} .charts-grid{grid-template-columns:1fr} }
  `]
})
export class DashboardComponent implements OnInit, AfterViewChecked {
  private api = inject(ApiService);
  data = signal<any>(null);
  loading = signal(true);
  selectedPreset = '30d';
  today = new Date();
  private chartsRendered = false;
  private pendingData: any = null;

  ngOnInit() { this.loadData(); }

  ngAfterViewChecked() {
    // Render charts once canvases are in DOM after *ngIf resolves
    if (this.pendingData && !this.chartsRendered) {
      const el = document.getElementById('casesTimeChart');
      if (el) {
        this.chartsRendered = true;
        this.renderCharts(this.pendingData);
        this.pendingData = null;
      }
    }
  }

  loadData() {
    this.loading.set(true);
    this.chartsRendered = false;
    this.pendingData = null;
    // destroy any existing charts
    this.destroyCharts();
    this.api.get<any>('/dashboard', { preset: this.selectedPreset }).subscribe({
      next: d => {
        this.data.set(d);
        this.loading.set(false);
        // Store for AfterViewChecked to pick up once *ngIf renders canvases
        this.pendingData = d;
      },
      error: () => this.loading.set(false)
    });
  }

  private destroyCharts() {
    import('chart.js/auto').then(({ Chart }) => {
      ['casesTimeChart','statusChart','costTypeChart','providersChart'].forEach(id => {
        Chart.getChart(id)?.destroy();
      });
    });
  }

  renderCharts(d: any) {
    if (typeof window === 'undefined') return;
    import('chart.js/auto').then(({ Chart }) => {
      // destroy leftovers
      ['casesTimeChart','statusChart','costTypeChart','providersChart'].forEach(id => Chart.getChart(id)?.destroy());

      const safe = (arr: any[]) => arr?.length ? arr : [];

      const el1 = document.getElementById('casesTimeChart') as HTMLCanvasElement;
      if (el1) new Chart(el1, {
        type: 'line',
        data: {
          labels: safe(d.cases_over_time).map((x:any) => x.date),
          datasets: [{
            label: 'Cases', data: safe(d.cases_over_time).map((x:any) => x.count),
            borderColor: '#1e3870', backgroundColor: 'rgba(30,56,112,0.08)',
            fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#1e3870'
          }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
      });

      const el2 = document.getElementById('statusChart') as HTMLCanvasElement;
      const statusData = safe(d.status_breakdown);
      if (el2 && statusData.length) new Chart(el2, {
        type: 'doughnut',
        data: {
          labels: statusData.map((x:any) => x.label),
          datasets: [{ data: statusData.map((x:any) => x.value), backgroundColor: ['#1565c0','#f57f17','#2e7d32','#6a1b9a','#c62828','#00838f'] }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } } }
      });

      const el3 = document.getElementById('costTypeChart') as HTMLCanvasElement;
      if (el3) new Chart(el3, {
        type: 'bar',
        data: {
          labels: safe(d.cost_by_case_type).map((x:any) => x.label),
          datasets: [{ label: 'Total Cost (USD)', data: safe(d.cost_by_case_type).map((x:any) => x.value), backgroundColor: '#c9a84c', borderRadius: 4 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
      });

      const el4 = document.getElementById('providersChart') as HTMLCanvasElement;
      if (el4) new Chart(el4, {
        type: 'bar',
        data: {
          labels: safe(d.top_providers).map((x:any) => x.name),
          datasets: [{ label: 'Cases', data: safe(d.top_providers).map((x:any) => x.case_count), backgroundColor: '#1e3870', borderRadius: 4 }]
        },
        options: { indexAxis: 'y' as const, responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } } }
      });
    });
  }
}
