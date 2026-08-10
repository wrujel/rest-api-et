import { ChangeDetectionStrategy, Component, inject, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { NavbarComponent } from './components/navbar/navbar.component';
import { AuroraBackgroundComponent } from './components/aurora-background/aurora-background.component';
import { ThemeService } from './services/theme.service';

/** The animated aurora is an auth-pages treat; app pages stay flat like the docs. */
function isAuthUrl(url: string): boolean {
  return /^\/(login|register)/.test(url);
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NavbarComponent, AuroraBackgroundComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  // Keep ThemeService alive at root so the `effect` that applies the theme runs
  // before any child renders.
  private readonly _theme = inject(ThemeService);
  private readonly _router = inject(Router);
  private readonly _platformId = inject(PLATFORM_ID);

  protected readonly showAurora = signal(isAuthUrl(this._router.url));

  constructor() {
    this.syncRoute(this._router.url);
    this._router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((e) => this.syncRoute(e.urlAfterRedirects));
  }

  private syncRoute(url: string) {
    this.showAurora.set(isAuthUrl(url));
    if (isPlatformBrowser(this._platformId)) {
      // The docs page runs on a Scalar-style true-black surface in dark theme.
      document.body.classList.toggle('docs-page', url.startsWith('/docs'));
    }
  }
}
