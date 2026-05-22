import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ApiService } from '../../../core/services/api.service';
import { Provider } from '../../../core/models/provider.model';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-providers-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, MatTableModule, MatButtonModule, MatIconModule, MatInputModule, MatSelectModule, MatTooltipModule, MatDialogModule],
  template: `
    <div>
      <div class="page-header">
        <div><h1>Provider Network</h1><p class="subtitle">{{providers().length}} providers</p></div>
        <div class="header-actions">
          <button mat-stroked-button (click)="exportExcel()"><mat-icon>download</mat-icon> Export</button>
          <button mat-raised-button color="primary" routerLink="/providers/new"><mat-icon>add</mat-icon> Add Provider</button>
        </div>
      </div>
      <div class="mams-card filters-bar">
        <mat-form-field appearance="outline" class="search-field"><mat-label>Search</mat-label><mat-icon matPrefix>search</mat-icon><input matInput [(ngModel)]="filters.search" (ngModelChange)="load()"></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Category</mat-label><mat-select [(ngModel)]="filters.category" (ngModelChange)="load()"><mat-option value="">All</mat-option><mat-option *ngFor="let c of categories" [value]="c">{{c}}</mat-option></mat-select></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Tier</mat-label><mat-select [(ngModel)]="filters.tier" (ngModelChange)="load()"><mat-option value="">All</mat-option><mat-option *ngFor="let t of tiers" [value]="t">{{t}}</mat-option></mat-select></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Country</mat-label><mat-select [(ngModel)]="filters.country" (ngModelChange)="load()"><mat-option value="">All</mat-option><mat-option *ngFor="let c of countries" [value]="c">{{c}}</mat-option></mat-select></mat-form-field>
      </div>
      <div class="table-card">
        <table mat-table [dataSource]="providers()">
          <ng-container matColumnDef="name"><th mat-header-cell *matHeaderCellDef>Name</th><td mat-cell *matCellDef="let p"><a [routerLink]="['/providers', p.id]" class="link">{{p.name}}</a></td></ng-container>
          <ng-container matColumnDef="category"><th mat-header-cell *matHeaderCellDef>Category</th><td mat-cell *matCellDef="let p"><span class="type-chip">{{p.category}}</span></td></ng-container>
          <ng-container matColumnDef="tier"><th mat-header-cell *matHeaderCellDef>Tier</th><td mat-cell *matCellDef="let p"><span class="status-pill" [class]="'tier-' + p.tier.toLowerCase()">{{p.tier}}</span></td></ng-container>
          <ng-container matColumnDef="country"><th mat-header-cell *matHeaderCellDef>Country</th><td mat-cell *matCellDef="let p">{{p.country || '—'}}</td></ng-container>
          <ng-container matColumnDef="city"><th mat-header-cell *matHeaderCellDef>City</th><td mat-cell *matCellDef="let p">{{p.city || '—'}}</td></ng-container>
          <ng-container matColumnDef="cases"><th mat-header-cell *matHeaderCellDef>Cases</th><td mat-cell *matCellDef="let p">{{p.total_cases}}</td></ng-container>
          <ng-container matColumnDef="rating"><th mat-header-cell *matHeaderCellDef>Rating</th><td mat-cell *matCellDef="let p">★ {{p.rating | number:'1.1-1'}}</td></ng-container>
          <ng-container matColumnDef="actions"><th mat-header-cell *matHeaderCellDef>Actions</th><td mat-cell *matCellDef="let p">
            <button mat-icon-button [routerLink]="['/providers', p.id]" matTooltip="View"><mat-icon>visibility</mat-icon></button>
            <button mat-icon-button [routerLink]="['/providers/new']" [queryParams]="{edit: p.id}" matTooltip="Edit"><mat-icon>edit</mat-icon></button>
            <button mat-icon-button color="warn" (click)="deleteProvider(p)" matTooltip="Delete"><mat-icon>delete</mat-icon></button>
          </td></ng-container>
          <tr mat-header-row *matHeaderRowDef="cols"></tr>
          <tr mat-row *matRowDef="let row; columns: cols" class="table-row"></tr>
        </table>
        <div *ngIf="providers().length === 0" class="empty-state"><mat-icon>local_hospital</mat-icon><h3>No providers found</h3></div>
      </div>
    </div>
  `,
  styles: [`.page-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px}.page-header h1{margin:0;font-size:26px;font-weight:700;color:#1e3870}.subtitle{margin:4px 0 0;color:#888;font-size:13px}.header-actions{display:flex;gap:10px}.filters-bar{display:flex;gap:12px;flex-wrap:wrap;padding:16px 20px;margin-bottom:16px}.search-field{flex:1;min-width:200px}.filters-bar mat-form-field{min-width:130px}.table-card{background:white;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,0.08);overflow:hidden}.link{color:#1e3870;font-weight:600;text-decoration:none}.type-chip{background:#f0f4ff;color:#1e3870;padding:2px 8px;border-radius:8px;font-size:11px}.empty-state{display:flex;flex-direction:column;align-items:center;padding:48px;color:#aaa}.table-row:hover{background:#f8f9fa}`]
})
export class ProvidersListComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private dialog = inject(MatDialog);
  providers = signal<Provider[]>([]);
  filters: any = { search: '', category: '', tier: '', country: '' };
  categories = ['Hospital','Clinic','Pharmacy','Ambulance','Laboratory'];
  tiers = ['Preferred','Standard','Blacklisted'];
  countries = ['Egypt','Germany','Spain','UAE','USA'];
  cols = ['name','category','tier','country','city','cases','rating','actions'];
  ngOnInit() { this.load(); }
  load() {
    const p: any = {};
    if (this.filters.search) p.search = this.filters.search;
    if (this.filters.category) p.category = this.filters.category;
    if (this.filters.tier) p.tier = this.filters.tier;
    if (this.filters.country) p.country = this.filters.country;
    this.api.get<Provider[]>('/providers', p).subscribe(d => this.providers.set(d));
  }
  exportExcel() { this.api.download('/providers/export/excel').subscribe(b => { const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download='providers.xlsx';a.click(); }); }

  deleteProvider(p: Provider) {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: { title: 'Delete Provider', message: `Delete "${p.name}"? This cannot be undone.`, confirmLabel: 'Delete', danger: true }
    });
    ref.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.api.delete(`/providers/${p.id}`).subscribe({
        next: () => { this.toast.success('Provider deleted'); this.providers.update(list => list.filter(x => x.id !== p.id)); },
        error: () => this.toast.error('Failed to delete provider')
      });
    });
  }
}
