import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-navbar',
  imports: [RouterLink, RouterLinkActive, MatButtonModule, MatIconModule, MatMenuModule, MatTooltipModule],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavbarComponent {
  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);
  private readonly router = inject(Router);

  readonly themeIcon = computed(() => (this.theme.choice() === 'dark' ? 'light_mode' : 'dark_mode'));
  readonly themeLabel = computed(() =>
    this.theme.choice() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
  );

  toggleTheme() {
    this.theme.toggle();
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
