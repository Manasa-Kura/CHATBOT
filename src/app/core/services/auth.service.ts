import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private baseUrl = environment.baseUrl;
  constructor(private http: HttpClient) {}
  register(data: any) {
    return this.http.post(`${this.baseUrl}/register`, data);
  }
  login(data: any) {
    return this.http.post(`${this.baseUrl}/login`, data);
  }
  profile() {
    const token = localStorage.getItem('token');
    return this.http.get(`${this.baseUrl}/profile`, {
      headers: new HttpHeaders({
        Authorization: `Bearer ${token ?? ''}`,
        'ngrok-skip-browser-warning': 'true'
      })
    });
  }
  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('chat_sessions');
    localStorage.removeItem('active_chat_session');
  }
  isLoggedIn() {
    return !!localStorage.getItem('token');
  }
}