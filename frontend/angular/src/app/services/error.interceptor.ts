import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { NotificationService } from './notification.service';

const SILENT_ENDPOINTS = ['/api/auth/login', '/api/auth/register'];
const RETRIED_AFTER_REFRESH = new HttpContextToken<boolean>(() => false);

function friendlyMessage(error: HttpErrorResponse): string {
  if (error.status === 0) return 'Cannot reach the server. Check your connection.';
  if (error.status === 400) return 'That request was invalid. Please review the form and try again.';
  if (error.status === 401) return 'Your session expired. Please sign in again.';
  if (error.status === 403) return "You don't have permission to do that.";
  if (error.status === 404) return 'We could not find what you were looking for.';
  if (error.status === 409) return 'That conflicts with existing data.';
  if (error.status === 422) return 'Some fields need attention.';
  if (error.status >= 500) return 'Something went wrong on our side. Please try again shortly.';
  return error.message || 'Unexpected error.';
}

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const notify = inject(NotificationService);
  const auth = inject(AuthService);
  const router = inject(Router);

  const isAuthEndpoint = req.url.includes('/api/auth/');

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401 && !isAuthEndpoint) {
        if (!req.context.get(RETRIED_AFTER_REFRESH)) {
          return auth.refresh().pipe(
            switchMap(() => {
              const token = auth.getToken();
              const retry = req.clone({
                context: req.context.set(RETRIED_AFTER_REFRESH, true),
                headers: token
                  ? req.headers.set('Authorization', `Bearer ${token}`)
                  : req.headers,
              });
              return next(retry);
            }),
            catchError(() => {
              auth.clearSession();
              router.navigate(['/login']);
              notify.error(friendlyMessage(err));
              return throwError(() => err);
            }),
          );
        }
        auth.clearSession();
        router.navigate(['/login']);
      }

      const isSilent = SILENT_ENDPOINTS.some((endpoint) => req.url.includes(endpoint));
      if (!isSilent) {
        notify.error(friendlyMessage(err));
      }

      return throwError(() => err);
    }),
  );
};
