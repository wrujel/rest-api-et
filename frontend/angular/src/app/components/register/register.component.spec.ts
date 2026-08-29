import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { throwError } from 'rxjs';

import { RegisterComponent } from './register.component';
import { AuthService } from '../../services/auth.service';
import { AuthStub, createAuthStub } from '../../../testing/auth';
import { stubReducedMotion } from '../../../testing/motion';

describe('RegisterComponent', () => {
  let fixture: ComponentFixture<RegisterComponent>;
  let component: RegisterComponent;
  let auth: AuthStub;
  let navigate: ReturnType<typeof vi.spyOn>;

  const build = () => {
    TestBed.resetTestingModule();
    auth = createAuthStub();
    TestBed.configureTestingModule({
      imports: [RegisterComponent],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: AuthService, useValue: auth },
      ],
    });
    navigate = vi
      .spyOn(TestBed.inject(Router), 'navigate')
      .mockResolvedValue(true);
    fixture = TestBed.createComponent(RegisterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  const fillValid = () =>
    component.form.setValue({
      username: 'ada',
      email: 'ada@example.com',
      password: 'correct-horse-8',
    });

  /**
   * The scorer arrives through two dynamic imports kicked off in the
   * constructor; `whenStable` does not span them, so this waits for the label
   * to stop reading "analyzing…".
   */
  const waitForScorer = async () => {
    component.form.controls.password.setValue('probe-password');
    for (let attempt = 0; attempt < 200; attempt += 1) {
      if (component.strength().label !== 'analyzing…') return;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    throw new Error('the password scorer never finished loading');
  };

  const failWith = (status: number) =>
    auth.register.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status, statusText: 'Err' }),
      ) as never,
    );

  beforeEach(() => {
    stubReducedMotion(true);
    build();
  });

  describe('validation messages', () => {
    it('stays quiet until the fields have been touched', () => {
      expect(component.usernameErrorMessage()).toBeNull();
      expect(component.emailErrorMessage()).toBeNull();
      expect(component.passwordErrorMessage()).toBeNull();
    });

    it('asks for the three missing fields', () => {
      component.form.markAllAsTouched();

      expect(component.usernameErrorMessage()).toBe('Pick a username.');
      expect(component.emailErrorMessage()).toBe('Email is required.');
      expect(component.passwordErrorMessage()).toBe('Password is required.');
    });

    it('rejects a short username, a bad email and a short password', () => {
      component.form.setValue({
        username: 'ab',
        email: 'nope',
        password: 'short',
      });
      component.form.markAllAsTouched();

      expect(component.usernameErrorMessage()).toMatch(/At least 3/);
      expect(component.emailErrorMessage()).toMatch(/valid email/);
      expect(component.passwordErrorMessage()).toMatch(/at least 8/);
    });

    it('surfaces a server-reported duplicate email', () => {
      component.form.controls.email.setValue('ada@example.com');
      component.form.controls.email.setErrors({ taken: true });
      component.form.markAllAsTouched();

      expect(component.emailErrorMessage()).toMatch(/already in use/);
    });

    it('has nothing to say once the form is good', () => {
      fillValid();
      component.form.markAllAsTouched();

      expect(component.usernameErrorMessage()).toBeNull();
      expect(component.emailErrorMessage()).toBeNull();
      expect(component.passwordErrorMessage()).toBeNull();
    });
  });

  describe('the password checklist', () => {
    it('starts with nothing met', () => {
      expect(component.checks().map((check) => check.met)).toEqual([
        false,
        false,
        false,
        false,
      ]);
    });

    it('ticks each rule as the password earns it', () => {
      component.form.controls.password.setValue('Passw0rd!');

      expect(component.checks().map((check) => check.met)).toEqual([
        true,
        true,
        true,
        true,
      ]);
    });

    it('treats a nulled-out control as an empty password', () => {
      component.form.controls.password.setValue(null as never);

      expect(component.checks().every((check) => !check.met)).toBe(true);
    });

    it('does not tick mixed case for a single-case password', () => {
      component.form.controls.password.setValue('alllower1!');

      expect(component.checks()[1].met).toBe(false);
    });
  });

  describe('the strength meter', () => {
    it('reports the weakest score for an empty password', () => {
      expect(component.strength()).toEqual({
        score: 0,
        label: 'very weak',
        crackTime: null,
        suggestion: null,
      });
    });

    it('reports the weakest score when the control is nulled out', () => {
      component.form.controls.password.setValue(null as never);

      expect(component.strength().score).toBe(0);
    });

    it('shows a provisional reading while the scorer is still loading', () => {
      // A fresh component has not awaited the lazy zxcvbn import yet.
      component.form.controls.password.setValue('abc');
      expect(component.strength()).toMatchObject({
        score: 1,
        label: 'analyzing…',
      });

      component.form.controls.password.setValue('abcdefgh');
      expect(component.strength().score).toBe(2);

      component.form.controls.password.setValue('abcdefghijkl');
      expect(component.strength().score).toBe(3);
    });

    it('switches to real zxcvbn scoring once the dictionary lands', async () => {
      await waitForScorer();

      component.form.controls.password.setValue('password');
      const weak = component.strength();
      expect(weak.label).not.toBe('analyzing…');
      expect(weak.score).toBeLessThanOrEqual(1);
      expect(weak.crackTime).toBeTruthy();

      component.form.controls.password.setValue('7Gq!vzR2xLm#pT4w');
      expect(component.strength().score).toBeGreaterThan(weak.score);
    });

    it('spells out an instant crack time in words', async () => {
      await waitForScorer();

      component.form.controls.password.setValue('a');

      expect(component.strength().crackTime).not.toBe('ltSecond');
    });
  });

  it('unmasks the password on demand', () => {
    component.togglePassword();

    expect(component.hidePassword()).toBe(false);
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

  describe('submitting', () => {
    afterEach(() => vi.useRealTimers());

    it('creates the account, then sends the visitor to sign in', () => {
      vi.useFakeTimers();
      fillValid();

      component.onSubmit();

      expect(auth.register).toHaveBeenCalledWith(
        'ada',
        'ada@example.com',
        'correct-horse-8',
      );
      expect(component.successMessage()).toMatch(/Account created/);
      expect(navigate).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1400);
      expect(navigate).toHaveBeenCalledWith(['/login']);
    });

    it('refuses an invalid form and marks it up instead', () => {
      component.onSubmit();

      expect(auth.register).not.toHaveBeenCalled();
      expect(component.form.controls.username.touched).toBe(true);
    });

    it('ignores a second submit while one is in flight', () => {
      fillValid();
      component.submitting.set(true);

      component.onSubmit();

      expect(auth.register).not.toHaveBeenCalled();
    });

    it('re-enables the form and flags the email on a duplicate', () => {
      failWith(409);
      fillValid();

      component.onSubmit();

      expect(component.bannerError()).toMatch(/already in use/);
      expect(component.form.enabled).toBe(true);
      expect(component.form.controls.email.hasError('taken')).toBe(true);
    });

    const bannerCases: Array<[number, RegExp]> = [
      [400, /check the form/],
      [422, /check the form/],
      [0, /Cannot reach the server/],
      [429, /Too many attempts/],
      [500, /Could not create the account/],
    ];

    for (const [status, expected] of bannerCases) {
      it(`explains a ${status} in the banner`, () => {
        failWith(status);
        fillValid();

        component.onSubmit();

        expect(component.bannerError()).toMatch(expected);
        expect(component.submitting()).toBe(false);
      });
    }
  });
});
