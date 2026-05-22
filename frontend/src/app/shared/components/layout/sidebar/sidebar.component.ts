import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../../core/auth/auth.service';

interface NavItem { label: string; icon: string; route: string; roles?: string[]; }

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, MatIconModule, MatTooltipModule, CommonModule],
  template: `
    <nav class="sidebar" [class.collapsed]="collapsed">
      <div class="sidebar-header">
        <div class="brand" *ngIf="!collapsed">
          <img src="assets/tmasi-logo.svg" alt="TMASI" class="brand-logo-img">
          <div class="brand-text">
            <span class="brand-name">MAMS</span>
            <span class="brand-sub">TMASI Global</span>
          </div>
        </div>
        <div class="brand-icon" *ngIf="collapsed">
          <img src="assets/tmasi-logo.svg" alt="TMASI" class="brand-logo-img-sm">
        </div>
      </div>
      <nav class="sidebar-nav">
        <ng-container *ngFor="let item of navItems">
          <a *ngIf="canShow(item)"
             [routerLink]="item.route" routerLinkActive="active"
             class="nav-item" [matTooltip]="collapsed ? item.label : ''" matTooltipPosition="right">
            <mat-icon>{{item.icon}}</mat-icon>
            <span *ngIf="!collapsed">{{item.label}}</span>
          </a>
        </ng-container>
      </nav>
      <div class="sidebar-footer">
        <button class="nav-item logout-btn" (click)="auth.logout()"
                [matTooltip]="collapsed ? 'Logout' : ''" matTooltipPosition="right">
          <mat-icon>logout</mat-icon>
          <span *ngIf="!collapsed">Logout</span>
        </button>
      </div>
    </nav>
  `,
  styles: [`
    .sidebar-header { padding: 16px; border-bottom: 1px solid rgba(255,255,255,0.1); min-height: 64px; display: flex; align-items: center; }
    .brand { display: flex; align-items: center; gap: 12px; }
    .brand-logo-img { width: 38px; height: 38px; border-radius: 8px; flex-shrink: 0; }
    .brand-logo-img-sm { width: 32px; height: 32px; border-radius: 6px; }
    .brand-name { font-size: 16px; font-weight: 700; color: white; display: block; }
    .brand-sub { font-size: 10px; color: rgba(255,255,255,0.5); display: block; }
    .sidebar-nav { flex: 1; padding: 12px 8px; overflow-y: auto; }
    .nav-item { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 8px; color: rgba(255,255,255,0.7); text-decoration: none; font-size: 14px; font-weight: 500; transition: all 0.15s; cursor: pointer; border: none; background: none; width: 100%; }
    .nav-item:hover { background: rgba(255,255,255,0.08); color: white; }
    .nav-item.active { background: rgba(201,168,76,0.2); color: #c9a84c; }
    .nav-item mat-icon { font-size: 20px; width: 20px; height: 20px; flex-shrink: 0; }
    .sidebar-footer { padding: 8px; border-top: 1px solid rgba(255,255,255,0.1); }
    .logout-btn { color: rgba(255,255,255,0.5); }
    .logout-btn:hover { background: rgba(255,0,0,0.15); color: #ff6b6b; }
    .brand-icon { display: flex; align-items: center; justify-content: center; width: 100%; }
  `]
})
export class SidebarComponent {
  @Input() collapsed = false;
  @Output() toggleSidebar = new EventEmitter<void>();
  auth = inject(AuthService);

  navItems: NavItem[] = [
    { label: 'Dashboard', icon: 'dashboard', route: '/dashboard' },
    { label: 'Cases', icon: 'folder_open', route: '/cases' },
    { label: 'Providers', icon: 'local_hospital', route: '/providers' },
    { label: 'Finance', icon: 'account_balance', route: '/finance', roles: ['Administrator','Finance','Operations'] },
    { label: 'Clients', icon: 'business', route: '/clients', roles: ['Administrator','Sales','Finance','Operations'] },
    { label: 'Insurance', icon: 'health_and_safety', route: '/insurance', roles: ['Administrator','Sales','Finance','Operations'] },
    { label: 'Reports', icon: 'bar_chart', route: '/reports' },
    { label: 'Users', icon: 'people', route: '/users', roles: ['Administrator'] },
    { label: 'Audit Log', icon: 'history', route: '/audit', roles: ['Administrator','Operations','Finance'] },
    { label: 'Settings', icon: 'settings', route: '/settings', roles: ['Administrator'] },
  ];

  canShow(item: NavItem): boolean {
    if (!item.roles) return true;
    return this.auth.hasRole(...item.roles);
  }
}
