import { Component, inject, signal } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/auth/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { environment } from '@env/environment';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, MatInputModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, CommonModule],
  template: `
    <div class="login-page">
      <div class="login-left">
        <div class="login-brand">
          <div class="brand-logo-lg">T</div>
          <h1>MAMS</h1>
          <p>Medical Assistance Management System</p>
          <p class="sub">TMASI Global · Operations Platform</p>
        </div>
        <div class="login-features">
          <div class="feature-item" *ngFor="let f of features">
            <mat-icon>{{f.icon}}</mat-icon>
            <span>{{f.label}}</span>
          </div>
        </div>
      </div>
      <div class="login-right">
        <div class="login-card">
          <div class="login-card-header">
            <h2>Sign In</h2>
            <p>Enter your credentials to access MAMS</p>
          </div>
          <form [formGroup]="form" (ngSubmit)="onSubmit()">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Email Address</mat-label>
              <mat-icon matPrefix>email</mat-icon>
              <input matInput type="email" formControlName="email" placeholder="you@tmasi.net" autocomplete="email">
              <mat-error *ngIf="form.get('email')?.hasError('required')">Email is required</mat-error>
              <mat-error *ngIf="form.get('email')?.hasError('email')">Enter a valid email</mat-error>
            </mat-form-field>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Password</mat-label>
              <mat-icon matPrefix>lock</mat-icon>
              <input matInput [type]="showPwd() ? 'text' : 'password'" formControlName="password" autocomplete="current-password">
              <button mat-icon-button matSuffix type="button" (click)="showPwd.set(!showPwd())">
                <mat-icon>{{showPwd() ? 'visibility_off' : 'visibility'}}</mat-icon>
              </button>
              <mat-error *ngIf="form.get('password')?.hasError('required')">Password is required</mat-error>
            </mat-form-field>
            <div *ngIf="error()" class="error-msg">
              <mat-icon>error</mat-icon> {{error()}}
            </div>
            <div class="debug-info">
              <small>API: {{apiUrl}}</small>
            </div>
            <button mat-raised-button color="primary" type="submit" class="login-btn"
                    [disabled]="form.invalid || loading()">
              <mat-progress-spinner *ngIf="loading()" diameter="20" mode="indeterminate" />
              <span *ngIf="!loading()">Sign In</span>
            </button>
          </form>
          <div class="login-footer">
            <p>Default admin: <code>admin&#64;tmasi.net</code> / <code>Admin&#64;TMASI2026</code></p>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-page { display: flex; height: 100vh; }
    .login-left { width: 45%; background: linear-gradient(135deg, #0a1b4e 0%, #1e3870 60%, #2e4a82 100%); color: white; display: flex; flex-direction: column; justify-content: center; padding: 48px; gap: 48px; }
    .login-brand { display: flex; flex-direction: column; gap: 12px; }
    .brand-logo-lg { width: 64px; height: 64px; background: #c9a84c; border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 900; color: #0a1b4e; }
    .login-brand h1 { margin: 0; font-size: 40px; font-weight: 800; }
    .login-brand p { margin: 0; color: rgba(255,255,255,0.8); font-size: 16px; }
    .login-brand .sub { font-size: 13px; color: rgba(255,255,255,0.5); }
    .login-features { display: flex; flex-direction: column; gap: 16px; }
    .feature-item { display: flex; align-items: center; gap: 12px; font-size: 14px; color: rgba(255,255,255,0.75); }
    .feature-item mat-icon { color: #c9a84c; }
    .login-right { flex: 1; display: flex; align-items: center; justify-content: center; background: #f5f7fa; padding: 24px; }
    .login-card { background: white; border-radius: 16px; padding: 40px; width: 100%; max-width: 420px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .login-card-header h2 { margin: 0 0 8px; font-size: 24px; font-weight: 700; color: #1e3870; }
    .login-card-header p { margin: 0 0 24px; color: #888; font-size: 14px; }
    .full-width { width: 100%; margin-bottom: 12px; }
    .login-btn { width: 100%; height: 48px; font-size: 15px; font-weight: 600; margin-top: 8px; }
    .error-msg { display: flex; align-items: center; gap: 8px; color: #c62828; font-size: 13px; padding: 10px 12px; background: #fce4ec; border-radius: 8px; margin-bottom: 12px; }
    .login-footer { margin-top: 24px; text-align: center; font-size: 12px; color: #aaa; }
    .debug-info { font-size: 10px; color: #bbb; margin-bottom: 8px; word-break: break-all; }
    code { background: #f5f5f5; padding: 2px 6px; border-radius: 4px; font-size: 11px; color: #333; }
    @media (max-width: 768px) { .login-left { display: none; } .login-right { width: 100%; } }
  `]
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private toast = inject(ToastService);

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required]
  });
  loading = signal(false);
  error = signal('');
  showPwd = signal(false);
  apiUrl = environment.apiUrl;

  features = [
    { icon: 'folder_open', label: 'End-to-end Case Management' },
    { icon: 'local_hospital', label: 'Provider Network Management' },
    { icon: 'account_balance', label: 'Multi-currency Finance & Invoicing' },
    { icon: 'bar_chart', label: 'Real-time Analytics & Reports' },
    { icon: 'public', label: 'Multi-country Operations' },
  ];

  onSubmit() {
    if (this.form.invalid) return;
    this.loading.set(true); this.error.set('');
    const { email, password } = this.form.value;
    this.auth.login(email!, password!).subscribe({
      next: () => { this.router.navigate(['/dashboard']); this.toast.success('Welcome back!'); },
      error: (e) => {
        const detail = e.error?.detail || e.message || '';
        const status = e.status ? ` (HTTP ${e.status})` : ' (no response — CORS or network)';
        this.error.set(detail ? `${detail}${status}` : `Login failed${status}`);
        this.loading.set(false);
      }
    });
  }
}
