import { Component, Inject } from '@angular/core';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="confirm-dialog">
      <div class="confirm-icon" [class.danger]="data.danger">
        <mat-icon>{{data.danger ? 'delete_forever' : 'help_outline'}}</mat-icon>
      </div>
      <h2 mat-dialog-title>{{data.title}}</h2>
      <mat-dialog-content>{{data.message}}</mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-stroked-button mat-dialog-close>Cancel</button>
        <button mat-raised-button [color]="data.danger ? 'warn' : 'primary'" (click)="ref.close(true)">
          {{data.confirmLabel || 'Confirm'}}
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .confirm-dialog { padding: 8px; max-width: 380px; }
    .confirm-icon { width: 56px; height: 56px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; background: #e8edf8; }
    .confirm-icon.danger { background: #fde8e8; }
    .confirm-icon mat-icon { font-size: 28px; width: 28px; height: 28px; color: #1e3870; }
    .confirm-icon.danger mat-icon { color: #c62828; }
    h2 { text-align: center; margin: 0 0 8px; font-size: 18px; }
    mat-dialog-content { text-align: center; color: #666; font-size: 14px; }
    mat-dialog-actions { padding: 16px 0 0; gap: 8px; }
  `]
})
export class ConfirmDialogComponent {
  constructor(public ref: MatDialogRef<ConfirmDialogComponent>,
              @Inject(MAT_DIALOG_DATA) public data: ConfirmDialogData) {}
}
