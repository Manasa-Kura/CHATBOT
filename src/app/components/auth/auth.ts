import { Component } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
@Component({
  selector: 'app-auth',
  standalone: true,
  imports:[FormsModule, CommonModule],
  templateUrl: './auth.html',
  styleUrls: ['./auth.css']
})
export class AuthComponent {
  username = '';
  password = '';
  isLogin = true;
  errorMessage = '';
  loading = false;
  constructor(private auth: AuthService, private router: Router) {}
  toggleMode() {
    this.isLogin = !this.isLogin;
  }
  submit() {
    this.errorMessage = '';
    if (!this.username.trim() || !this.password.trim()) {
      this.errorMessage = 'Username and password are required.';
      return;
    }
    const data = {
      username: this.username,
      password: this.password
    };
    this.loading = true;
    if (this.isLogin) {
      this.auth.login(data).subscribe({
        next: (res: any) => {
          const token = res.access_token || res.token || res.data?.access_token || res.data?.token;
          if (!token) {
            this.errorMessage = 'Login succeeded, but no token was returned.';
            this.loading = false;
            return;
          }
          localStorage.setItem('token', token);
          this.loading = false;
          this.router.navigate(['/chat']);
        },
        error: (err) => {
          this.loading = false;
          this.errorMessage = err?.error?.detail || err?.error?.message || 'Login failed.';
        }
      });
    }
    else {
      this.auth.register(data).subscribe({
        next: () => {
          this.loading = false;
          this.isLogin = true;
          this.errorMessage = 'Registered successfully. Please login.';
        },
        error: (err) => {
          this.loading = false;
          this.errorMessage = err?.error?.detail || err?.error?.message || 'Registration failed.';
        }
      });
    }
  }
}
