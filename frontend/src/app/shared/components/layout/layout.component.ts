import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from './sidebar/sidebar.component';
import { TopbarComponent } from './topbar/topbar.component';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthService } from '../../../core/auth/auth.service';
import { IdleTimeoutService } from '../../../core/services/idle-timeout.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, TopbarComponent, CommonModule],
  template: `
    <app-sidebar [collapsed]="sidebarCollapsed()" (toggleSidebar)="sidebarCollapsed.set(!sidebarCollapsed())" />
    <div class="page-wrapper" [class.sidebar-collapsed]="sidebarCollapsed()">
      <app-topbar [sidebarCollapsed]="sidebarCollapsed()" (toggleSidebar)="sidebarCollapsed.set(!sidebarCollapsed())" />
      <main class="page-content">
        <router-outlet />
      </main>
    </div>

    <!-- HIPAA §164.312(a)(2)(iii) — Idle session warning dialog -->
    @if (idleService.warningSecondsLeft !== null) {
      <div class="idle-overlay">
        <div class="idle-dialog">
          <div class="idle-icon">⏱</div>
          <h2>Session Expiring Soon</h2>
          <p>
            You have been inactive. For security reasons, your session will expire in
            <strong>{{ formatCountdown(idleService.warningSecondsLeft) }}</strong>.
          </p>
          <p class="idle-sub">Click below to stay logged in.</p>
          <div class="idle-actions">
            <button class="btn-stay" (click)="stayLoggedIn()">Stay Logged In</button>
            <button class="btn-logout" (click)="logoutNow()">Log Out Now</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .idle-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      backdrop-filter: blur(3px);
    }
    .idle-dialog {
      background: #fff;
      border-radius: 12px;
      padding: 2.5rem 2rem;
      max-width: 420px;
      width: 90%;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    .idle-icon { font-size: 3rem; margin-bottom: 1rem; }
    .idle-dialog h2 {
      margin: 0 0 1rem;
      color: #1a1a2e;
      font-size: 1.4rem;
    }
    .idle-dialog p {
      color: #555;
      margin-bottom: 0.5rem;
      line-height: 1.5;
    }
    .idle-dialog strong {
      color: #d9534f;
      font-size: 1.1rem;
    }
    .idle-sub { font-size: 0.875rem; color: #888; margin-bottom: 1.5rem; }
    .idle-actions { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; }
    .btn-stay {
      background: #1a237e;
      color: #fff;
      border: none;
      padding: 0.75rem 1.75rem;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    .btn-stay:hover { background: #283593; }
    .btn-logout {
      background: transparent;
      color: #d9534f;
      border: 2px solid #d9534f;
      padding: 0.75rem 1.75rem;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-logout:hover { background: #d9534f; color: #fff; }
  `]
})
export class LayoutComponent implements OnInit, OnDestroy {
  private notifService = inject(NotificationService);
  private authService  = inject(AuthService);
  idleService          = inject(IdleTimeoutService);
  sidebarCollapsed     = signal(false);

  constructor() {
    this.notifService.startPolling();
  }

  ngOnInit(): void {
    this.idleService.start();
  }

  ngOnDestroy(): void {
    this.idleService.stop();
  }

  stayLoggedIn(): void {
    this.idleService.extendSession();
  }

  logoutNow(): void {
    this.idleService.stop();
    this.authService.logout();
  }

  formatCountdown(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0
      ? `${m}:${s.toString().padStart(2, '0')} minutes`
      : `${s} seconds`;
  }
}
