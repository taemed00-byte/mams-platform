import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-case-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, MatTabsModule, MatButtonModule, MatIconModule,
            MatCardModule, MatChipsModule, MatDividerModule, MatFormFieldModule, MatInputModule,
            MatSelectModule, MatProgressSpinnerModule, DatePipe],
  template: `
    <div class="detail-page" *ngIf="case_()">
      <!-- Header -->
      <div class="detail-header">
        <div class="header-left">
          <button mat-icon-button routerLink="/cases"><mat-icon>arrow_back</mat-icon></button>
          <div>
            <div class="case-number">{{case_()!.case_number}}</div>
            <div class="patient-name">{{case_()!.patient?.name}}</div>
          </div>
          <span class="status-pill" [class]="'status-' + case_()!.status.toLowerCase()">{{case_()!.status}}</span>
          <span class="status-pill" [class]="'priority-' + case_()!.priority.toLowerCase()">{{case_()!.priority}}</span>
          <mat-icon *ngIf="case_()!.sla_breached" style="color:#c62828" title="SLA Breached">timer_off</mat-icon>
        </div>
        <div class="header-actions">
          <button mat-stroked-button (click)="printCase()"><mat-icon>print</mat-icon> Print</button>
          <button mat-raised-button color="primary" [routerLink]="['/cases', case_()!.id, 'edit']"><mat-icon>edit</mat-icon> Edit</button>
        </div>
      </div>

      <!-- Quick Stats -->
      <div class="quick-stats">
        <div class="stat-item"><span class="stat-label">Type</span><span class="stat-value">{{case_()!.case_type}}</span></div>
        <div class="stat-item"><span class="stat-label">Country</span><span class="stat-value">{{case_()!.country || '—'}}</span></div>
        <div class="stat-item"><span class="stat-label">Estimated Cost</span><span class="stat-value">{{case_()!.estimated_cost | number:'1.2-2'}} {{case_()!.currency}}</span></div>
        <div class="stat-item"><span class="stat-label">Actual Cost</span><span class="stat-value">{{case_()!.actual_cost | number:'1.2-2'}} {{case_()!.currency}}</span></div>
        <div class="stat-item"><span class="stat-label">SLA Target</span><span class="stat-value">{{case_()!.sla_target_hours}}h</span></div>
        <div class="stat-item"><span class="stat-label">Opened</span><span class="stat-value">{{case_()!.opened_at | date:'dd/MM/yyyy'}}</span></div>
      </div>

      <!-- Tabs -->
      <mat-tab-group class="mams-card detail-tabs">

        <!-- ── Details Tab ── -->
        <mat-tab label="Details">
          <div class="tab-content">

            <div class="info-section">
              <h4>Patient Information</h4>
              <div class="info-grid">
                <div class="info-item"><span class="info-label">Name</span><span>{{case_()!.patient?.name}}</span></div>
                <div class="info-item"><span class="info-label">Nationality</span><span>{{case_()!.patient?.nationality || '—'}}</span></div>
                <div class="info-item"><span class="info-label">Passport</span><span>{{case_()!.patient?.passport_number || '—'}}</span></div>
                <div class="info-item"><span class="info-label">DOB</span><span>{{case_()!.patient?.date_of_birth || '—'}}</span></div>
                <div class="info-item"><span class="info-label">Gender</span><span>{{case_()!.patient?.gender || '—'}}</span></div>
                <div class="info-item"><span class="info-label">Phone</span><span>{{case_()!.patient?.phone || '—'}}</span></div>
              </div>
            </div>

            <mat-divider/>

            <!-- Insurance & Coverage -->
            <div class="info-section" style="margin-top:20px">
              <h4>Insurance &amp; Coverage</h4>
              <div class="info-grid">
                <div class="info-item">
                  <span class="info-label">Insurance Company</span>
                  <span *ngIf="insuranceCompany()">
                    <strong>{{insuranceCompany()!.name}}</strong>
                    <span *ngIf="insuranceCompany()!.country" class="meta-tag">{{insuranceCompany()!.country}}</span>
                  </span>
                  <span *ngIf="!insuranceCompany()" class="not-set">Not assigned</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Insurance Contact</span>
                  <span *ngIf="insuranceCompany()?.contact_name">{{insuranceCompany()!.contact_name}}</span>
                  <span *ngIf="!insuranceCompany()?.contact_name" class="not-set">—</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Policy Number</span>
                  <span>{{case_()!.insurance_policy_number || '—'}}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Insurance Phone</span>
                  <span *ngIf="insuranceCompany()?.phone">{{insuranceCompany()!.phone}}</span>
                  <span *ngIf="!insuranceCompany()?.phone" class="not-set">—</span>
                </div>
              </div>
            </div>

            <mat-divider/>

            <!-- Provider Assignment -->
            <div class="info-section" style="margin-top:20px">
              <div class="section-header-row">
                <h4>Assigned Provider</h4>
                <button mat-stroked-button (click)="toggleProviderEdit()" *ngIf="!editingProvider()">
                  <mat-icon>{{case_()!.provider_id ? 'swap_horiz' : 'add'}}</mat-icon>
                  {{case_()!.provider_id ? 'Change Provider' : 'Assign Provider'}}
                </button>
              </div>

              <!-- Provider display -->
              <div *ngIf="!editingProvider()">
                <div *ngIf="assignedProvider()" class="provider-card">
                  <mat-icon class="provider-icon">local_hospital</mat-icon>
                  <div class="provider-info">
                    <div class="provider-name">{{assignedProvider()!.name}}</div>
                    <div class="provider-meta">
                      {{assignedProvider()!.category}}
                      <span *ngIf="assignedProvider()!.city"> · {{assignedProvider()!.city}}</span>
                      <span *ngIf="assignedProvider()!.country">, {{assignedProvider()!.country}}</span>
                    </div>
                    <div class="provider-meta" *ngIf="assignedProvider()!.phone">
                      <mat-icon style="font-size:13px;width:13px;height:13px">phone</mat-icon>
                      {{assignedProvider()!.phone}}
                    </div>
                  </div>
                  <span class="tier-badge" [class]="'tier-' + (assignedProvider()!.tier || 'standard').toLowerCase()">
                    {{assignedProvider()!.tier}}
                  </span>
                </div>
                <div *ngIf="!assignedProvider()" class="not-assigned-box">
                  <mat-icon>local_hospital</mat-icon>
                  <p>No provider assigned yet. You can assign one now or come back later.</p>
                  <button mat-raised-button color="primary" (click)="toggleProviderEdit()">
                    <mat-icon>add</mat-icon> Assign Provider
                  </button>
                </div>
              </div>

              <!-- Provider edit panel -->
              <div *ngIf="editingProvider()" class="provider-edit-panel">
                <mat-form-field appearance="outline" style="width:100%">
                  <mat-label>Select Provider</mat-label>
                  <mat-select [(ngModel)]="selectedProviderId">
                    <mat-option value="">— Remove provider assignment —</mat-option>
                    <mat-option *ngFor="let p of allProviders()" [value]="p.id">
                      {{p.name}} · {{p.category}}
                      <span *ngIf="p.city"> · {{p.city}}</span>
                    </mat-option>
                  </mat-select>
                </mat-form-field>
                <div class="provider-edit-actions">
                  <button mat-button (click)="cancelProviderEdit()">Cancel</button>
                  <button mat-raised-button color="primary" (click)="saveProvider()" [disabled]="savingProvider()">
                    <mat-progress-spinner *ngIf="savingProvider()" diameter="16" mode="indeterminate" style="display:inline-block"/>
                    <span *ngIf="!savingProvider()">Save Assignment</span>
                  </button>
                </div>
              </div>
            </div>

            <mat-divider/>

            <div class="info-section" style="margin-top:20px">
              <h4>Case Information</h4>
              <div class="info-grid">
                <div class="info-item"><span class="info-label">Location</span><span>{{case_()!.location_address || case_()!.city || '—'}}</span></div>
                <div class="info-item"><span class="info-label">SLA Actual</span><span>{{case_()!.sla_actual_hours ? (case_()!.sla_actual_hours + 'h') : '—'}}</span></div>
              </div>
              <p class="description" *ngIf="case_()!.description">{{case_()!.description}}</p>
            </div>

            <!-- Status Update -->
            <div class="status-update">
              <h4>Update Status</h4>
              <div class="status-actions">
                <button mat-stroked-button *ngFor="let s of statuses" (click)="updateStatus(s)"
                        [disabled]="case_()!.status === s" [class.active-status]="case_()!.status === s">{{s}}</button>
              </div>
            </div>
          </div>
        </mat-tab>

        <!-- ── Documents Tab ── -->
        <mat-tab label="Documents ({{documents().length}})">
          <div class="tab-content">
            <div class="upload-zone" (dragover)="$event.preventDefault()" (drop)="onFileDrop($event)" (click)="fileInput.click()">
              <mat-icon>cloud_upload</mat-icon>
              <p>Click or drag &amp; drop files here</p>
              <p class="upload-hint">PDF, JPG, PNG, DOCX · up to 10 MB each</p>
              <input #fileInput type="file" multiple style="display:none" (change)="onFileSelect($event)">
            </div>

            <div *ngIf="uploadQueue().length > 0" class="queue-section">
              <div class="queue-header">
                <span>{{uploadQueue().length}} file(s) ready to upload</span>
                <button mat-raised-button color="primary" (click)="uploadAll()" [disabled]="uploading()">
                  <mat-icon>cloud_upload</mat-icon> Upload All
                </button>
              </div>
              <div class="queue-list">
                <div class="queue-item" *ngFor="let item of uploadQueue(); let i = index">
                  <mat-icon class="doc-icon">{{getDocIcon(item.docType)}}</mat-icon>
                  <div class="queue-name">{{item.file.name}}<span class="file-size"> · {{(item.file.size/1024).toFixed(0)}} KB</span></div>
                  <mat-form-field appearance="outline" class="type-field">
                    <mat-label>Type</mat-label>
                    <mat-select [(ngModel)]="item.docType">
                      <mat-option *ngFor="let t of docTypes" [value]="t">{{t}}</mat-option>
                    </mat-select>
                  </mat-form-field>
                  <button mat-icon-button color="warn" (click)="removeFromQueue(i)"><mat-icon>close</mat-icon></button>
                </div>
              </div>
            </div>

            <div class="section-title" *ngIf="documents().length > 0">Uploaded Documents</div>
            <div class="doc-list" *ngIf="documents().length > 0">
              <div class="doc-item" *ngFor="let doc of documents()">
                <mat-icon class="doc-icon">{{getDocIcon(doc.doc_type)}}</mat-icon>
                <div class="doc-info">
                  <span class="doc-name">{{doc.filename}}</span>
                  <span class="doc-meta">{{doc.doc_type}} · {{doc.created_at | date:'dd/MM/yyyy HH:mm'}}</span>
                </div>
                <button mat-icon-button (click)="downloadDoc(doc)" title="Download"><mat-icon>download</mat-icon></button>
              </div>
            </div>
            <div *ngIf="documents().length === 0 && uploadQueue().length === 0" class="empty-state">
              <mat-icon>attach_file</mat-icon><p>No documents uploaded yet</p>
            </div>
          </div>
        </mat-tab>

        <!-- ── Communications Tab ── -->
        <mat-tab label="Notes &amp; Comms ({{communications().length}})">
          <div class="tab-content">
            <div class="add-comm">
              <mat-form-field appearance="outline" style="width:140px">
                <mat-label>Type</mat-label>
                <mat-select [(ngModel)]="newComm.type">
                  <mat-option *ngFor="let t of commTypes" [value]="t">{{t}}</mat-option>
                </mat-select>
              </mat-form-field>
              <mat-form-field appearance="outline" style="flex:1">
                <mat-label>Add a note or log a communication</mat-label>
                <textarea matInput [(ngModel)]="newComm.content" rows="2"></textarea>
              </mat-form-field>
              <button mat-raised-button color="primary" (click)="addComm()" [disabled]="!newComm.content">Add</button>
            </div>
            <div class="comm-list">
              <div class="comm-item" *ngFor="let c of communications()">
                <div class="comm-type-badge" [class]="'comm-' + c.comm_type.toLowerCase()">
                  <mat-icon>{{getCommIcon(c.comm_type)}}</mat-icon>
                </div>
                <div class="comm-body">
                  <div class="comm-content">{{c.content}}</div>
                  <div class="comm-meta">{{c.comm_type}} · {{c.direction}} · {{c.created_at | date:'dd/MM/yyyy HH:mm'}}</div>
                </div>
              </div>
              <div *ngIf="communications().length === 0" class="empty-state">
                <mat-icon>chat</mat-icon><p>No communications logged</p>
              </div>
            </div>
          </div>
        </mat-tab>

      </mat-tab-group>
    </div>

    <div *ngIf="!case_()" class="loading-state">
      <mat-progress-spinner mode="indeterminate" diameter="40"></mat-progress-spinner>
    </div>
  `,
  styles: [`
    .detail-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .header-left { display: flex; align-items: center; gap: 12px; }
    .header-actions { display: flex; gap: 10px; }
    .case-number { font-size: 20px; font-weight: 700; color: #1e3870; }
    .patient-name { font-size: 13px; color: #888; }

    .quick-stats { display: flex; gap: 0; background: white; border-radius: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); margin-bottom: 20px; overflow: hidden; }
    .stat-item { flex: 1; padding: 16px 20px; border-right: 1px solid #f0f0f0; }
    .stat-item:last-child { border-right: none; }
    .stat-label { display: block; font-size: 11px; font-weight: 600; color: #999; text-transform: uppercase; margin-bottom: 4px; }
    .stat-value { font-size: 14px; font-weight: 600; color: #333; }

    .detail-tabs { border-radius: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
    .tab-content { padding: 24px; }

    .info-section { margin-bottom: 4px; }
    .info-section h4 { margin: 0 0 12px; color: #1e3870; font-size: 14px; font-weight: 600; }
    .section-header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .section-header-row h4 { margin: 0; color: #1e3870; font-size: 14px; font-weight: 600; }

    .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .info-item { display: flex; flex-direction: column; gap: 2px; }
    .info-label { font-size: 11px; color: #999; font-weight: 600; text-transform: uppercase; }
    .not-set { color: #ccc; font-style: italic; }
    .meta-tag { font-size: 11px; color: #888; margin-left: 6px; background: #f0f0f0; padding: 1px 6px; border-radius: 10px; }
    .description { margin-top: 12px; color: #555; font-size: 14px; line-height: 1.6; padding: 12px; background: #f8f9fa; border-radius: 8px; }

    /* Provider card */
    .provider-card { display: flex; align-items: flex-start; gap: 14px; padding: 16px; background: #f0f4ff; border-radius: 10px; border: 1px solid #d0d9f0; }
    .provider-icon { font-size: 28px; width: 28px; height: 28px; color: #1e3870; flex-shrink: 0; margin-top: 2px; }
    .provider-info { flex: 1; }
    .provider-name { font-size: 15px; font-weight: 700; color: #1e3870; }
    .provider-meta { font-size: 12px; color: #666; margin-top: 3px; display: flex; align-items: center; gap: 4px; }
    .tier-badge { font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 20px; flex-shrink: 0; }
    .tier-preferred { background: #e8f5e9; color: #2e7d32; }
    .tier-standard  { background: #e3f2fd; color: #1565c0; }
    .tier-blacklisted { background: #fce4ec; color: #c62828; }
    .not-assigned-box { display: flex; flex-direction: column; align-items: center; padding: 28px; background: #fafafa; border-radius: 10px; border: 2px dashed #e0e0e0; gap: 10px; color: #aaa; text-align: center; }
    .not-assigned-box mat-icon { font-size: 36px; width: 36px; height: 36px; color: #ddd; }
    .not-assigned-box p { margin: 0; font-size: 13px; }

    .provider-edit-panel { padding: 16px; background: #fafafa; border-radius: 10px; border: 1px solid #e0e0e0; }
    .provider-edit-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px; }

    /* Status */
    .status-update { margin-top: 20px; }
    .status-update h4 { margin: 0 0 12px; color: #1e3870; font-size: 14px; font-weight: 600; }
    .status-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .active-status { background: #e8edf8 !important; }

    /* Documents */
    .upload-zone { border: 2px dashed #d0d7e6; border-radius: 10px; padding: 28px; text-align: center; color: #888; margin-bottom: 16px; cursor: pointer; transition: all 0.2s; }
    .upload-zone:hover { border-color: #1e3870; background: #f0f4ff; }
    .upload-zone mat-icon { font-size: 40px; width: 40px; height: 40px; color: #c9a84c; }
    .upload-hint { font-size: 12px; color: #aaa; margin: 4px 0 0; }
    .queue-section { margin-bottom: 20px; }
    .queue-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 13px; font-weight: 600; color: #1e3870; }
    .queue-list { display: flex; flex-direction: column; gap: 8px; }
    .queue-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: #f0f4ff; border-radius: 8px; border: 1px solid #d0d9f0; }
    .queue-name { flex: 1; font-size: 13px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .file-size { color: #aaa; font-weight: 400; }
    .type-field { width: 180px; margin: 0; }
    .type-field .mat-mdc-form-field-subscript-wrapper { display: none; }
    .section-title { font-size: 13px; font-weight: 600; color: #1e3870; margin: 16px 0 8px; text-transform: uppercase; letter-spacing: 0.5px; }
    .doc-list { display: flex; flex-direction: column; gap: 8px; }
    .doc-item { display: flex; align-items: center; gap: 12px; padding: 12px; background: #f8f9fa; border-radius: 8px; }
    .doc-icon { color: #1e3870; }
    .doc-info { flex: 1; }
    .doc-name { font-size: 13px; font-weight: 600; display: block; }
    .doc-meta { font-size: 11px; color: #999; }

    /* Communications */
    .add-comm { display: flex; gap: 12px; align-items: flex-start; margin-bottom: 20px; }
    .comm-list { display: flex; flex-direction: column; gap: 12px; }
    .comm-item { display: flex; gap: 12px; }
    .comm-type-badge { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; background: #e8edf8; }
    .comm-type-badge mat-icon { font-size: 18px; color: #1e3870; }
    .comm-body { flex: 1; }
    .comm-content { font-size: 14px; color: #333; }
    .comm-meta { font-size: 11px; color: #aaa; margin-top: 4px; }

    .empty-state { text-align: center; padding: 32px; color: #aaa; }
    .empty-state mat-icon { font-size: 40px; width: 40px; height: 40px; }
    .loading-state { display: flex; justify-content: center; padding: 80px; }
  `]
})
export class CaseDetailComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastService);

  case_ = signal<any | null>(null);
  documents = signal<any[]>([]);
  communications = signal<any[]>([]);
  uploadQueue = signal<{file: File, docType: string}[]>([]);
  uploading = signal(false);

  // Resolved related entities
  insuranceCompany = signal<any | null>(null);
  assignedProvider = signal<any | null>(null);

  // Provider reassignment
  allProviders = signal<any[]>([]);
  editingProvider = signal(false);
  savingProvider = signal(false);
  selectedProviderId = '';

  newComm = { type: 'Note', content: '' };
  statuses = ['Open','Pending','Approved','Closed','Cancelled'];
  docTypes = ['Passport','GOP','Medical Report','Lab Results','Discharge Summary','Invoice','X-Ray / Imaging','Consent Form','Insurance Card','Other'];
  commTypes = ['Note','Email','Call','WhatsApp'];

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.api.get<any>(`/cases/${id}`).subscribe(c => {
      this.case_.set(c);
      if (c.client_id) {
        this.api.get<any>(`/clients/${c.client_id}`).subscribe(cl => this.insuranceCompany.set(cl));
      }
      if (c.provider_id) {
        this.api.get<any>(`/providers/${c.provider_id}`).subscribe(p => this.assignedProvider.set(p));
        this.selectedProviderId = c.provider_id;
      }
    });
    this.api.get<any[]>(`/cases/${id}/documents`).subscribe(d => this.documents.set(d));
    this.api.get<any[]>(`/cases/${id}/communications`).subscribe(c => this.communications.set(c));
    this.api.get<any[]>('/providers', { limit: 200 }).subscribe(p => this.allProviders.set(p));
  }

  updateStatus(status: string) {
    const id = this.case_()!.id;
    this.api.put<any>(`/cases/${id}`, { status }).subscribe(c => {
      this.case_.set(c);
      this.toast.success(`Status → ${status}`);
    });
  }

  // ── Provider Reassignment ────────────────────────────────────────────────
  toggleProviderEdit() {
    this.selectedProviderId = this.case_()?.provider_id ?? '';
    this.editingProvider.set(true);
  }
  cancelProviderEdit() { this.editingProvider.set(false); }

  saveProvider() {
    this.savingProvider.set(true);
    const id = this.case_()!.id;
    const provider_id = this.selectedProviderId || null;
    this.api.put<any>(`/cases/${id}`, { provider_id }).subscribe({
      next: (updated) => {
        this.case_.set(updated);
        this.editingProvider.set(false);
        this.savingProvider.set(false);
        if (provider_id) {
          const p = this.allProviders().find(x => x.id === provider_id) ?? null;
          this.assignedProvider.set(p);
          this.toast.success('Provider assigned successfully');
        } else {
          this.assignedProvider.set(null);
          this.toast.success('Provider removed from case');
        }
      },
      error: () => { this.toast.error('Failed to update provider'); this.savingProvider.set(false); }
    });
  }

  // ── File Upload ──────────────────────────────────────────────────────────
  onFileSelect(event: Event) {
    const files = (event.target as HTMLInputElement).files;
    if (files) this.addToQueue(Array.from(files));
    (event.target as HTMLInputElement).value = '';
  }
  onFileDrop(event: DragEvent) {
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
  removeFromQueue(i: number) { this.uploadQueue.update(q => q.filter((_, idx) => idx !== i)); }
  uploadAll() {
    const queue = this.uploadQueue();
    if (!queue.length) return;
    this.uploading.set(true);
    const caseId = this.case_()!.id;
    let done = 0;
    queue.forEach(item => {
      const fd = new FormData(); fd.append('file', item.file);
      this.api.upload(`/cases/${caseId}/documents?doc_type=${encodeURIComponent(item.docType)}`, fd).subscribe({
        next: () => {
          done++;
          if (done === queue.length) {
            this.uploadQueue.set([]);
            this.uploading.set(false);
            this.toast.success(`${done} file(s) uploaded successfully`);
            this.api.get<any[]>(`/cases/${caseId}/documents`).subscribe(d => this.documents.set(d));
          }
        },
        error: () => { this.toast.error(`Failed to upload ${item.file.name}`); this.uploading.set(false); }
      });
    });
  }

  downloadDoc(doc: any) {
    const caseId = this.case_()!.id;
    this.api.download(`/cases/${caseId}/documents/${doc.id}/download`).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = doc.filename;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => this.toast.error(`Failed to download ${doc.filename}`)
    });
  }

  // ── Communications ───────────────────────────────────────────────────────
  addComm() {
    if (!this.newComm.content) return;
    this.api.post<any>(`/cases/${this.case_()!.id}/communications`, {
      case_id: this.case_()!.id,
      comm_type: this.newComm.type,
      content: this.newComm.content,
      direction: 'Internal'
    }).subscribe({
      next: c => { this.communications.update(list => [c, ...list]); this.newComm.content = ''; this.toast.success('Communication logged'); },
      error: () => this.toast.error('Failed to add communication')
    });
  }

  printCase() { window.print(); }

  getDocIcon(type: string) {
    const icons: Record<string,string> = {
      'Passport': 'badge', 'GOP': 'verified', 'Medical Report': 'medical_services',
      'Lab Results': 'science', 'Discharge Summary': 'summarize', 'Invoice': 'receipt',
      'X-Ray / Imaging': 'broken_image', 'Consent Form': 'draw', 'Insurance Card': 'credit_card'
    };
    return icons[type] || 'attach_file';
  }
  getCommIcon(type: string) {
    return type === 'Email' ? 'email' : type === 'Call' ? 'phone' : type === 'WhatsApp' ? 'chat' : 'notes';
  }
}
