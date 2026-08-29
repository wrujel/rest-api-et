import { TestBed } from '@angular/core/testing';
import {
  HttpClient,
  HttpContext,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { EMPTY, of, throwError } from 'rxjs';

import {
  RETRIED_AFTER_REFRESH,
  errorInterceptor,
  friendlyMessage,
} from './error.interceptor';
import { AuthService } from './auth.service';
import { NotificationService } from './notification.service';

describe('errorInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;

  const notify = { error: vi.fn() };
  const navigate = vi.fn();
  const auth = {
    refresh: vi.fn(() => of({})),
    getToken: vi.fn<() => string | null>(() => 'fresh-token'),
    clearSession: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    auth.refresh.mockReturnValue(of({}));
    auth.getToken.mockReturnValue('fresh-token');

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: NotificationService, useValue: notify },
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: { navigate } },
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  /** Fires a request, fails it with `status`, and resolves once it settles. */
  const failWith = (status: number, url = '/api/products') =>
    new Promise<void>((resolve) => {
      http
        .get(url)
        .subscribe({ error: () => resolve(), next: () => resolve() });
      controller.expectOne(url).flush('boom', { status, statusText: 'Err' });
    });

  it('passes a successful response straight through', async () => {
    const body = await new Promise((resolve) => {
      http.get('/api/products').subscribe(resolve);
      controller.expectOne('/api/products').flush({ ok: true });
    });

    expect(body).toEqual({ ok: true });
    expect(notify.error).not.toHaveBeenCalled();
  });

  describe('the message it surfaces', () => {
    const cases: Array<[number, string | RegExp]> = [
      [0, 'Cannot reach the server. Check your connection.'],
      [400, /request was invalid/],
      [403, /permission/],
      [404, /could not find/],
      [409, /conflicts/],
      [422, /need attention/],
      [500, /on our side/],
      [503, /on our side/],
      [418, /./],
    ];

    for (const [status, expected] of cases) {
      it(`explains a ${status}`, async () => {
        await failWith(status);

        expect(notify.error).toHaveBeenCalledWith(
          expect.stringMatching(expected),
        );
      });
    }
  });

  it('stays silent on the login endpoint so the form can own the message', async () => {
    await failWith(400, '/api/auth/login');

    expect(notify.error).not.toHaveBeenCalled();
  });

  it('stays silent on the register endpoint', async () => {
    await failWith(409, '/api/auth/register');

    expect(notify.error).not.toHaveBeenCalled();
  });

  describe('on a 401 for a non-auth endpoint', () => {
    it('refreshes once and replays the request with the new token', async () => {
      const body = await new Promise((resolve) => {
        http.get('/api/products').subscribe({ next: resolve, error: resolve });

        controller
          .expectOne('/api/products')
          .flush('nope', { status: 401, statusText: 'Unauthorized' });

        const retry = controller.expectOne('/api/products');
        expect(retry.request.headers.get('Authorization')).toBe(
          'Bearer fresh-token',
        );
        retry.flush({ ok: true });
      });

      expect(auth.refresh).toHaveBeenCalledOnce();
      expect(body).toEqual({ ok: true });
      expect(notify.error).not.toHaveBeenCalled();
    });

    it('replays without a header when the refresh produced no token', async () => {
      auth.getToken.mockReturnValue(null);

      await new Promise((resolve) => {
        http.get('/api/products').subscribe({ next: resolve, error: resolve });

        controller
          .expectOne('/api/products')
          .flush('nope', { status: 401, statusText: 'Unauthorized' });

        const retry = controller.expectOne('/api/products');
        expect(retry.request.headers.has('Authorization')).toBe(false);
        retry.flush({ ok: true });
      });
    });

    it('signs the visitor out when the refresh itself fails', async () => {
      auth.refresh.mockReturnValue(
        throwError(() => new Error('refresh failed')) as never,
      );

      await failWith(401);

      expect(auth.clearSession).toHaveBeenCalledOnce();
      expect(navigate).toHaveBeenCalledWith(['/login']);
      expect(notify.error).toHaveBeenCalledWith(
        expect.stringMatching(/session expired/),
      );
    });

    it('signs the visitor out when the replayed request 401s again', async () => {
      await new Promise<void>((resolve) => {
        http.get('/api/products').subscribe({
          error: () => resolve(),
          next: () => resolve(),
        });

        controller
          .expectOne('/api/products')
          .flush('nope', { status: 401, statusText: 'Unauthorized' });
        controller
          .expectOne('/api/products')
          .flush('nope', { status: 401, statusText: 'Unauthorized' });
      });

      // The replay carries the retry flag, so the second pass falls through to
      // the sign-out branch instead of refreshing again.
      expect(auth.refresh).toHaveBeenCalledOnce();
      expect(auth.clearSession).toHaveBeenCalled();
      expect(navigate).toHaveBeenCalledWith(['/login']);
    });

    it('does not refresh when the refresh call never emits', async () => {
      auth.refresh.mockReturnValue(EMPTY as never);

      await new Promise<void>((resolve) => {
        http.get('/api/products').subscribe({
          error: () => resolve(),
          complete: () => resolve(),
        });
        controller
          .expectOne('/api/products')
          .flush('nope', { status: 401, statusText: 'Unauthorized' });
      });

      expect(auth.refresh).toHaveBeenCalledOnce();
    });

    it('signs the visitor out for a request that was already replayed', async () => {
      // A request can arrive already flagged (a caller re-issuing one it kept
      // a handle on); the interceptor must not start a second refresh.
      await new Promise<void>((resolve) => {
        http
          .get('/api/products', {
            context: new HttpContext().set(RETRIED_AFTER_REFRESH, true),
          })
          .subscribe({ error: () => resolve(), next: () => resolve() });
        controller
          .expectOne('/api/products')
          .flush('nope', { status: 401, statusText: 'Unauthorized' });
      });

      expect(auth.refresh).not.toHaveBeenCalled();
      expect(auth.clearSession).toHaveBeenCalledOnce();
      expect(navigate).toHaveBeenCalledWith(['/login']);
    });
  });


  describe('friendlyMessage', () => {
    it('passes an unmapped status through with its own message', () => {
      expect(
        friendlyMessage({ status: 418, message: 'I am a teapot' } as HttpErrorResponse),
      ).toBe('I am a teapot');
    });

    it('falls back to a generic line when the error carries no message', () => {
      expect(
        friendlyMessage({ status: 418, message: '' } as HttpErrorResponse),
      ).toBe('Unexpected error.');
    });
  });

  it('does not try to refresh a 401 from an auth endpoint', async () => {
    await failWith(401, '/api/auth/refresh');

    expect(auth.refresh).not.toHaveBeenCalled();
    expect(notify.error).toHaveBeenCalled();
  });
});
