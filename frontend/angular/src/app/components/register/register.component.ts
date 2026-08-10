import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import type { ZxcvbnResult } from '@zxcvbn-ts/core';
import { AuthService } from '../../services/auth.service';
import { SocialLoginComponent } from '../social-login/social-login.component';
import { RevealDirective } from '../../directives/reveal.directive';
import { SplitTextDirective } from '../../directives/split-text.directive';
import { TiltDirective } from '../../directives/tilt.directive';
import { AuthCardMorphDirective } from '../../directives/auth-card-morph.directive';

interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  crackTime: string | null;
  suggestion: string | null;
}

interface PasswordCheck {
  label: string;
  met: boolean;
}

const STRENGTH_LABELS = ['very weak', 'weak', 'okay', 'good', 'strong'] as const;

@Component({
  selector: 'app-register',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    SocialLoginComponent,
    RevealDirective,
    SplitTextDirective,
    TiltDirective,
    AuthCardMorphDirective,
  ],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly hidePassword = signal(true);
  readonly submitting = signal(false);
  readonly bannerError = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly capsLock = signal(false);

  readonly form = new FormGroup({
    username: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(3)] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8)] }),
  });

  protected readonly passwordValue = toSignal(this.form.controls.password.valueChanges, { initialValue: '' });

  /** zxcvbn is dictionary-heavy, so it loads lazily after first paint. */
  private readonly scorerReady = signal(false);
  private zxcvbnFn: ((password: string) => ZxcvbnResult) | null = null;

  readonly strength = computed<PasswordStrength>(() => {
    const value = this.passwordValue() ?? '';
    if (!value) return { score: 0, label: STRENGTH_LABELS[0], crackTime: null, suggestion: null };

    if (this.scorerReady() && this.zxcvbnFn) {
      const result = this.zxcvbnFn(value);
      const crack = result.crackTimes.offlineSlowHashingXPerSecond.display;
      return {
        score: result.score,
        label: STRENGTH_LABELS[result.score],
        crackTime: crack === 'ltSecond' ? 'seconds' : crack,
        suggestion: result.feedback.suggestions[0] ?? result.feedback.warning ?? null,
      };
    }

    // Scorer still loading — rough placeholder until zxcvbn arrives.
    const provisional = value.length >= 12 ? 3 : value.length >= 8 ? 2 : 1;
    return {
      score: provisional as 1 | 2 | 3,
      label: 'analyzing…',
      crackTime: null,
      suggestion: null,
    };
  });

  readonly checks = computed<PasswordCheck[]>(() => {
    const value = this.passwordValue() ?? '';
    return [
      { label: 'At least 8 characters', met: value.length >= 8 },
      { label: 'Upper & lower case', met: /[a-z]/.test(value) && /[A-Z]/.test(value) },
      { label: 'A number', met: /\d/.test(value) },
      { label: 'A symbol', met: /[^A-Za-z0-9]/.test(value) },
    ];
  });

  constructor() {
    void this.loadScorer();
  }

  togglePassword() {
    this.hidePassword.update((h) => !h);
  }

  onPasswordKey(event: KeyboardEvent) {
    this.capsLock.set(event.getModifierState?.('CapsLock') ?? false);
  }

  usernameErrorMessage(): string | null {
    const c = this.form.controls.username;
    if (!c.touched && !c.dirty) return null;
    if (c.hasError('required')) return 'Pick a username.';
    if (c.hasError('minlength')) return 'At least 3 characters.';
    return null;
  }

  emailErrorMessage(): string | null {
    const c = this.form.controls.email;
    if (!c.touched && !c.dirty) return null;
    if (c.hasError('required')) return 'Email is required.';
    if (c.hasError('email')) return 'Please enter a valid email address.';
    if (c.hasError('taken')) return 'That email is already in use.';
    return null;
  }

  passwordErrorMessage(): string | null {
    const c = this.form.controls.password;
    if (!c.touched && !c.dirty) return null;
    if (c.hasError('required')) return 'Password is required.';
    if (c.hasError('minlength')) return 'Use at least 8 characters.';
    return null;
  }

  onSubmit() {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    this.bannerError.set(null);
    this.successMessage.set(null);
    this.submitting.set(true);
    this.form.disable({ emitEvent: false });

    const { username, email, password } = this.form.getRawValue();

    this.authService.register(username, email, password).subscribe({
      next: () => {
        this.submitting.set(false);
        this.successMessage.set('Account created! Redirecting to sign in…');
        setTimeout(() => this.router.navigate(['/login']), 1400);
      },
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        this.form.enable({ emitEvent: false });
        if (err.status === 409) {
          this.bannerError.set('That email is already in use.');
          this.form.controls.email.setErrors({ taken: true });
        } else if (err.status === 400 || err.status === 422) {
          this.bannerError.set('Please check the form and try again.');
        } else if (err.status === 0) {
          this.bannerError.set('Cannot reach the server. Check your connection.');
        } else if (err.status === 429) {
          this.bannerError.set('Too many attempts. Wait a few minutes and try again.');
        } else {
          this.bannerError.set('Could not create the account. Please try again.');
        }
      },
    });
  }

  private async loadScorer() {
    const [core, common] = await Promise.all([
      import('@zxcvbn-ts/core'),
      import('@zxcvbn-ts/language-common'),
    ]);
    const factory = new core.ZxcvbnFactory({
      graphs: common.adjacencyGraphs,
      dictionary: common.dictionary,
    });
    this.zxcvbnFn = (password: string) => factory.check(password);
    this.scorerReady.set(true);
  }
}
