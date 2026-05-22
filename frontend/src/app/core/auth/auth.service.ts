import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { environment } from '@env/environment';
import { User } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  private _token = signal<string | null>(localStorage.getItem('mams_token'));
  private _user = signal<User | null>(JSON.parse(localStorage.getItem('mams_user') || 'null'));

  token = this._token.asReadonly();
  user = this._user.asReadonly();
  isAuthenticated = computed(() => !!this._token());
  userRole = computed(() => this._user()?.role);

  login(email: string, password: string) {
    return this.http.post<{ access_token: string; user: User }>(`${environment.apiUrl}/auth/login`, { email, password })
      .pipe(tap(res => {
        this._token.set(res.access_token);
        this._user.set(res.user);
        localStorage.setItem('mams_token', res.access_token);
        localStorage.setItem('mams_user', JSON.stringify(res.user));
      }));
  }

  logout() {
    this._token.set(null);
    this._user.set(null);
    localStorage.removeItem('mams_token');
    localStorage.removeItem('mams_user');
    this.router.navigate(['/login']);
  }

  hasRole(...roles: string[]): boolean {
    return roles.includes(this._user()?.role || '');
  }
}
