import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { BehaviorSubject, firstValueFrom } from 'rxjs';

import { authGuard } from './auth.guard';
import { AuthService } from './auth.service';

describe('authGuard', () => {
  const isLoggedIn$ = new BehaviorSubject<boolean>(false);
  const createUrlTree = vi.fn(() => ({ toString: () => '/login' }) as UrlTree);

  const run = () =>
    TestBed.runInInjectionContext(
      () => authGuard(null!, null!) as ReturnType<typeof authGuard>,
    );

  beforeEach(() => {
    isLoggedIn$.next(false);
    createUrlTree.mockClear();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { isLoggedIn$ } },
        { provide: Router, useValue: { createUrlTree } },
      ],
    });
  });

  it('lets a signed-in visitor through', async () => {
    isLoggedIn$.next(true);

    await expect(firstValueFrom(run() as never)).resolves.toBe(true);
    expect(createUrlTree).not.toHaveBeenCalled();
  });

  it('redirects a signed-out visitor to the login page', async () => {
    const result = await firstValueFrom(run() as never);

    expect(createUrlTree).toHaveBeenCalledWith(['/login']);
    expect(String(result)).toBe('/login');
  });
});
