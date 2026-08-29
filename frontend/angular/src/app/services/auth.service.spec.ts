import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';

import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

const url = (path: string) => `${environment.url}${path}`;

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;

  const build = () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  };

  beforeEach(() => {
    localStorage.clear();
    build();
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('starts signed out with no stored token', () => {
    expect(service.isLoggedIn()).toBe(false);
    expect(service.userEmail()).toBeNull();
    expect(service.getToken()).toBeNull();
  });

  it('starts signed in when a token is already in storage', () => {
    localStorage.setItem('accessToken', 'stored');
    localStorage.setItem('sessionEmail', 'ada@example.com');
    build();

    expect(service.isLoggedIn()).toBe(true);
    expect(service.userEmail()).toBe('ada@example.com');
  });

  describe('initial', () => {
    it('is the upper-cased first letter of the session email', () => {
      localStorage.setItem('sessionEmail', ' ada@example.com');
      build();

      expect(service.initial()).toBe('A');
    });

    it('falls back to a question mark with no email', () => {
      expect(service.initial()).toBe('?');
    });
  });

  describe('login', () => {
    it('stores the token and flips the signed-in state', async () => {
      const response = firstValueFrom(
        service.login('ada@example.com', 'hunter2'),
      );

      const request = http.expectOne(url('/api/auth/login'));
      expect(request.request.method).toBe('POST');
      expect(request.request.withCredentials).toBe(true);
      expect(request.request.body).toEqual({
        email: 'ada@example.com',
        password: 'hunter2',
      });
      request.flush({ accessToken: 'tok', email: 'ada@example.com' });
      await response;

      expect(service.getToken()).toBe('tok');
      expect(service.userEmail()).toBe('ada@example.com');
      expect(service.isLoggedIn()).toBe(true);
      await expect(firstValueFrom(service.isLoggedIn$)).resolves.toBe(true);
    });

    it('leaves the session alone when the response carries no token', async () => {
      const response = firstValueFrom(service.login('ada@example.com', 'x'));
      http.expectOne(url('/api/auth/login')).flush({});
      await response;

      expect(service.isLoggedIn()).toBe(false);
      expect(service.getToken()).toBeNull();
    });
  });

  describe('register', () => {
    it('posts the new account without credentials', async () => {
      const response = firstValueFrom(
        service.register('ada', 'ada@example.com', 'hunter2'),
      );

      const request = http.expectOne(url('/api/auth/register'));
      expect(request.request.body).toEqual({
        username: 'ada',
        email: 'ada@example.com',
        password: 'hunter2',
      });
      request.flush({ message: 'ok' }, { status: 201, statusText: 'Created' });

      await expect(response).resolves.toMatchObject({ status: 201 });
    });
  });

  describe('refresh', () => {
    it('stores the rotated token and the returned email', async () => {
      const response = firstValueFrom(service.refresh());
      http
        .expectOne(url('/api/auth/refresh'))
        .flush({ accessToken: 'tok2', email: 'ada@example.com' });
      await response;

      expect(service.getToken()).toBe('tok2');
      expect(service.userEmail()).toBe('ada@example.com');
    });

    it('keeps the previous email when the response omits one', async () => {
      localStorage.setItem('sessionEmail', 'old@example.com');
      build();

      const response = firstValueFrom(service.refresh());
      http.expectOne(url('/api/auth/refresh')).flush({ accessToken: 'tok2' });
      await response;

      expect(service.userEmail()).toBe('old@example.com');
    });

    it('ignores a response with no token at all', async () => {
      const response = firstValueFrom(service.refresh());
      http.expectOne(url('/api/auth/refresh')).flush({});
      await response;

      expect(service.isLoggedIn()).toBe(false);
    });

    it('shares one in-flight request between concurrent callers', async () => {
      const first = firstValueFrom(service.refresh());
      const second = firstValueFrom(service.refresh());

      http.expectOne(url('/api/auth/refresh')).flush({ accessToken: 'tok2' });

      await expect(first).resolves.toBeTruthy();
      await expect(second).resolves.toBeTruthy();
    });

    it('starts a new request once the previous one has settled', async () => {
      const first = firstValueFrom(service.refresh());
      http.expectOne(url('/api/auth/refresh')).flush({ accessToken: 'tok2' });
      await first;

      const second = firstValueFrom(service.refresh());
      http.expectOne(url('/api/auth/refresh')).flush({ accessToken: 'tok3' });
      await second;

      expect(service.getToken()).toBe('tok3');
    });
  });

  describe('logout', () => {
    it('clears the session immediately and tells the server', () => {
      localStorage.setItem('accessToken', 'tok');
      build();

      service.logout();

      http.expectOne(url('/api/auth/logout')).flush({});
      expect(service.getToken()).toBeNull();
      expect(service.isLoggedIn()).toBe(false);
    });

    it('still clears the session when the server call fails', () => {
      localStorage.setItem('accessToken', 'tok');
      build();

      service.logout();

      http
        .expectOne(url('/api/auth/logout'))
        .flush('nope', { status: 500, statusText: 'Server Error' });
      expect(service.getToken()).toBeNull();
    });
  });

  describe('loadProviders', () => {
    it('records what the server reports', () => {
      service.loadProviders();

      http
        .expectOne(url('/api/auth/providers'))
        .flush({ github: true, google: false });

      expect(service.oauthProviders()).toEqual({ github: true, google: false });
    });

    it('treats a failure as "no providers configured"', () => {
      service.loadProviders();

      http
        .expectOne(url('/api/auth/providers'))
        .flush('nope', { status: 500, statusText: 'Server Error' });

      expect(service.oauthProviders()).toEqual({
        github: false,
        google: false,
      });
    });

    it('only asks once', () => {
      service.loadProviders();
      http.expectOne(url('/api/auth/providers')).flush({
        github: true,
        google: true,
      });

      service.loadProviders();
      http.expectNone(url('/api/auth/providers'));
    });
  });

  describe('when localStorage is unavailable', () => {
    const denied = () => {
      throw new DOMException('denied', 'SecurityError');
    };

    it('degrades to an in-memory session', async () => {
      const getItem = vi
        .spyOn(Storage.prototype, 'getItem')
        .mockImplementation(denied);
      const setItem = vi
        .spyOn(Storage.prototype, 'setItem')
        .mockImplementation(denied);
      const removeItem = vi
        .spyOn(Storage.prototype, 'removeItem')
        .mockImplementation(denied);
      build();

      expect(service.getToken()).toBeNull();
      expect(service.isLoggedIn()).toBe(false);

      const response = firstValueFrom(service.login('ada@example.com', 'x'));
      http.expectOne(url('/api/auth/login')).flush({ accessToken: 'tok' });
      await response;

      // The write threw, but the in-memory signals still moved.
      expect(service.isLoggedIn()).toBe(true);

      service.clearSession();
      expect(service.isLoggedIn()).toBe(false);

      getItem.mockRestore();
      setItem.mockRestore();
      removeItem.mockRestore();
    });
  });
});
