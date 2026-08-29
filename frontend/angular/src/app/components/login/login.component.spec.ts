import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { throwError } from 'rxjs';

import { LoginComponent } from './login.component';
import { AuthService } from '../../services/auth.service';
import { AuthStub, createAuthStub } from '../../../testing/auth';
import { stubReducedMotion } from '../../../testing/motion';
import { query, text } from '../../../testing/dom';

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let component: LoginComponent;
  let auth: AuthStub;
  let navigate: ReturnType<typeof vi.spyOn>;

  const build = (queryParams: Record<string, string> = {}) => {
    TestBed.resetTestingModule();
    auth = createAuthStub();
    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: AuthService, useValue: auth },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: (key: string) => queryParams[key] ?? null,
              },
            },
          },
        },
      ],
    });
    navigate = vi
      .spyOn(TestBed.inject(Router), 'navigate')
      .mockResolvedValue(true);
    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  const fillValid = () =>
    component.form.setValue({
      email: 'ada@example.com',
      password: 'hunter2',
    });

  const failWith = (status: number) =>
    auth.login.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status, statusText: 'Err' }),
      ) as never,
    );

  beforeEach(() => {
    // The reveal/split/tilt directives are decoration; switching motion off
    // keeps them out of the way of what these specs are about.
    stubReducedMotion(true);
    build();
  });

  it('starts with an empty, invalid form and a masked password', () => {
    expect(component.form.valid).toBe(false);
    expect(component.hidePassword()).toBe(true);
    expect(
      query<HTMLInputElement>(fixture, 'input[type="password"]'),
    ).toBeTruthy();
  });

  it('shows a banner when it was sent here by a failed social sign-in', () => {
    build({ error: 'oauth' });

    expect(component.bannerError()).toMatch(/Social sign-in failed/);
    expect(text(fixture)).toContain('Social sign-in failed');
  });

  it('shows no banner on a plain visit', () => {
    expect(component.bannerError()).toBeNull();
  });

  it('unmasks the password on demand', () => {
    component.togglePassword();
    fixture.detectChanges();

    expect(component.hidePassword()).toBe(false);
    expect(query(fixture, 'input[type="text"]')).toBeTruthy();
  });

  describe('caps-lock warning', () => {
    it('lights up while caps lock is on', () => {
      component.onPasswordKey({
        getModifierState: () => true,
      } as unknown as KeyboardEvent);

      expect(component.capsLock()).toBe(true);
    });

    it('stays off when the event cannot report modifiers', () => {
      component.onPasswordKey({} as KeyboardEvent);

      expect(component.capsLock()).toBe(false);
    });
  });

  describe('validation messages', () => {
    it('stays quiet until a field has been touched', () => {
      expect(component.emailErrorMessage()).toBeNull();
      expect(component.passwordErrorMessage()).toBeNull();
    });

    it('asks for a missing email and password', () => {
      component.form.markAllAsTouched();

      expect(component.emailErrorMessage()).toBe('Email is required.');
      expect(component.passwordErrorMessage()).toBe('Password is required.');
    });

    it('rejects a malformed email', () => {
      component.form.controls.email.setValue('not-an-email');
      component.form.markAllAsTouched();

      expect(component.emailErrorMessage()).toMatch(/valid email/);
    });

    it('rejects a too-short password', () => {
      component.form.controls.password.setValue('abc');
      component.form.markAllAsTouched();

      expect(component.passwordErrorMessage()).toMatch(/at least 6/);
    });

    it('has nothing to say once both fields are good', () => {
      fillValid();
      component.form.markAllAsTouched();

      expect(component.emailErrorMessage()).toBeNull();
      expect(component.passwordErrorMessage()).toBeNull();
    });
  });

  describe('submitting', () => {
    it('signs in and moves to the products page', () => {
      fillValid();

      component.onSubmit();

      expect(auth.login).toHaveBeenCalledWith('ada@example.com', 'hunter2');
      expect(navigate).toHaveBeenCalledWith(['/home']);
      expect(component.submitting()).toBe(false);
    });

    it('refuses an invalid form and marks it up instead', () => {
      component.onSubmit();

      expect(auth.login).not.toHaveBeenCalled();
      expect(component.form.controls.email.touched).toBe(true);
    });

    it('ignores a second submit while one is in flight', () => {
      fillValid();
      component.submitting.set(true);

      component.onSubmit();

      expect(auth.login).not.toHaveBeenCalled();
    });

    const bannerCases: Array<[number, RegExp]> = [
      [401, /Invalid email or password/],
      [400, /Invalid email or password/],
      [0, /Cannot reach the server/],
      [429, /Too many attempts/],
      [500, /Sign-in failed/],
    ];

    for (const [status, expected] of bannerCases) {
      it(`explains a ${status} in the banner`, () => {
        failWith(status);
        fillValid();

        component.onSubmit();

        expect(component.bannerError()).toMatch(expected);
        expect(component.submitting()).toBe(false);
        expect(navigate).not.toHaveBeenCalled();
      });
    }
  });
});
