import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-client-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, MatInputModule, MatSelectModule,
            MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <div class="form-page">
      <div class="form-header">
        <button mat-icon-button routerLink="/clients"><mat-icon>arrow_back</mat-icon></button>
        <div>
          <h1>{{isEdit ? 'Edit Client' : 'Add Client'}}</h1>
          <p class="subtitle">{{isEdit ? 'Update client details' : 'Register a new client or partner'}}</p>
        </div>
      </div>

      <div class="mams-card" style="padding:24px;max-width:700px">
        <form [formGroup]="form" (ngSubmit)="onSubmit()">
          <div class="form-grid">

            <mat-form-field appearance="outline">
              <mat-label>Company / Client Name *</mat-label>
              <input matInput formControlName="name">
              <mat-error *ngIf="form.get('name')?.hasError('required')">Name is required</mat-error>
              <mat-error *ngIf="form.get('name')?.hasError('minlength')">Name must be at least 2 characters</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Type *</mat-label>
              <mat-select formControlName="client_type">
                <mat-option *ngFor="let t of types" [value]="t">{{t}}</mat-option>
              </mat-select>
              <mat-error *ngIf="form.get('client_type')?.hasError('required')">Type is required</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Contact Name</mat-label>
              <input matInput formControlName="contact_name">
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Email</mat-label>
              <input matInput type="email" formControlName="email">
              <mat-error *ngIf="form.get('email')?.hasError('email')">Enter a valid email address</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Phone</mat-label>
              <input matInput formControlName="phone" placeholder="+1 234 567 8900">
              <mat-error *ngIf="form.get('phone')?.hasError('pattern')">Enter a valid phone number</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Country</mat-label>
              <mat-select formControlName="country">
                <mat-option *ngFor="let c of countries" [value]="c">{{c}}</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Pipeline Stage</mat-label>
              <mat-select formControlName="pipeline_stage">
                <mat-option *ngFor="let s of stages" [value]="s">{{s}}</mat-option>
              </mat-select>
            </mat-form-field>

          </div>
          <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:20px">
            <button mat-button type="button" routerLink="/clients">Cancel</button>
            <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid || loading()">
              <mat-progress-spinner *ngIf="loading()" diameter="18" mode="indeterminate" style="display:inline-block"/>
              <span *ngIf="!loading()">{{isEdit ? 'Update Client' : 'Add Client'}}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .form-page {}
    .form-header { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
    .form-header h1 { margin: 0; font-size: 24px; font-weight: 700; color: #1e3870; }
    .subtitle { margin: 4px 0 0; color: #888; font-size: 13px; }
    .mams-card { background: white; border-radius: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    mat-form-field { width: 100%; }
  `]
})
export class ClientFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastService);

  loading = signal(false);
  isEdit = false;
  clientId: string | null = null;

  types = ['Insurance Company','Assistance Company','Corporate','Hotel','Individual'];
  countries = ['Egypt','Germany','Spain','UAE','USA','Other'];
  stages = ['Lead','Opportunity','Won','Lost'];

  form = this.fb.group({
    name:          ['', [Validators.required, Validators.minLength(2)]],
    client_type:   ['Insurance Company', Validators.required],
    contact_name:  [''],
    email:         ['', [Validators.email]],
    phone:         ['', [Validators.pattern(/^[+\d\s\-().]{0,20}$/)]],
    country:       [''],
    pipeline_stage:['Lead']
  });

  ngOnInit() {
    this.clientId = this.route.snapshot.queryParamMap.get('edit');
    this.isEdit = !!this.clientId;
    if (this.isEdit && this.clientId) {
      this.api.get<any>(`/clients/${this.clientId}`).subscribe({
        next: (c) => this.form.patchValue(c),
        error: () => this.toast.error('Failed to load client')
      });
    }
  }

  onSubmit() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.loading.set(true);
    const payload = Object.fromEntries(
      Object.entries(this.form.value).map(([k, v]) => [k, v === '' ? null : v])
    );
    const req = this.isEdit && this.clientId
      ? this.api.put(`/clients/${this.clientId}`, payload)
      : this.api.post('/clients', payload);
    req.subscribe({
      next: () => { this.toast.success(this.isEdit ? 'Client updated' : 'Client added'); this.router.navigate(['/clients']); },
      error: (e) => { this.toast.error(e.error?.detail || 'Failed to save client'); this.loading.set(false); }
    });
  }
}
