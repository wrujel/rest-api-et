import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';

import { AuthCallbackComponent } from './auth-callback.component';
import { AuthService } from '../../services/auth.service';
import { query, text } from '../../../testing/dom';

describe('AuthCallbackComponent', () => {
  const refresh = vi.fn();
  const navigate = vi.fn();

  const render = () => {
    const fixture = TestBed.createComponent(AuthCallbackComponent);
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [AuthCallbackComponent],
      providers: [
        provideNoopAnimations(),
        { provide: AuthService, useValue: { refresh } },
        { provide: Router, useValue: { navigate } },
      ],
    });
  });

  it('shows a spinner while the exchange is in flight', () => {
    refresh.mockReturnValue(of({}));

    const fixture = render();

    expect(query(fixture, 'mat-spinner')).toBeTruthy();
    expect(text(fixture)).toContain('Signing you in');
  });

  it('lands on the home page once the cookie is exchanged', () => {
    refresh.mockReturnValue(of({ accessToken: 'tok' }));

    render();

    expect(navigate).toHaveBeenCalledWith(['/home'], { replaceUrl: true });
  });

  it('falls back to the login page when the exchange fails', () => {
    refresh.mockReturnValue(throwError(() => new Error('expired')));

    render();

    expect(navigate).toHaveBeenCalledWith(['/login'], { replaceUrl: true });
  });
});
