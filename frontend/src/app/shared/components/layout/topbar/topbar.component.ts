import { Component, Input, Output, EventEmitter, inject, signal, HostListener, ElementRef } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDividerModule } from '@angular/material/divider';
import { CommonModule, DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ApiService } from '../../../../core/services/api.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [MatIconModule, MatButtonModule, MatMenuModule, MatBadgeModule, MatDividerModule,
            CommonModule, RouterLink, DatePipe, MatTooltipModule, FormsModule],
  template: `
    <header class="topbar">
      <div class="topbar-left">
        <button mat-icon-button (click)="toggleSidebar.emit()" class="toggle-btn">
          <mat-icon>{{ sidebarCollapsed ? 'menu_open' : 'menu' }}</mat-icon>
        </button>
        <!-- Global Search -->
        <div class="search-wrapper">
          <div class="search-box" [class.active]="searchActive()">
            <mat-icon class="search-icon">search</mat-icon>
            <input class="search-input" placeholder="Search cases, providers, clients…"
                   [(ngModel)]="searchQuery" (input)="onSearch()"
                   (focus)="searchActive.set(true)" (keydown.escape)="closeSearch()">
            <button *ngIf="searchQuery" mat-icon-button class="search-clear" (click)="clearSearch()">
              <mat-icon style="font-size:16px">close</mat-icon>
            </button>
          </div>
          <!-- Results Dropdown -->
          <div class="search-results" *ngIf="searchActive() && searchResults().length > 0">
            <div *ngFor="let r of searchResults()" class="search-result-item"
                 (click)="navigateTo(r.url)" [title]="r.title">
              <mat-icon class="result-icon">{{getResultIcon(r.type)}}</mat-icon>
              <div class="result-body">
                <div class="result-title">{{r.title}}</div>
                <div class="result-sub">{{r.subtitle}}</div>
              </div>
              <span class="result-badge" [class]="'badge-' + r.type">{{r.type}}</span>
            </div>
          </div>
          <div class="search-results" *ngIf="searchActive() && searchQuery.length >= 2 && searchResults().length === 0 && !searching()">
            <div class="no-results">No results for "{{searchQuery}}"</div>
          </div>
        </div>
      </div>

      <div class="topbar-right">
        <!-- Language toggle -->
        <button mat-icon-button (click)="toggleLang()" [matTooltip]="lang() === 'en' ? 'Switch to Arabic' : 'Switch to English'">
          <span style="font-size:12px;font-weight:700">{{lang() === 'en' ? 'ع' : 'EN'}}</span>
        </button>
        <!-- Notifications -->
        <button mat-icon-button [matMenuTriggerFor]="notifMenu"
                [matBadge]="notifService.unreadCount() || null"
                matBadgeColor="warn" matBadgeSize="small">
          <mat-icon>notifications</mat-icon>
        </button>
        <mat-menu #notifMenu="matMenu" class="notif-menu">
          <div class="notif-header" (click)="$event.stopPropagation()">
            <span>Notifications</span>
            <button mat-button color="primary" (click)="notifService.markAllRead()">Mark all read</button>
          </div>
          <mat-divider/>
          <div class="notif-list" (click)="$event.stopPropagation()">
            <div *ngFor="let n of notifService.notifications().slice(0,8)"
                 class="notif-item" [class.unread]="!n.is_read" (click)="notifService.markRead(n.id)">
              <mat-icon class="notif-icon">{{getNotifIcon(n.notif_type)}}</mat-icon>
              <div class="notif-body">
                <div class="notif-title">{{n.title}}</div>
                <div class="notif-msg">{{n.message}}</div>
                <div class="notif-time">{{n.created_at | date:'d MMM, HH:mm'}}</div>
              </div>
            </div>
            <div *ngIf="notifService.notifications().length === 0" class="notif-empty">
              <mat-icon>notifications_none</mat-icon>
              <p>All caught up!</p>
            </div>
          </div>
        </mat-menu>
        <!-- User menu -->
        <button mat-button [matMenuTriggerFor]="userMenu" class="user-btn">
          <div class="user-avatar">{{auth.user()?.name?.charAt(0)}}</div>
          <div class="user-info">
            <span class="user-name">{{auth.user()?.name}}</span>
            <span class="user-role">{{auth.user()?.role}}</span>
          </div>
          <mat-icon>expand_more</mat-icon>
        </button>
        <mat-menu #userMenu="matMenu">
          <button mat-menu-item routerLink="/settings"><mat-icon>settings</mat-icon> Settings</button>
          <mat-divider/>
          <button mat-menu-item (click)="auth.logout()"><mat-icon>logout</mat-icon> Logout</button>
        </mat-menu>
      </div>
    </header>
  `,
  styles: [`
    .topbar { height: 64px; background: white; border-bottom: 1px solid #e8ecef; display: flex; align-items: center; justify-content: space-between; padding: 0 20px; position: fixed; top: 0; right: 0; left: var(--tmasi-sidebar-width); z-index: 99; transition: left 0.25s ease; box-shadow: 0 1px 4px rgba(0,0,0,0.06); gap: 16px; }
    .topbar-left { display: flex; align-items: center; gap: 12px; flex: 1; }
    .topbar-right { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
    .toggle-btn { color: #555; flex-shrink: 0; }

    /* Search */
    .search-wrapper { position: relative; flex: 1; max-width: 480px; }
    .search-box { display: flex; align-items: center; background: #f5f7fa; border: 1.5px solid #e8ecef; border-radius: 10px; padding: 0 10px; gap: 6px; transition: all 0.2s; }
    .search-box.active { border-color: #1e3870; background: white; box-shadow: 0 0 0 3px rgba(30,56,112,0.08); }
    .search-icon { font-size: 18px; color: #aaa; flex-shrink: 0; }
    .search-input { border: none; outline: none; background: transparent; font-size: 14px; color: #333; width: 100%; padding: 8px 0; font-family: inherit; }
    .search-clear { width: 24px; height: 24px; flex-shrink: 0; }
    .search-results { position: absolute; top: calc(100% + 6px); left: 0; right: 0; background: white; border-radius: 10px; box-shadow: 0 8px 32px rgba(0,0,0,0.14); border: 1px solid #e8ecef; z-index: 200; overflow: hidden; }
    .search-result-item { display: flex; align-items: center; gap: 10px; padding: 10px 14px; cursor: pointer; transition: background 0.15s; }
    .search-result-item:hover { background: #f5f7fa; }
    .result-icon { font-size: 18px; color: #1e3870; flex-shrink: 0; }
    .result-body { flex: 1; min-width: 0; }
    .result-title { font-size: 13px; font-weight: 600; color: #222; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .result-sub { font-size: 11px; color: #888; }
    .result-badge { font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 20px; text-transform: uppercase; flex-shrink: 0; }
    .badge-case { background: #e8edf8; color: #1e3870; }
    .badge-provider { background: #e8f5e9; color: #2e7d32; }
    .badge-client { background: #fff3e0; color: #e65100; }
    .badge-invoice { background: #fce4ec; color: #c62828; }
    .no-results { padding: 16px; text-align: center; font-size: 13px; color: #aaa; }

    /* User */
    .user-btn { display: flex; align-items: center; gap: 8px; border-radius: 8px; padding: 4px 8px; }
    .user-avatar { width: 32px; height: 32px; border-radius: 50%; background: #1e3870; color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; flex-shrink: 0; }
    .user-name { font-size: 13px; font-weight: 600; display: block; }
    .user-role { font-size: 11px; color: #999; display: block; }

    /* Notifications */
    .notif-header { display: flex; justify-content: space-between; align-items: center; padding: 8px 16px; font-weight: 600; font-size: 14px; }
    .notif-list { max-height: 340px; overflow-y: auto; min-width: 320px; }
    .notif-item { display: flex; gap: 10px; padding: 10px 16px; cursor: pointer; border-bottom: 1px solid #f5f5f5; transition: background 0.15s; }
    .notif-item.unread { background: #f0f4ff; }
    .notif-item:hover { background: #f5f7fa; }
    .notif-icon { font-size: 18px; color: #1e3870; margin-top: 2px; flex-shrink: 0; }
    .notif-title { font-size: 13px; font-weight: 600; }
    .notif-msg { font-size: 12px; color: #666; margin-top: 2px; }
    .notif-time { font-size: 11px; color: #aaa; margin-top: 4px; }
    .notif-empty { padding: 24px; text-align: center; color: #bbb; font-size: 13px; }
    .notif-empty mat-icon { font-size: 32px; width: 32px; height: 32px; display: block; margin: 0 auto 8px; }
  `]
})
export class TopbarComponent {
  @Input() sidebarCollapsed = false;
  @Output() toggleSidebar = new EventEmitter<void>();
  auth = inject(AuthService);
  notifService = inject(NotificationService);
  private api = inject(ApiService);
  private router = inject(Router);
  private el = inject(ElementRef);

