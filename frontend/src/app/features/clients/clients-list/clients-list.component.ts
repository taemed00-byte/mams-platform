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
import { Client } from '../../../core/models/client.model';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-clients-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, MatTableModule, MatButtonModule, MatIconModule, MatInputModule, MatSelectModule, MatTooltipModule, MatDialogModule],
  template: `
    <div>
      <div class="page-header">
        <div><h1>Clients & Sales</h1><p class="subtitle">{{clients().length}} clients</p></div>
        <div class="header-actions">
          <button mat-stroked-button (click)="exportExcel()"><mat-icon>download</mat-icon> Export</button>
          <button mat-raised-button color="primary" routerLink="/clients/new"><mat-icon>add</mat-icon> Add Client</button>
        </div>
      </div>
      <div class="mams-card filters-bar">
        <mat-form-field appearance="outline" class="search-field"><mat-label>Search</mat-label><mat-icon matPrefix>search</mat-icon><input matInput [(ngModel)]="search" (ngModelChange)="load()"></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Type</mat-label><mat-select [(ngModel)]="typeFilter" (ngModelChange)="load()"><mat-option value="">All</mat-option><mat-option *ngFor="let t of clientTypes" [value]="t">{{t}}</mat-option></mat-select></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Pipeline</mat-label><mat-select [(ngModel)]="stageFilter" (ngModelChange)="load()"><mat-option value="">All</mat-option><mat-option *ngFor="let s of stages" [value]="s">{{s}}</mat-option></mat-select></mat-form-field>
      </div>
      <div class="table-card">
        <table mat-table [dataSource]="clients()">
          <ng-container matColumnDef="name"><th mat-header-cell *matHeaderCellDef>Name</th><td mat-cell *matCellDef="let c"><a [routerLink]="['/clients', c.id]" class="link">{{c.name}}</a></td></ng-container>
          <ng-container matColumnDef="type"><th mat-header-cell *matHeaderCellDef>Type</th><td mat-cell *matCellDef="let c"><span class="type-chip">{{c.client_type}}</span></td></ng-container>
          <ng-container matColumnDef="pipeline"><th mat-header-cell *matHeaderCellDef>Pipeline</th><td mat-cell *matCellDef="let c"><span class="status-pill" [class]="getPipelineClass(c.pipeline_stage)">{{c.pipeline_stage}}</span></td></ng-container>
          <ng-container matColumnDef="active"><th mat-header-cell *matHeaderCellDef>Status</th><td mat-cell *matCellDef="let c"><span class="status-pill" [class]="c.is_active ? 'status-approved' : 'status-cancelled'">{{c.is_active ? 'Active' : 'Inactive'}}</span></td></ng-container>
          <ng-container matColumnDef="cases"><th mat-header-cell *matHeaderCellDef>Cases</th><td mat-cell *matCellDef="let c">{{c.total_cases}}</td></ng-container>
          <ng-container matColumnDef="revenue"><th mat-header-cell *matHeaderCellDef>Revenue</th><td mat-cell *matCellDef="let c">\${{c.total_revenue | number:'1.0-0'}}</td></ng-container>
          <ng-container matColumnDef="country"><th mat-header-cell *matHeaderCellDef>Country</th><td mat-cell *matCellDef="let c">{{c.country || '—'}}</td></ng-container>
          <ng-container matColumnDef="actions"><th mat-header-cell *matHeaderCellDef>Actions</th><td mat-cell *matCellDef="let c">
            <button mat-icon-button [routerLink]="['/clients', c.id]" matTooltip="View"><mat-icon>visibility</mat-icon></button>
            <button mat-icon-button color="warn" (click)="deleteClient(c)" matTooltip="Delete"><mat-icon>delete</mat-icon></button>
          </td></ng-container>
          <tr mat-header-row *matHeaderRowDef="cols"></tr>
          <tr mat-row *matRowDef="let row; columns: cols" class="table-row"></tr>
        </table>
        <div *ngIf="clients().length === 0" class="empty-state"><mat-icon>business</mat-icon><h3>No clients found</h3></div>
      </div>
    </div>
  `,
  styles: [`.page-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px}.page-header h1{margin:0;font-size:26px;font-weight:700;color:#1e3870}.subtitle{margin:4px 0 0;color:#888;font-size:13px}.header-actions{display:flex;gap:10px}.filters-bar{display:flex;gap:12px;flex-wrap:wrap;padding:16px 20px;margin-bottom:16px}.search-field{flex:1}.table-card{background:white;border-radius:12px;box-shadow:0 1px 4px rgba(0,0,0,0.08);overflow:hidden}.link{color:#1e3870;font-weight:600;text-decoration:none}.type-chip{background:#f0f4ff;color:#1e3870;padding:2px 8px;border-radius:8px;font-size:11px}.table-row:hover{background:#f8f9fa}.empty-state{display:flex;flex-direction:column;align-items:center;padding:48px;color:#aaa}`]
})
export class ClientsListComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private dialog = inject(MatDialog);
  clients = signal<Client[]>([]); search = ''; typeFilter = ''; stageFilter = '';
  clientTypes = ['Insurance Company','Assistance Company','Corporate','Hotel','Individual'];
  stages = ['Lead','Opportunity','Won','Lost'];
  cols = ['name','type','pipeline','active','cases','revenue','country','actions'];
  ngOnInit() { this.load(); }
  load() { const p: any={}; if(this.search) p.search=this.search; if(this.typeFilter) p.client_type=this.typeFilter; if(this.stageFilter) p.pipeline_stage=this.stageFilter; this.api.get<Client[]>('/clients',p).subscribe(c => this.clients.set(c)); }
  getPipelineClass(stage: string) { return stage==='Won' ? 'status-approved' : stage==='Lost' ? 'status-cancelled' : stage==='Opportunity' ? 'status-pending' : 'status-open'; }
  exportExcel() { this.api.download('/clients/export/excel').subscribe(b => { const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download='clients.xlsx';a.click(); }); }

  deleteClient(c: Client) {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: { title: 'Delete Client', message: `Delete "${c.name}"? This cannot be undone.`, confirmLabel: 'Delete', danger: true }
    });
    ref.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.api.delete(`/clients/${c.id}`).subscribe({
        next: () => { this.toast.success('Client deleted'); this.clients.update(list => list.filter(x => x.id !== c.id)); },
        error: () => this.toast.error('Failed to delete client')
      });
    });
  }
}
