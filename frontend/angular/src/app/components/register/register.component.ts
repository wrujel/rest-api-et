import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import {
  FormGroup,
  FormControl,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatButtonModule,
    MatInputModule,
    MatIconModule,
    RouterLink,
  ],
  providers: [AuthService],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css',
})
export class RegisterComponent {
  registerForm = new FormGroup({
    username: new FormControl('', Validators.required),
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', Validators.required),
  });
  hide = true;
  errorMessage = '';

  constructor(private authService: AuthService) {}

  onSubmit() {
    this.errorMessage = '';
    this.authService
      .register(
        this.registerForm.value.username,
        this.registerForm.value.email,
        this.registerForm.value.password
      )
      ?.subscribe((response: any) => {
        if (response.status !== 201) {
          this.errorMessage = 'Invalid username, email, or password.';
        }
      });
  }

  getErrorMessage() {
    if (this.registerForm.controls.email.hasError('required')) {
      return 'You must enter a value';
    }
    return this.registerForm.controls.email.hasError('email')
      ? 'Not a valid email'
      : '';
  }
}
