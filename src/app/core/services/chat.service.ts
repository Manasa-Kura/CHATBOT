import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
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

    return {
      headers: new HttpHeaders({
        Authorization: `Bearer ${token ?? ''}`,
        'ngrok-skip-browser-warning': 'true'
      })
    };
  }

  newChat() {
    return this.http.post(`${this.baseUrl}/new-chat`, {}, this.getHeaders());
  }

  getChats() {
    return this.http.get(`${this.baseUrl}/chats`, this.getHeaders());
  }

  renameChat(sessionId: string | number, title: string) {
    return this.http.put(
      `${this.baseUrl}/chat/${sessionId}`,
      { title },
      this.getHeaders()
    );
  }

  deleteChat(sessionId: string | number) {
    return this.http.delete(`${this.baseUrl}/chat/${sessionId}`, this.getHeaders());
  }

  sendMessage(sessionId: string | number, message: string) {
    return this.http.post(
      `${this.baseUrl}/chat`,
      {
        message,
        session_id: Number(sessionId)
      },
      this.getHeaders()
    );
  }

  getChatHistory(sessionId: string | number) {
    return this.http.get(
      `${this.baseUrl}/chat-history/${sessionId}`,
      this.getHeaders()
    );
  }

  uploadDocs(sessionId: string | number, file: File) {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post(`${this.baseUrl}/upload-docs`, formData, {
      ...this.getHeaders(),
      params: new HttpParams().set('session_id', String(sessionId))
    });
  }

  uploadImage(sessionId: string | number, file: File) {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post(`${this.baseUrl}/upload-image`, formData, {
      ...this.getHeaders(),
      params: new HttpParams().set('session_id', String(sessionId))
    });
  }

  summarize(sessionId: string | number) {
    return this.http.get(
      `${this.baseUrl}/summarize/${sessionId}`,
      this.getHeaders()
    );
  }
}
