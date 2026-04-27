import { Injectable, inject } from '@angular/core';
import { MatSnackBar, MatSnackBarConfig } from '@angular/material/snack-bar';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly snackBar = inject(MatSnackBar);

  private base(extra?: Partial<MatSnackBarConfig>): MatSnackBarConfig {
    return {
      duration: 4200,
      horizontalPosition: 'end',
      verticalPosition: 'top',
      ...extra,
    };
  }

  info(message: string) {
    this.snackBar.open(message, 'OK', this.base());
  }

  success(message: string) {
    this.snackBar.open(message, 'OK', this.base({ panelClass: ['app-snackbar-success'] }));
  }

  error(message: string) {
    this.snackBar.open(message, 'Dismiss', this.base({
      duration: 6500,
      panelClass: ['app-snackbar-error'],
    }));
  }
}
