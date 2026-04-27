import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../services/auth.service';
import { ThemeService, ThemeChoice } from '../../services/theme.service';

const THEME_LABELS: Record<ThemeChoice, string> = {
  auto: 'Auto theme (matches system)',
  light: 'Light theme',
  dark: 'Dark theme',
};

const THEME_ICONS: Record<ThemeChoice, string> = {
  auto: 'brightness_auto',
  light: 'light_mode',
  dark: 'dark_mode',
};

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

  readonly themeIcon = computed(() => THEME_ICONS[this.theme.choice()]);
  readonly themeLabel = computed(() => THEME_LABELS[this.theme.choice()]);

  cycleTheme() {
    this.theme.cycle();
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
