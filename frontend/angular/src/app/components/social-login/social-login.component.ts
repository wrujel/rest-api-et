import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';

/**
 * Social sign-in buttons. Rendered only when the server reports at least one
 * OAuth provider as configured (GET /api/auth/providers).
 */
@Component({
  selector: 'app-social-login',
  templateUrl: './social-login.component.html',
  styleUrl: './social-login.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SocialLoginComponent implements OnInit {
  protected readonly auth = inject(AuthService);

  protected readonly githubUrl = `${environment.url}/api/auth/github`;
  protected readonly googleUrl = `${environment.url}/api/auth/google`;

  protected readonly visible = computed(() => {
    const p = this.auth.oauthProviders();
    return !!p && (p.github || p.google);
  });

  ngOnInit() {
    this.auth.loadProviders();
  }
}
