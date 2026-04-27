import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../services/auth.service';

interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  percent: number;
}

const STRENGTH_LABELS = ['too short', 'weak', 'okay', 'good', 'strong'] as const;

@Component({
  selector: 'app-register',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
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

  readonly form = new FormGroup({
    username: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(3)] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8)] }),
  });

  private readonly passwordValue = toSignal(this.form.controls.password.valueChanges, { initialValue: '' });

  readonly strength = computed<PasswordStrength>(() => this.scorePassword(this.passwordValue() ?? ''));

  togglePassword() {
    this.hidePassword.update((h) => !h);
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
        } else {
          this.bannerError.set('Could not create the account. Please try again.');
        }
      },
    });
  }

  private scorePassword(value: string): PasswordStrength {
    if (!value) return { score: 0, label: STRENGTH_LABELS[0], percent: 0 };
    if (value.length < 8) return { score: 1, label: STRENGTH_LABELS[1], percent: 25 };

    let raw = 0;
    if (/[a-z]/.test(value)) raw++;
    if (/[A-Z]/.test(value)) raw++;
    if (/\d/.test(value)) raw++;
    if (/[^A-Za-z0-9]/.test(value)) raw++;
    if (value.length >= 12) raw++;

    const score = Math.min(4, Math.max(1, raw)) as 1 | 2 | 3 | 4;
    return {
      score,
      label: STRENGTH_LABELS[score],
      percent: score * 25,
    };
  }
}
