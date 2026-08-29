import { ApiDocsComponent } from './components/api-docs/api-docs.component';
import { AuthCallbackComponent } from './components/auth-callback/auth-callback.component';
import { HomeComponent } from './components/home/home.component';
import { LoginComponent } from './components/login/login.component';
import { NotFoundComponent } from './components/not-found/not-found.component';
import { RegisterComponent } from './components/register/register.component';
import { authGuard } from './services/auth.guard';
import { routes } from './app.routes';

describe('routes', () => {
  const routeFor = (path: string) => routes.find((r) => r.path === path);

  it('sends the bare root to the docs page', () => {
    expect(routeFor('')).toMatchObject({
      redirectTo: 'docs',
      pathMatch: 'full',
    });
  });

  it('maps each path to its component', () => {
    expect(routeFor('docs')?.component).toBe(ApiDocsComponent);
    expect(routeFor('home')?.component).toBe(HomeComponent);
    expect(routeFor('login')?.component).toBe(LoginComponent);
    expect(routeFor('register')?.component).toBe(RegisterComponent);
    expect(routeFor('auth/callback')?.component).toBe(AuthCallbackComponent);
  });

  it('guards only the home page', () => {
    expect(routeFor('home')?.canActivate).toEqual([authGuard]);
    expect(routeFor('docs')?.canActivate).toBeUndefined();
  });

  it('catches everything else with the not-found page, last', () => {
    const wildcard = routes[routes.length - 1];
    expect(wildcard).toMatchObject({
      path: '**',
      component: NotFoundComponent,
    });
  });
});
