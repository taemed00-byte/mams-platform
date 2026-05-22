import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from './api.service';
import { Notification } from '../models/notification.model';
import { interval } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private api = inject(ApiService);
  notifications = signal<Notification[]>([]);
  unreadCount = signal(0);

  startPolling() {
    this.loadNotifications();
    interval(30000).subscribe(() => this.loadNotifications());
  }

  loadNotifications() {
    this.api.get<Notification[]>('/notifications').subscribe({
      next: n => {
        this.notifications.set(n);
        this.unreadCount.set(n.filter(x => !x.is_read).length);
      }
    });
  }

  markRead(id: string) {
    this.api.put(`/notifications/${id}/read`, {}).subscribe(() => this.loadNotifications());
  }

  markAllRead() {
    this.api.put('/notifications/mark-all-read', {}).subscribe(() => this.loadNotifications());
  }
}
