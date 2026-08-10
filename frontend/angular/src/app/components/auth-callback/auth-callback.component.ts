import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../services/auth.service';

/**
 * Landing page after an OAuth redirect. The server has already set the
 * refresh cookie; we exchange it for an access token and move on.
 */
@Component({
  selector: 'app-auth-callback',
  imports: [MatProgressSpinnerModule],
  template: `
    <div class="callback-state">
      <mat-spinner diameter="36" mode="indeterminate"></mat-spinner>
      <p>Signing you in&hellip;</p>
    </div>
  `,
  styles: `
    :host {
      display: grid;
      place-items: center;
      flex: 1 1 auto;
    }
    .callback-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--app-space-4);
      color: var(--mat-sys-on-surface-variant);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthCallbackComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  ngOnInit() {
    this.auth.refresh().subscribe({
      next: () => this.router.navigate(['/home'], { replaceUrl: true }),
      error: () => this.router.navigate(['/login'], { replaceUrl: true }),
    });
  }
}
