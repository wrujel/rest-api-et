import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('sessionToken');
  if (token)
    req = req.clone({
      headers: req.headers.set('sessionToken', token),
    });
  return next(req);
};
