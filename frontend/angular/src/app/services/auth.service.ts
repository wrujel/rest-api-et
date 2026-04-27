import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

const URL_PATH = environment.url;
const TOKEN_KEY = 'sessionToken';
const EMAIL_KEY = 'sessionEmail';

interface LoginBody {
  sessionToken?: string;
  email?: string;
}

interface RegisterBody {
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly _isLoggedIn$ = new BehaviorSubject<boolean>(this.hasToken());
  readonly isLoggedIn$ = this._isLoggedIn$.asObservable();

  readonly userEmail = signal<string | null>(this.readStorage(EMAIL_KEY));
  readonly isLoggedIn = signal<boolean>(this.hasToken());
  readonly initial = computed(() => {
    const e = this.userEmail();
    return e ? e.trim().charAt(0).toUpperCase() : '?';
  });

  login(email: string, password: string): Observable<HttpResponse<LoginBody>> {
    return this.http
      .post<LoginBody>(
        `${URL_PATH}/api/auth/login`,
        { email, password },
        { observe: 'response' },
      )
      .pipe(
        tap((response) => {
          const token = response.body?.sessionToken;
          if (token) {
            this.writeStorage(TOKEN_KEY, token);
            this.writeStorage(EMAIL_KEY, email);
            this.userEmail.set(email);
            this._isLoggedIn$.next(true);
            this.isLoggedIn.set(true);
          }
        }),
      );
  }

  register(username: string, email: string, password: string): Observable<HttpResponse<RegisterBody>> {
    return this.http.post<RegisterBody>(
      `${URL_PATH}/api/auth/register`,
      { username, email, password },
      { observe: 'response' },
    );
  }

  logout() {
    this.removeStorage(TOKEN_KEY);
    this.removeStorage(EMAIL_KEY);
    this.userEmail.set(null);
    this._isLoggedIn$.next(false);
    this.isLoggedIn.set(false);
  }

  getToken(): string | null {
    return this.readStorage(TOKEN_KEY);
  }

  private hasToken(): boolean {
    return !!this.readStorage(TOKEN_KEY);
  }

  private readStorage(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private writeStorage(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* sandboxed or quota exhausted */
    }
  }

  private removeStorage(key: string) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}
