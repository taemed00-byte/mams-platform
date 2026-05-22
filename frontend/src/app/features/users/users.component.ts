import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { User } from '../../core/models/user.model';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatTableModule, MatButtonModule, MatIconModule, MatDialogModule, MatInputModule, MatSelectModule, MatChipsModule, MatTooltipModule],
  template: `
    <div>
      <div class="page-header">
        <div><h1>User Management</h1><p class="subtitle">{{users().length}} users · Role-based access control</p></div>
        <button mat-raised-button color="primary" (click)="showForm = !showForm"><mat-icon>person_add</mat-icon> Add User</button>
      </div>

      <!-- Add User Form -->
      <div class="mams-card" *ngIf="showForm" style="margin-bottom:20px">
        <h3 style="margin:0 0 16px;color:#1e3870">New User</h3>
        <form [formGroup]="form" (ngSubmit)="createUser()" class="form-grid">
          <mat-form-field appearance="outline"><mat-label>Full Name</mat-label><input matInput formControlName="name"></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Email</mat-label><input matInput type="email" formControlName="email"></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Password</mat-label><input matInput type="password" formControlName="password"></mat-form-field>
          <mat-form-field appearance="outline"><mat-label>Role</mat-label>
            <mat-select formControlName="role">
              <mat-option *ngFor="let r of roles" [value]="r">{{r}}</mat-option>
            </mat-select>
          </mat-form-field>
          <div class="form-actions">
            <button mat-button type="button" (click)="showForm = false">Cancel</button>
            <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid || saving()">Create User</button>
          </div>
        </form>
      </div>

      <!-- Users Table -->
      <div class="table-card">
        <table mat-table [dataSource]="users()">
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>User</th>
            <td mat-cell *matCellDef="let u">
              <div class="user-cell">
                <div class="user-avatar-sm">{{u.name.charAt(0)}}</div>
                <div><div class="user-name">{{u.name}}</div><div class="user-email">{{u.email}}</div></div>
              </div>
            </td>
          </ng-container>
          <ng-container matColumnDef="role">
            <th mat-header-cell *matHeaderCellDef>Role</th>
            <td mat-cell *matCellDef="let u"><span class="role-chip role-{{u.role.toLowerCase()}}">{{u.role}}</span></td>
          </ng-container>
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>Status</th>
            <td mat-cell *matCellDef="let u"><span class="status-pill" [class]="u.is_active ? 'status-approved' : 'status-cancelled'">{{u.is_active ? 'Active' : 'Inactive'}}</span></td>
          </ng-container>
          <ng-container matColumnDef="last_login">
            <th mat-header-cell *matHeaderCellDef>Last Login</th>
            <td mat-cell *matCellDef="let u">{{u.last_login ? (u.last_login | date:'dd/MM/yyyy HH:mm') : 'Never'}}</td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef>Actions</th>
            <td mat-cell *matCellDef="let u">
              <button mat-icon-button (click)="toggleActive(u)" [matTooltip]="u.is_active ? 'Deactivate' : 'Activate'">
                <mat-icon>{{u.is_active ? 'person_off' : 'person'}}</mat-icon>
              </button>
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="cols"></tr>
          <tr mat-row *matRowDef="let row; columns: cols" class="table-row"></tr>
        </table>
        <div *ngIf="users().length === 0" class="empty-state"><mat-icon>people</mat-icon><h3>No users found</h3></div>
      </div>

      <!-- RBAC Info -->
      <div class="mams-card" style="margin-top:20px">
        <h3 style="margin:0 0 16px;color:#1e3870">Role Permissions</h3>
        <div class="rbac-grid">
          <div class="rbac-card" *ngFor="let role of rolePermissions">
            <div class="rbac-role role-{{role.name.toLowerCase()}}">{{role.name}}</div>
            <ul class="rbac-perms">
              <li *ngFor="let p of role.permissions">✓ {{p}}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px}
    .page-header h1{margin:0;font-size:26px;font-weight:700;color:#1e3870}.subtitle{margin:4px 0 0;color:#888;font-size:13px}
    .mams-card{background:white;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,0.08);padding:24px}
    .form-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
    mat-form-field{width:100%}
    .form-actions{grid-column:1/-1;display:flex;justify-content:flex-end;gap:10px}
    .table-card{background:white;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,0.08);overflow:hidden}
    .user-cell{display:flex;align-items:center;gap:10px}
    .user-avatar-sm{width:32px;height:32px;border-radius:50%;background:#1e3870;color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;flex-shrink:0}
    .user-name{font-size:13px;font-weight:600}.user-email{font-size:12px;color:#888}
    .role-chip{padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700;text-transform:uppercase}
    .role-administrator{background:#fde8e8;color:#c62828}
    .role-operations{background:#e8f0ff;color:#1e3870}
    .role-finance{background:#e8f5e9;color:#2e7d32}
    .role-sales{background:#fff8e1;color:#f57f17}
    .table-row:hover{background:#f8f9fa}
    .empty-state{display:flex;flex-direction:column;align-items:center;padding:48px;color:#aaa}
    .rbac-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
    .rbac-card{border:1px solid #eee;border-radius:8px;padding:16px}
    .rbac-role{font-weight:700;font-size:13px;margin-bottom:10px;padding:4px 10px;border-radius:6px;display:inline-block}
    .rbac-perms{margin:0;padding-left:0;list-style:none;font-size:12px;color:#555;display:flex;flex-direction:column;gap:4px}
  `]
})
export class UsersComponent implements OnInit {
  private api = inject(ApiService); private toast = inject(ToastService); private fb = inject(FormBuilder);
  users = signal<User[]>([]); saving = signal(false); showForm = false;
  roles = ['Administrator','Operations','Finance','Sales'];
  cols = ['name','role','status','last_login','actions'];
  form = this.fb.group({ name: ['', Validators.required], email: ['', [Validators.required, Validators.email]], password: ['', Validators.required], role: ['Operations'] });
  rolePermissions = [
    { name: 'Administrator', permissions: ['All modules full access', 'User management', 'System settings', 'Audit log'] },
    { name: 'Operations', permissions: ['Cases — full edit', 'Providers — edit', 'Reports — view/export', 'Audit — view'] },
    { name: 'Finance', permissions: ['Finance — full edit', 'Clients — edit', 'Cases — view only', 'Reports — export'] },
    { name: 'Sales', permissions: ['Clients — full edit', 'Cases — view only', 'Finance — view only', 'Reports — view'] },
  ];
  ngOnInit() { this.load(); }
  load() { this.api.get<User[]>('/users').subscribe(u => this.users.set(u)); }
  createUser() {
    this.saving.set(true);
    this.api.post<User>('/users', this.form.value).subscribe({
      next: () => { this.toast.success('User created'); this.load(); this.form.reset({ role: 'Operations' }); this.showForm = false; this.saving.set(false); },
      error: (e) => { this.toast.error(e.error?.detail || 'Failed'); this.saving.set(false); }
    });
  }
  toggleActive(u: User) {
    this.api.put(`/users/${u.id}`, { is_active: !u.is_active }).subscribe(() => { this.toast.success(`User ${u.is_active ? 'deactivated' : 'activated'}`); this.load(); });
  }
}
