import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  ViewTransitionsFeatureOptions,
  provideRouter,
  withComponentInputBinding,
  withViewTransitions,
} from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { MAT_ICON_DEFAULT_OPTIONS } from '@angular/material/icon';

import { routes } from './app.routes';
import { authInterceptor } from './services/auth.interceptor';
import { errorInterceptor } from './services/error.interceptor';

/** Resolved route path ('docs', 'home', …) regardless of which node we get. */
export const routePathOf = (state: ActivatedRouteSnapshot): string => {
  let node = state;
  while (node.firstChild) node = node.firstChild;
  return node.routeConfig?.path ?? '';
};

/**
 * Same-page navigations (e.g. switching docs endpoints via ?e=) must feel
 * instant — a full-page morph here reads as the UI not responding.
 */
export const skipSamePageTransition: ViewTransitionsFeatureOptions['onViewTransitionCreated'] =
  ({ transition, from, to }) => {
    if (routePathOf(from) === routePathOf(to)) transition.skipTransition();
  };

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withViewTransitions({ onViewTransitionCreated: skipSamePageTransition }),
    ),
    provideAnimationsAsync(),
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
    {
      provide: MAT_ICON_DEFAULT_OPTIONS,
      useValue: { fontSet: 'material-symbols-outlined' },
    },
  ],
};
