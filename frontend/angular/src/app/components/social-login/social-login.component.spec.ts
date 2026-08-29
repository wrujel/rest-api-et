import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';

import { SocialLoginComponent } from './social-login.component';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';
import { queryAll } from '../../../testing/dom';

type Providers = { github: boolean; google: boolean } | null;

describe('SocialLoginComponent', () => {
  let fixture: ComponentFixture<SocialLoginComponent>;

  const oauthProviders = signal<Providers>(null);
  const loadProviders = vi.fn();

  const buttons = () =>
    queryAll<HTMLAnchorElement>(fixture, '.auth-social-btn');

  const render = (providers: Providers) => {
    oauthProviders.set(providers);
    fixture = TestBed.createComponent(SocialLoginComponent);
    fixture.detectChanges();
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [SocialLoginComponent],
      providers: [
        { provide: AuthService, useValue: { oauthProviders, loadProviders } },
      ],
    });
  });

  it('asks the server which providers are configured', () => {
    render(null);

    expect(loadProviders).toHaveBeenCalledOnce();
  });

  it('renders nothing until the answer arrives', () => {
    render(null);

    expect(buttons()).toHaveLength(0);
  });

  it('renders nothing when no provider is configured', () => {
    render({ github: false, google: false });

    expect(buttons()).toHaveLength(0);
  });

  it('shows only the configured provider', () => {
    render({ github: true, google: false });

    const rendered = buttons();
    expect(rendered).toHaveLength(1);
    expect(rendered[0].getAttribute('aria-label')).toBe('Continue with GitHub');
    expect(rendered[0].getAttribute('href')).toBe(
      `${environment.url}/api/auth/github`,
    );
  });

  it('shows both providers when both are configured', () => {
    render({ github: true, google: true });

    expect(buttons().map((a) => a.getAttribute('href'))).toEqual([
      `${environment.url}/api/auth/github`,
      `${environment.url}/api/auth/google`,
    ]);
  });
});
