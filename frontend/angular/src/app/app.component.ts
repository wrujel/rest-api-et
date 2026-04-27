import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ChildrenOutletContexts, RouterOutlet } from '@angular/router';
import { NavbarComponent } from './components/navbar/navbar.component';
import { ThemeService } from './services/theme.service';
import { routeFade } from './app.animations';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NavbarComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  animations: [routeFade],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  private readonly contexts = inject(ChildrenOutletContexts);
  // Keep ThemeService alive at root so the `effect` that applies the theme runs
  // before any child renders.
  private readonly _theme = inject(ThemeService);

  getRouteAnimationKey() {
    return this.contexts.getContext('primary')?.route?.snapshot?.routeConfig?.path ?? '__none__';
  }
}
