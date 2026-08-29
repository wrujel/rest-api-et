import { signal } from '@angular/core';
import { of } from 'rxjs';

/**
 * A stand-in for `AuthService` covering everything the auth pages touch.
 * Components under test also render `<app-social-login>`, which reaches for
 * `oauthProviders`/`loadProviders`, so those are always present.
 */
export const createAuthStub = () => ({
  login: vi.fn(() => of({ body: { accessToken: 'tok' } })),
  register: vi.fn(() => of({ status: 201 })),
  refresh: vi.fn(() => of({})),
  logout: vi.fn(),
  clearSession: vi.fn(),
  getToken: vi.fn<() => string | null>(() => null),
  loadProviders: vi.fn(),
  oauthProviders: signal<{ github: boolean; google: boolean } | null>(null),
  isLoggedIn: signal(false),
  userEmail: signal<string | null>(null),
  initial: signal('?'),
});

export type AuthStub = ReturnType<typeof createAuthStub>;
