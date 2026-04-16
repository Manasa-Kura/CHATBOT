import { Component } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';


@Component({
  selector: 'app-auth',
  standalone: true,
  imports:[FormsModule],
  templateUrl: './auth.html',
  styleUrls: ['./auth.css']
})
export class AuthComponent {

  username = '';
  password = '';
  isLogin = true;

  constructor(private auth: AuthService, private router: Router) {}

  toggleMode() {
    this.isLogin = !this.isLogin;
  }

  submit() {
    const data = {
      username: this.username,
      password: this.password
    };

    if (this.isLogin) {
      this.auth.login(data).subscribe((res: any) => {
        localStorage.setItem('token', res.access_token);
        this.router.navigate(['/chat']);
      });
    } else {
      this.auth.register(data).subscribe(() => {
        alert('Registered successfully');
        this.isLogin = true;
      });
    }
  }
}