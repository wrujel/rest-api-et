import { TestBed } from '@angular/core/testing';
import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';

import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

describe('authInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  const getToken = vi.fn<() => string | null>();

  const build = () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { getToken } },
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  };

  afterEach(() => controller.verify());

  it('adds a bearer header when a token is available', () => {
    getToken.mockReturnValue('tok');
    build();

    http.get('/api/products').subscribe();

    const request = controller.expectOne('/api/products');
    expect(request.request.headers.get('Authorization')).toBe('Bearer tok');
    request.flush({});
  });

  it('leaves the request untouched when there is no token', () => {
    getToken.mockReturnValue(null);
    build();

    http.get('/api/products').subscribe();

    const request = controller.expectOne('/api/products');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({});
  });
});
