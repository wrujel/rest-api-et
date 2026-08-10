import { Directive, ElementRef, inject } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';

/**
 * Keeps the `auth-card` view-transition morph for login ↔ register, but drops
 * the card's transition name as soon as navigation leaves the auth pages —
 * otherwise its snapshot lingers as a glass overlay over the new route while
 * the transition runs. NavigationStart fires before the old page is captured,
 * so stripping the name here keeps the card out of the transition entirely.
 */
@Directive({ selector: '.auth-card' })
export class AuthCardMorphDirective {
  private readonly el = inject(ElementRef<HTMLElement>);

  constructor() {
    inject(Router)
      .events.pipe(
        filter((e): e is NavigationStart => e instanceof NavigationStart),
        takeUntilDestroyed(),
      )
      .subscribe((e) => {
        if (!/^\/(login|register)/.test(e.url)) {
          this.el.nativeElement.style.viewTransitionName = 'none';
        }
      });
  }
}
