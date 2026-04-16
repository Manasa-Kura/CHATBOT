import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ChatService {

  private baseUrl = environment.baseUrl;

  constructor(private http: HttpClient) {}

  private getHeaders() {
    const token = localStorage.getItem('token');

    console.log('TOKEN:', token);  // 🔍 DEBUG

    return {
      headers: new HttpHeaders({
        Authorization: `Bearer ${token}`
      })
    };
  }

  newChat() {
    return this.http.post(
      `${this.baseUrl}/new-chat`,
      {},
      this.getHeaders()
    );
  }

  sendMessage(data: any) {
    return this.http.post(
      `${this.baseUrl}/chat`,
      data,
      this.getHeaders()
    );
  }

  getChatHistory(sessionId: string) {
    // return this.http.get(
    //   `${this.baseUrl}/chat-history/${sessionId}`,
    //   this.getHeaders()
    // );
    return this.http.get(
    `${this.baseUrl}/chat-history?chat_id=${sessionId}`, 
    this.getHeaders()
  );
  }

  uploadDocs(formData: FormData) {
    return this.http.post(
      `${this.baseUrl}/upload-docs`,
      formData,
      this.getHeaders()
    );
  }

  uploadImage(formData: FormData) {
    return this.http.post(
      `${this.baseUrl}/upload-image`,
      formData,
      this.getHeaders()
    );
  }

  summarize(sessionId: string) {
    return this.http.get(
      `${this.baseUrl}/summarize/${sessionId}`,
      this.getHeaders()
    );
  }
}