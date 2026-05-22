import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, Validators, ReactiveFormsModule, ValidatorFn, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';

// Cross-field validator: contract end must be after contract start
const contractDateOrderValidator: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const start = group.get('contract_start')?.value;
  const end = group.get('contract_end')?.value;
  if (start && end && new Date(end) <= new Date(start)) {
    return { contractDateOrder: true };
  }
  return null;
};

@Component({
  selector: 'app-provider-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, MatInputModule, MatSelectModule,
            MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <div class="form-page">
      <div class="form-header">
        <button mat-icon-button routerLink="/providers"><mat-icon>arrow_back</mat-icon></button>
        <div>
          <h1>{{isEdit ? 'Edit' : 'Add'}} Provider</h1>
          <p class="subtitle">{{isEdit ? 'Update provider details' : 'Add a new network provider'}}</p>
        </div>
      </div>

      <div class="mams-card" style="padding:24px;max-width:800px">
        <form [formGroup]="form" (ngSubmit)="onSubmit()">
          <div class="form-grid">

            <mat-form-field appearance="outline">
              <mat-label>Name *</mat-label>
              <input matInput formControlName="name">
              <mat-error *ngIf="form.get('name')?.hasError('required')">Name is required</mat-error>
              <mat-error *ngIf="form.get('name')?.hasError('minlength')">Name must be at least 2 characters</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Category *</mat-label>
              <mat-select formControlName="category">
                <mat-option *ngFor="let c of categories" [value]="c">{{c}}</mat-option>
              </mat-select>
              <mat-error *ngIf="form.get('category')?.hasError('required')">Category is required</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Tier</mat-label>
              <mat-select formControlName="tier">
                <mat-option *ngFor="let t of tiers" [value]="t">{{t}}</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Country</mat-label>
              <mat-select formControlName="country">
                <mat-option *ngFor="let c of countries" [value]="c">{{c}}</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>City</mat-label>
              <input matInput formControlName="city">
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Contact Name</mat-label>
              <input matInput formControlName="contact_name">
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Phone</mat-label>
              <input matInput formControlName="phone" placeholder="+1 234 567 8900">
              <mat-error *ngIf="form.get('phone')?.hasError('pattern')">Enter a valid phone number</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Email</mat-label>
              <input matInput type="email" formControlName="email">
              <mat-error *ngIf="form.get('email')?.hasError('email')">Enter a valid email address</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-col">
              <mat-label>Specialties</mat-label>
              <input matInput formControlName="specialties" placeholder="Cardiology, Orthopedics...">
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Contract Start</mat-label>
              <input matInput type="date" formControlName="contract_start">
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Contract End</mat-label>
              <input matInput type="date" formControlName="contract_end">
              <mat-error *ngIf="form.hasError('contractDateOrder') && form.get('contract_end')?.touched">
                End date must be after start date
              </mat-error>
            </mat-form-field>

          </div>

          <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:20px">
            <button mat-button type="button" routerLink="/providers">Cancel</button>
            <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid || loading()">
              <mat-progress-spinner *ngIf="loading()" diameter="18" mode="indeterminate" style="display:inline-block"/>
              <span *ngIf="!loading()">{{isEdit ? 'Update' : 'Add'}} Provider</span>
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
    .full-col { grid-column: 1 / -1; }
    mat-form-field { width: 100%; }
  `]
})
export class ProviderFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastService);

  loading = signal(false);
  isEdit = false;
  providerId: string | null = null;

  categories = ['Hospital','Clinic','Pharmacy','Ambulance','Laboratory'];
  tiers = ['Preferred','Standard','Blacklisted'];
  countries = ['Egypt','Germany','Spain','UAE','USA'];

  form = this.fb.group({
    name:           ['', [Validators.required, Validators.minLength(2)]],
    category:       ['Hospital', Validators.required],
    tier:           ['Standard'],
    country:        [''],
    city:           [''],
    contact_name:   [''],
    phone:          ['', [Validators.pattern(/^[+\d\s\-().]{0,20}$/)]],
    email:          ['', [Validators.email]],
    specialties:    [''],
    contract_start: [''],
    contract_end:   ['']
  }, { validators: contractDateOrderValidator });

  ngOnInit() {
    this.providerId = this.route.snapshot.queryParamMap.get('edit');
    this.isEdit = !!this.providerId;
    if (this.isEdit && this.providerId) {
      this.api.get<any>(`/providers/${this.providerId}`).subscribe({
        next: (p) => this.form.patchValue(p),
        error: () => this.toast.error('Failed to load provider')
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
    const req = this.isEdit
      ? this.api.put(`/providers/${this.providerId}`, payload)
      : this.api.post('/providers', payload);
    req.subscribe({
      next: () => { this.toast.success('Provider saved'); this.router.navigate(['/providers']); },
      error: (e) => { this.toast.error(e.error?.detail || 'Failed to save provider'); this.loading.set(false); }
    });
  }
}
