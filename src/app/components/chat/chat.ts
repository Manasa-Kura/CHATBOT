import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ChatService } from '../../core/services/chat.service';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Header } from '../header/header';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [FormsModule, Header, CommonModule],
  templateUrl: './chat.html',
  styleUrl: './chat.css',
})
export class ChatComponent implements OnInit {

  sessionId: string = '';
  message: string = '';
  messages: any[] = [];
  chats: { id: string, title: string }[] = [];
  loading: boolean = false;

  constructor(
    private chatService: ChatService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.createNewChat();
  }

  createNewChat() {
    this.chatService.newChat().subscribe({
      next: (res: any) => {
        this.sessionId = res.chat_id;
        this.messages = [];

        this.chats.unshift({
          id: this.sessionId,
          title: 'New Chat'
        });

        this.cdr.detectChanges();
      }
    });
  }

  sendMessage() {
    if (!this.message.trim()) return;

    const userMsg = this.message;
    const isFirstMessage = this.messages.length === 0;

    this.messages.push({
      role: 'user',
      content: userMsg
    });

    if (isFirstMessage) {
      const chat = this.chats.find(c => c.id === this.sessionId);
      if (chat) {
        chat.title = userMsg.substring(0, 25);
      }
    }

    this.loading = true;

    this.chatService.sendMessage({
      chat_id: this.sessionId,
      message: userMsg
    }).subscribe({
      next: (res: any) => {

        this.messages.push({
          role: 'bot',
          content: res.response || res.reply || res.answer || res.message
        });

        this.loading = false;
        this.cdr.detectChanges();

        setTimeout(() => {
          const chatBox = document.querySelector('.chat-box');
          if (chatBox) {
            chatBox.scrollTop = chatBox.scrollHeight;
          }
        }, 100);
      },
      error: (err) => {
        console.error('Chat Error:', err);
        this.loading = false;
      }
    });

    this.message = '';
  }

  loadChat(sessionId: string) {
    this.sessionId = sessionId;

  this.chatService.getChatHistory(sessionId).subscribe({
    next: (res: any) => {
      console.log("HISTORY:", res); 
      if (res.messages) {
        this.messages = res.messages;
      }
      else if (res.history) {
        this.messages = [];
        res.history.forEach((item: any) => {
          this.messages.push({
            role: 'user',
            content: item.user
          });
          this.messages.push({
            role: 'bot',
            content: item.bot
          });
        });
      }
      else if (Array.isArray(res)) {
        this.messages = [];
        res.forEach((item: any) => {
          this.messages.push({
            role: 'user',
            content: item.question || item.user
          });
          this.messages.push({
            role: 'bot',
            content: item.answer || item.bot
          });
        });
      }
      this.cdr.detectChanges();
    },
    error: (err) => {
      console.error('History Error:', err);
    }
  });
  }
  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('session_id', this.sessionId);

    this.chatService.uploadDocs(formData).subscribe({
      next: () => {
        this.messages.push({
          role: 'user',
          content: `📎 Uploaded: ${file.name}`
        });
      },
      error: (err) => {
        console.error('Upload Error:', err);
      }
    });
  }
}