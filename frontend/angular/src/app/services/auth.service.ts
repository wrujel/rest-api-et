import { Injectable } from '@angular/core';
import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaderResponse,
  HttpResponse,
} from '@angular/common/http';
import { BehaviorSubject, catchError, map, of } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private _isLoggedIn$ = new BehaviorSubject<boolean>(false);
  isLoggedIn$ = this._isLoggedIn$.asObservable();

  constructor(private http: HttpClient) {
    const token = localStorage.getItem('sessionToken');
    this._isLoggedIn$.next(!!token);
  }

  login(email?: string | null, password?: string | null) {
    if (!email || !password) return;
    return this.http
      .post<HttpResponse<any>>(
        'http://localhost:8080/api/auth/login',
        {
          email,
          password,
        },
        { observe: 'response' }
      )
      .pipe(
        map((response: HttpResponse<any>) => {
          const token = response.body.sessionToken;
          if (!token) return response;
          this._isLoggedIn$.next(true);
          localStorage.setItem('sessionToken', token);
          return response;
        }),
        catchError((error: HttpErrorResponse) => {
          return of(error);
        })
      );
  }

  logout() {
    this._isLoggedIn$.next(false);
    localStorage.removeItem('sessionToken');
  }

  register(
    username?: string | null,
    email?: string | null,
    password?: string | null
  ) {
    if (!username || !email || !password) return;
    return this.http
      .post(
        'http://localhost:8080/api/auth/register',
        {
          username,
          email,
          password,
        },
        {
          observe: 'response',
        }
      )
      .pipe(
        map((response: HttpResponse<any>) => {
          return response;
        }),
        catchError((error: HttpErrorResponse) => {
          return of(error);
        })
      );
  }
}
