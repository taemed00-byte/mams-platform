import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({ providedIn: 'root' })
export class ToastService {
  private snack = inject(MatSnackBar);
  success(msg: string) { this.snack.open(msg, 'Close', { duration: 3500, panelClass: ['toast-success'] }); }
  error(msg: string) { this.snack.open(msg, 'Close', { duration: 5000, panelClass: ['toast-error'] }); }
  info(msg: string) { this.snack.open(msg, 'Close', { duration: 3000, panelClass: ['toast-info'] }); }
}
