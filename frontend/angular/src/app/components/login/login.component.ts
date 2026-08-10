import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../services/auth.service';
import { SocialLoginComponent } from '../social-login/social-login.component';
import { RevealDirective } from '../../directives/reveal.directive';
import { SplitTextDirective } from '../../directives/split-text.directive';
import { TiltDirective } from '../../directives/tilt.directive';
import { AuthCardMorphDirective } from '../../directives/auth-card-morph.directive';

@Component({
  selector: 'app-login',
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
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly hidePassword = signal(true);
  readonly submitting = signal(false);
  readonly bannerError = signal<string | null>(
    inject(ActivatedRoute).snapshot.queryParamMap.get('error') === 'oauth'
      ? 'Social sign-in failed or is not configured. Try your email instead.'
      : null,
  );
  readonly capsLock = signal(false);

  readonly form = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(6)] }),
  });

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
    if (c.hasError('minlength')) return 'Password should be at least 6 characters.';
    return null;
  }

  togglePassword() {
    this.hidePassword.update((h) => !h);
  }

  onPasswordKey(event: KeyboardEvent) {
    this.capsLock.set(event.getModifierState?.('CapsLock') ?? false);
  }

  onSubmit() {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    this.bannerError.set(null);
    this.submitting.set(true);
    const { email, password } = this.form.getRawValue();

    this.authService.login(email, password).subscribe({
      next: () => {
        this.submitting.set(false);
        this.router.navigate(['/home']);
      },
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        if (err.status === 401 || err.status === 400) {
          this.bannerError.set('Invalid email or password.');
        } else if (err.status === 0) {
          this.bannerError.set('Cannot reach the server. Check your connection.');
        } else if (err.status === 429) {
          this.bannerError.set('Too many attempts. Wait a few minutes and try again.');
        } else {
          this.bannerError.set('Sign-in failed. Please try again.');
        }
      },
    });
  }
}
