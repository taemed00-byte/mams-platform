import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, Validators, ReactiveFormsModule, ValidatorFn, AbstractControl, ValidationErrors } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatStepperModule } from '@angular/material/stepper';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';
import { Case } from '../../../core/models/case.model';
import { LocationPickerComponent } from '../../../shared/components/location-picker/location-picker.component';

// ── Custom Validators ────────────────────────────────────────────────────────

function dobValidator(): ValidatorFn {
  return (ctrl: AbstractControl): ValidationErrors | null => {
    if (!ctrl.value) return null;
    const dob = new Date(ctrl.value);
    if (isNaN(dob.getTime())) return { dobInvalid: true };
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (dob >= today) return { dobFuture: true };
    const minDate = new Date(today.getFullYear() - 120, today.getMonth(), today.getDate());
    if (dob < minDate) return { dobTooOld: true };
    return null;
  };
}

function minValueValidator(min: number): ValidatorFn {
  return (ctrl: AbstractControl): ValidationErrors | null => {
    const v = ctrl.value;
    if (v === null || v === undefined || v === '') return null;
    return Number(v) < min ? { minValue: min } : null;
  };
}

@Component({
  selector: 'app-case-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink, MatInputModule, MatSelectModule,
            MatButtonModule, MatIconModule, MatStepperModule, MatCardModule,
            MatProgressSpinnerModule, MatDividerModule, LocationPickerComponent],
  template: `
    <div class="form-page">
      <div class="form-header">
        <button mat-icon-button routerLink="/cases"><mat-icon>arrow_back</mat-icon></button>
        <div>
          <h1>{{isEdit ? 'Edit Case' : 'New Case'}}</h1>
          <p class="subtitle">{{isEdit ? 'Update case details' : 'Create a new assistance case'}}</p>
        </div>
      </div>

      <mat-stepper [linear]="!isEdit" #stepper class="mams-card">

        <!-- ── Step 1: Patient Info ── -->
        <mat-step [stepControl]="patientForm" label="Patient Information">
          <form [formGroup]="patientForm" class="step-form">
            <div class="form-grid">

              <mat-form-field appearance="outline">
                <mat-label>Full Name *</mat-label>
                <input matInput formControlName="name" placeholder="John Smith">
                <mat-error *ngIf="patientForm.get('name')?.hasError('required')">Name is required</mat-error>
                <mat-error *ngIf="patientForm.get('name')?.hasError('minlength')">Name must be at least 2 characters</mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Nationality</mat-label>
                <input matInput formControlName="nationality">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Passport Number</mat-label>
                <input matInput formControlName="passport_number">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Date of Birth</mat-label>
                <input matInput type="date" formControlName="date_of_birth">
                <mat-error *ngIf="patientForm.get('date_of_birth')?.hasError('dobFuture')">Date of birth cannot be today or in the future</mat-error>
                <mat-error *ngIf="patientForm.get('date_of_birth')?.hasError('dobTooOld')">Age cannot exceed 120 years</mat-error>
                <mat-error *ngIf="patientForm.get('date_of_birth')?.hasError('dobInvalid')">Invalid date</mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Gender</mat-label>
                <mat-select formControlName="gender">
                  <mat-option value="Male">Male</mat-option>
                  <mat-option value="Female">Female</mat-option>
                  <mat-option value="Other">Other</mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Phone</mat-label>
                <input matInput formControlName="phone" placeholder="+1 234 567 8900">
                <mat-error *ngIf="patientForm.get('phone')?.hasError('pattern')">Enter a valid phone number</mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Email</mat-label>
                <input matInput type="email" formControlName="email">
                <mat-error *ngIf="patientForm.get('email')?.hasError('email')">Enter a valid email address</mat-error>
              </mat-form-field>

            </div>
            <div class="step-actions">
              <button mat-raised-button color="primary" matStepperNext
                      (click)="touchStep('patient')"
                      [disabled]="patientForm.invalid">Next</button>
            </div>
          </form>
        </mat-step>

        <!-- ── Step 2: Case Details ── -->
        <mat-step [stepControl]="caseForm" label="Case Details">
          <form [formGroup]="caseForm" class="step-form">
            <div class="form-grid">

              <mat-form-field appearance="outline">
                <mat-label>Case Type *</mat-label>
                <mat-select formControlName="case_type">
                  <mat-option *ngFor="let t of caseTypes" [value]="t">{{t}}</mat-option>
                </mat-select>
                <mat-error *ngIf="caseForm.get('case_type')?.hasError('required')">Case type is required</mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Priority *</mat-label>
                <mat-select formControlName="priority">
                  <mat-option *ngFor="let p of priorities" [value]="p">{{p}}</mat-option>
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
                <mat-label>Location Address</mat-label>
                <input matInput formControlName="location_address">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Insurance Company</mat-label>
                <mat-select formControlName="client_id">
                  <mat-option value="">— None —</mat-option>
                  <mat-option *ngFor="let ic of insuranceCompanies()" [value]="ic.id">
                    {{ic.name}}
                    <span *ngIf="ic.country" style="color:#999;font-size:11px"> · {{ic.country}}</span>
                  </mat-option>
                </mat-select>
                <mat-hint>Select from existing insurance company clients</mat-hint>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Insurance Policy #</mat-label>
                <input matInput formControlName="insurance_policy_number">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Assigned Provider <span style="color:#aaa;font-size:11px">(optional)</span></mat-label>
                <mat-select formControlName="provider_id">
                  <mat-option value="">— Assign later —</mat-option>
                  <mat-option *ngFor="let p of providers()" [value]="p.id">
                    {{p.name}}
                    <span *ngIf="p.category" style="color:#999;font-size:11px"> · {{p.category}}</span>
                  </mat-option>
                </mat-select>
                <mat-hint>Can be assigned or changed later from the case detail</mat-hint>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>SLA Target (hours)</mat-label>
                <input matInput type="number" formControlName="sla_target_hours" min="1" max="720">
                <mat-error *ngIf="caseForm.get('sla_target_hours')?.hasError('min')">Minimum 1 hour</mat-error>
                <mat-error *ngIf="caseForm.get('sla_target_hours')?.hasError('max')">Maximum 720 hours (30 days)</mat-error>
              </mat-form-field>

              <div class="full-col">
                <label class="map-label">📍 Pin Location on Map <span style="color:#aaa;font-size:11px">(optional)</span></label>
                <app-location-picker (locationSelected)="onLocationSelected($event)"></app-location-picker>
              </div>

              <mat-form-field appearance="outline" class="full-col">
                <mat-label>Description / Clinical Notes</mat-label>
                <textarea matInput formControlName="description" rows="4"></textarea>
              </mat-form-field>

            </div>
            <div class="step-actions">
              <button mat-button matStepperPrevious>Back</button>
              <button mat-raised-button color="primary" matStepperNext
                      (click)="touchStep('case')"
                      [disabled]="caseForm.invalid">Next</button>
            </div>
          </form>
        </mat-step>

        <!-- ── Step 3: Costs & Documents ── -->
        <mat-step [stepControl]="financeForm" label="Costs &amp; Documents">
          <form class="step-form" [formGroup]="financeForm">

            <!-- Financial fields -->
            <div class="form-grid">
              <mat-form-field appearance="outline">
                <mat-label>Currency</mat-label>
                <mat-select formControlName="currency">
                  <mat-option *ngFor="let c of currencies" [value]="c">{{c}}</mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Estimated Cost</mat-label>
                <input matInput type="number" formControlName="estimated_cost" min="0">
                <mat-error *ngIf="financeForm.get('estimated_cost')?.hasError('minValue')">Cost cannot be negative</mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Actual Cost</mat-label>
                <input matInput type="number" formControlName="actual_cost" min="0">
                <mat-error *ngIf="financeForm.get('actual_cost')?.hasError('minValue')">Cost cannot be negative</mat-error>
              </mat-form-field>
            </div>

            <!-- Document Upload -->
            <div class="upload-section">
              <div class="section-label">
                <mat-icon>attach_file</mat-icon>
                <span>Attach Documents <span class="section-hint">(optional — passport, GOP, medical reports…)</span></span>
              </div>

              <div class="upload-zone"
                   (dragover)="$event.preventDefault()"
                   (drop)="onDrop($event)"
                   (click)="fileInput.click()">
                <mat-icon class="upload-icon">cloud_upload</mat-icon>
                <p>Click or drag &amp; drop files here</p>
                <p class="upload-hint">PDF, JPG, PNG, DOCX · up to 10 MB each</p>
                <input #fileInput type="file" multiple style="display:none" (change)="onFileSelect($event)">
              </div>

              <!-- Queued Files -->
              <div class="queue-list" *ngIf="uploadQueue().length > 0">
                <div class="queue-item" *ngFor="let item of uploadQueue(); let i = index">
                  <mat-icon class="file-icon">description</mat-icon>
                  <div class="file-name">
                    {{item.file.name}}
                    <span class="file-size">{{(item.file.size/1024).toFixed(0)}} KB</span>
                  </div>
                  <mat-select [(ngModel)]="item.docType" [ngModelOptions]="{standalone: true}" class="type-select">
                    <mat-option *ngFor="let t of docTypes" [value]="t">{{t}}</mat-option>
                  </mat-select>
                  <button mat-icon-button color="warn" (click)="removeFile(i)" type="button">
                    <mat-icon>close</mat-icon>
                  </button>
                </div>
              </div>
              <p class="queue-info" *ngIf="uploadQueue().length > 0">
                {{uploadQueue().length}} file(s) will be uploaded after the case is created
              </p>
            </div>

            <div class="step-actions">
              <button mat-button matStepperPrevious>Back</button>
              <button mat-raised-button color="primary" (click)="onSubmit()" [disabled]="loading()">
                <mat-progress-spinner *ngIf="loading()" diameter="18" mode="indeterminate" />
                <span *ngIf="!loading()">{{isEdit ? 'Update Case' : 'Create Case'}}</span>
              </button>
            </div>
          </form>
        </mat-step>

      </mat-stepper>
    </div>
  `,
  styles: [`
    .form-page { max-width: 860px; }
    .form-header { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
    .form-header h1 { margin: 0; font-size: 24px; font-weight: 700; color: #1e3870; }
    .subtitle { margin: 4px 0 0; color: #888; font-size: 13px; }
    .mams-card { border-radius: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
    .step-form { padding: 20px 0; }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .full-col { grid-column: 1 / -1; }
    .map-label { font-size: 13px; font-weight: 600; color: #555; display: block; margin-bottom: 8px; }
    mat-form-field { width: 100%; }
    .step-actions { display: flex; gap: 10px; margin-top: 24px; justify-content: flex-end; }

    /* Upload */
    .upload-section { margin-top: 24px; border-top: 1px solid #f0f0f0; padding-top: 20px; }
    .section-label { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; color: #1e3870; margin-bottom: 14px; }
    .section-label mat-icon { font-size: 18px; color: #c9a84c; }
    .section-hint { font-weight: 400; color: #aaa; font-size: 12px; }
    .upload-zone { border: 2px dashed #d0d7e6; border-radius: 10px; padding: 24px; text-align: center; color: #888; cursor: pointer; transition: all 0.2s; }
    .upload-zone:hover { border-color: #1e3870; background: #f0f4ff; }
    .upload-icon { font-size: 36px; width: 36px; height: 36px; color: #c9a84c; }
    .upload-hint { font-size: 12px; color: #aaa; margin: 4px 0 0; }
    .upload-zone p { margin: 8px 0 0; font-size: 14px; }
    .queue-list { margin-top: 12px; display: flex; flex-direction: column; gap: 8px; }
    .queue-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: #f0f4ff; border-radius: 8px; border: 1px solid #d0d9f0; }
    .file-icon { color: #1e3870; font-size: 20px; flex-shrink: 0; }
    .file-name { flex: 1; font-size: 13px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .file-size { color: #aaa; font-weight: 400; margin-left: 6px; font-size: 11px; }
    .type-select { width: 170px; font-size: 13px; }
    .queue-info { font-size: 12px; color: #888; margin: 8px 0 0; }
  `]
})
export class CaseFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastService);

  isEdit = false;
  caseId: string | null = null;
  loading = signal(false);
  uploadQueue = signal<{file: File, docType: string}[]>([]);
  insuranceCompanies = signal<any[]>([]);
  providers = signal<any[]>([]);

  caseTypes = ['Outpatient','Inpatient','Evacuation & Repatriation','Telemedicine','Concierge'];
  priorities = ['Low','Medium','High','Critical'];
  countries = ['Egypt','Germany','Spain','UAE','USA'];
  currencies = ['EUR','USD','EGP','AED'];
  docTypes = ['Passport','GOP','Medical Report','Lab Results','Discharge Summary','Invoice','X-Ray / Imaging','Consent Form','Insurance Card','Other'];

  patientForm = this.fb.group({
    name:             ['', [Validators.required, Validators.minLength(2)]],
    nationality:      [''],
    passport_number:  [''],
    date_of_birth:    ['', [dobValidator()]],
    gender:           [''],
    phone:            ['', [Validators.pattern(/^[+\d\s\-().]{0,20}$/)]],
    email:            ['', [Validators.email]]
  });

  caseForm = this.fb.group({
    case_type:               ['Outpatient', Validators.required],
    priority:                ['Medium', Validators.required],
    country:                 [''],
    city:                    [''],
    location_address:        [''],
    location_lat:            [null as number | null],
    location_lng:            [null as number | null],
    client_id:               ['' as string | null],
    insurance_policy_number: [''],
    provider_id:             ['' as string | null],
    sla_target_hours:        [24, [Validators.required, Validators.min(1), Validators.max(720)]],
    description:             ['']
  });

  financeForm = this.fb.group({
    currency:       ['USD'],
    estimated_cost: [0, [minValueValidator(0)]],
    actual_cost:    [0, [minValueValidator(0)]]
  });

  ngOnInit() {
    this.api.get<any[]>('/clients', { client_type: 'Insurance Company', limit: 200 })
      .subscribe(list => this.insuranceCompanies.set(list));
    this.api.get<any[]>('/providers', { limit: 200 })
      .subscribe(list => this.providers.set(list));

    this.caseId = this.route.snapshot.paramMap.get('id');
    this.isEdit = !!this.caseId && this.route.snapshot.url.some(s => s.path === 'edit');
    if (this.isEdit && this.caseId) {
      this.api.get<any>(`/cases/${this.caseId}`).subscribe(c => {
        this.caseForm.patchValue({
          ...c,
          client_id: c.client_id ?? '',
          provider_id: c.provider_id ?? ''
        });
        this.financeForm.patchValue(c);
        if (c.patient) this.patientForm.patchValue(c.patient);
      });
    }
  }

  touchStep(step: 'patient' | 'case') {
    if (step === 'patient') this.patientForm.markAllAsTouched();
    if (step === 'case') this.caseForm.markAllAsTouched();
  }

  onLocationSelected(loc: {lat: number, lng: number, address: string, city: string}) {
    if (loc.lat) {
      this.caseForm.patchValue({ location_lat: loc.lat, location_lng: loc.lng, location_address: loc.address });
      if (loc.city && !this.caseForm.value.city) this.caseForm.patchValue({ city: loc.city });
    }
  }

  // ── File Upload Queue ─────────────────────────────────────────────────────
  onFileSelect(event: Event) {
    const files = (event.target as HTMLInputElement).files;
    if (files) this.addToQueue(Array.from(files));
    (event.target as HTMLInputElement).value = '';
  }
  onDrop(event: DragEvent) {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (files) this.addToQueue(Array.from(files));
  }
  addToQueue(files: File[]) {
    const items = files.map(f => ({ file: f, docType: this.guessDocType(f.name) }));
    this.uploadQueue.update(q => [...q, ...items]);
  }
  guessDocType(name: string): string {
    const n = name.toLowerCase();
    if (n.includes('passport')) return 'Passport';
    if (n.includes('gop') || n.includes('guarantee')) return 'GOP';
    if (n.includes('invoice') || n.includes('bill')) return 'Invoice';
    if (n.includes('lab') || n.includes('result')) return 'Lab Results';
    if (n.includes('discharge')) return 'Discharge Summary';
    if (n.includes('xray') || n.includes('x-ray') || n.includes('mri') || n.includes('scan')) return 'X-Ray / Imaging';
    if (n.includes('report') || n.includes('medical')) return 'Medical Report';
    if (n.includes('consent')) return 'Consent Form';
    if (n.includes('insurance') || n.includes('card')) return 'Insurance Card';
    return 'Other';
  }
  removeFile(i: number) { this.uploadQueue.update(q => q.filter((_, idx) => idx !== i)); }

  // ── Submit ────────────────────────────────────────────────────────────────
  onSubmit() {
    this.patientForm.markAllAsTouched();
    this.caseForm.markAllAsTouched();
    this.financeForm.markAllAsTouched();
    if (this.patientForm.invalid || this.caseForm.invalid || this.financeForm.invalid) {
      this.toast.error('Please fix validation errors before submitting');
      return;
    }
    this.loading.set(true);
    const clean = (obj: any) => {
      const result: any = {};
      for (const key of Object.keys(obj)) {
        result[key] = obj[key] === '' ? null : obj[key];
      }
      return result;
    };
    const caseVals = this.caseForm.value as any;
    const payload: any = {
      ...clean(caseVals),
      client_id:   caseVals.client_id   || null,
      provider_id: caseVals.provider_id || null,
      ...clean(this.financeForm.value),
      patient: clean(this.patientForm.value)
    };
    const req = this.isEdit && this.caseId
      ? this.api.put<any>(`/cases/${this.caseId}`, payload)
      : this.api.post<any>('/cases', payload);

    req.subscribe({
      next: (savedCase) => {
        const queue = this.uploadQueue();
        if (!queue.length) {
          this.toast.success(this.isEdit ? 'Case updated' : 'Case created');
          this.router.navigate(['/cases', savedCase.id]);
          return;
        }
        // Upload queued documents after case is created
        let done = 0;
        let failed = 0;
        queue.forEach(item => {
          const fd = new FormData();
          fd.append('file', item.file);
          this.api.upload(`/cases/${savedCase.id}/documents?doc_type=${encodeURIComponent(item.docType)}`, fd).subscribe({
            next: () => {
              done++;
              if (done + failed === queue.length) this.finishAfterUploads(savedCase.id, done, failed);
            },
            error: () => {
              failed++;
              if (done + failed === queue.length) this.finishAfterUploads(savedCase.id, done, failed);
            }
          });
        });
      },
      error: (e) => {
        this.toast.error(e.error?.detail || 'Failed to save case');
        this.loading.set(false);
      }
    });
  }

  private finishAfterUploads(caseId: string, done: number, failed: number) {
    if (failed > 0) {
      this.toast.error(`Case saved but ${failed} file(s) failed to upload`);
    } else {
      this.toast.success(`Case created with ${done} document(s) attached`);
    }
    this.router.navigate(['/cases', caseId]);
  }
}