  @HostListener('document:click', ['$event.target'])
  onDocumentClick(target: HTMLElement) {
    if (!this.el.nativeElement.querySelector('.search-wrapper')?.contains(target)) {
      this.closeSearch();
    }
  }
  today = new Date();
  lang = signal<'en'|'ar'>('en');
  searchQuery = '';
  searchResults = signal<any[]>([]);
  searchActive = signal(false);
  searching = signal(false);
  private search$ = new Subject<string>();

  constructor() {
    this.search$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(q => q.length >= 2 ? this.api.get<any[]>(`/search?q=${encodeURIComponent(q)}`) : of([]))
    ).subscribe(results => { this.searchResults.set(results); this.searching.set(false); });
  }

  onSearch() {
    if (this.searchQuery.length >= 2) { this.searching.set(true); this.search$.next(this.searchQuery); }
    else { this.searchResults.set([]); }
  }
  clearSearch() { this.searchQuery = ''; this.searchResults.set([]); }
  closeSearch() { this.searchActive.set(false); }
  navigateTo(url: string) { this.router.navigateByUrl(url); this.clearSearch(); this.closeSearch(); }

  toggleLang() {
    const newLang = this.lang() === 'en' ? 'ar' : 'en';
    this.lang.set(newLang);
    document.documentElement.setAttribute('dir', newLang === 'ar' ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', newLang);
  }

  getResultIcon(type: string): string {
    return { case: 'folder_open', provider: 'local_hospital', client: 'business', invoice: 'receipt' }[type] || 'search';
  }
  getNotifIcon(type: string): string {
    const icons: Record<string, string> = {
      SLA_BREACH: 'timer_off', OVERDUE_INVOICE: 'receipt_long', CASE_UPDATE: 'folder_open',
      PROVIDER_ISSUE: 'warning', CONTRACT_EXPIRY: 'description', HIGH_COST: 'trending_up', GENERAL: 'info'
    };
    return icons[type] || 'notifications';
  }
}
