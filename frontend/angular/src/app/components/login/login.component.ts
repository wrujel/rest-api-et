import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../services/auth.service';
import { AuthHeroComponent } from '../auth-hero/auth-hero.component';

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
    AuthHeroComponent,
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
  readonly bannerError = signal<string | null>(null);

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
        } else {
          this.bannerError.set('Sign-in failed. Please try again.');
        }
      },
    });
  }
}
