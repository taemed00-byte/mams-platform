import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, MatInputModule, MatSelectModule, MatButtonModule, MatIconModule, MatDividerModule, MatSlideToggleModule],
  template: `
    <div>
      <div class="page-header">
        <div><h1>System Settings</h1><p class="subtitle">Platform-wide configuration</p></div>
        <button mat-raised-button color="primary" (click)="save()" [disabled]="saving()"><mat-icon>save</mat-icon> Save Changes</button>
      </div>

      <div *ngIf="settings()" class="settings-grid">
        <!-- General -->
        <div class="mams-card">
          <h3><mat-icon>tune</mat-icon> General</h3>
          <mat-divider style="margin:12px 0 20px"/>
          <div class="setting-group">
            <mat-form-field appearance="outline"><mat-label>Default Currency</mat-label>
              <mat-select [(ngModel)]="settings()!.default_currency">
                <mat-option *ngFor="let c of currencies" [value]="c">{{c}}</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Date Format</mat-label>
              <mat-select [(ngModel)]="settings()!.date_format">
                <mat-option value="DD/MM/YYYY">DD/MM/YYYY</mat-option>
                <mat-option value="MM/DD/YYYY">MM/DD/YYYY</mat-option>
                <mat-option value="YYYY-MM-DD">YYYY-MM-DD</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Interface Language</mat-label>
              <mat-select [(ngModel)]="settings()!.language">
                <mat-option value="en">English</mat-option>
                <mat-option value="ar">Arabic (عربي)</mat-option>
              </mat-select>
            </mat-form-field>
          </div>
        </div>

        <!-- SLA & Alerts -->
        <div class="mams-card">
          <h3><mat-icon>timer</mat-icon> SLA & Alerts</h3>
          <mat-divider style="margin:12px 0 20px"/>
          <div class="setting-group">
            <mat-form-field appearance="outline"><mat-label>SLA Threshold (hours)</mat-label><input matInput type="number" [(ngModel)]="settings()!.sla_threshold_hours" min="1"></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>High-Cost Alert Threshold (USD)</mat-label><input matInput type="number" [(ngModel)]="settings()!.high_cost_alert_threshold" min="0"></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Contract Expiry Warning (days)</mat-label><input matInput type="number" [(ngModel)]="settings()!.contract_expiry_warning_days" min="1"></mat-form-field>
          </div>
        </div>

        <!-- Optional Integrations Status -->
        <div class="mams-card full-width">
          <h3><mat-icon>extension</mat-icon> Optional Integrations</h3>
          <mat-divider style="margin:12px 0 20px"/>
          <div class="integrations-grid">
            <div class="integration-card">
              <div class="integration-header">
                <div class="int-icon"><mat-icon>call</mat-icon></div>
                <div><strong>Call-Centre API</strong><p>Inbound leads & click-to-call</p></div>
                <span class="status-pill" [class]="callCentreConfigured ? 'status-approved' : 'status-pending'">{{callCentreConfigured ? 'Configured' : 'Not Configured'}}</span>
              </div>
              <p class="int-note">Set <code>CALL_CENTRE_API_URL</code> and <code>CALL_CENTRE_API_KEY</code> in your environment variables to activate.</p>
            </div>
            <div class="integration-card">
              <div class="integration-header">
                <div class="int-icon" style="background:#e8f5e9"><mat-icon style="color:#2e7d32">chat</mat-icon></div>
                <div><strong>WhatsApp Business API</strong><p>Automated notifications & two-way messaging</p></div>
                <span class="status-pill" [class]="whatsappConfigured ? 'status-approved' : 'status-pending'">{{whatsappConfigured ? 'Configured' : 'Not Configured'}}</span>
              </div>
              <p class="int-note">Set <code>WHATSAPP_API_URL</code>, <code>WHATSAPP_TOKEN</code>, and <code>WHATSAPP_PHONE_ID</code> in your environment variables to activate.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px}
    .page-header h1{margin:0;font-size:26px;font-weight:700;color:#1e3870}.subtitle{margin:4px 0 0;color:#888;font-size:13px}
    .settings-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}
    .full-width{grid-column:1/-1}
    .mams-card{background:white;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,0.08);padding:24px}
    .mams-card h3{margin:0;display:flex;align-items:center;gap:8px;font-size:16px;font-weight:700;color:#1e3870}
    .setting-group{display:flex;flex-direction:column;gap:12px} mat-form-field{width:100%}
    .integrations-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
    .integration-card{border:1px solid #eee;border-radius:10px;padding:16px}
    .integration-header{display:flex;align-items:center;gap:12px;margin-bottom:10px}
    .int-icon{width:40px;height:40px;border-radius:10px;background:#e8edf8;display:flex;align-items:center;justify-content:center;flex-shrink:0}
    .int-icon mat-icon{color:#1e3870}
    .integration-header div strong{display:block;font-size:14px;font-weight:600}
    .integration-header div p{margin:2px 0 0;font-size:12px;color:#888}
    .int-note{margin:0;font-size:12px;color:#999;line-height:1.5} code{background:#f0f0f0;padding:1px 5px;border-radius:4px;font-size:11px}
  `]
})
export class SettingsComponent implements OnInit {
  private api = inject(ApiService); private toast = inject(ToastService);
  settings = signal<any>(null); saving = signal(false);
  currencies = ['EUR','USD','EGP','AED'];
  callCentreConfigured = false; whatsappConfigured = false;
  ngOnInit() { this.api.get<any>('/settings').subscribe(s => this.settings.set(s)); }
  save() {
    this.saving.set(true);
    this.api.put('/settings', this.settings()).subscribe({
      next: () => { this.toast.success('Settings saved'); this.saving.set(false); },
      error: () => { this.toast.error('Failed to save'); this.saving.set(false); }
    });
  }
}
