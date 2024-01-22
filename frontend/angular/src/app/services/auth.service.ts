import { Injectable } from '@angular/core';
import {
  HttpClient,
  HttpErrorResponse,
  HttpResponse,
} from '@angular/common/http';
import { BehaviorSubject, catchError, map, of } from 'rxjs';
import { environment } from '../../environments/environment';

const URL_PATH = environment.url;

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
        `${URL_PATH}/api/auth/login`,
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
        `${URL_PATH}/api/auth/register`,
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
