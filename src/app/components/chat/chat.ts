import {
  AfterViewChecked,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnInit,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ChatService } from '../../core/services/chat.service';
type MessageRole = 'user' | 'bot' | 'system';
type MessageType = 'text' | 'file' | 'image' | 'error';
interface ChatSession {
  id: string;
  title: string;
  draftTitle?: string;
  renaming?: boolean;
}
interface ChatMessage {
  role: MessageRole;
  type: MessageType;
  content: string;
  fileName?: string;
  previewUrl?: string;
}
interface UserProfile {
  id: string;
  username: string;
}
@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat.html',
  styleUrl: './chat.css'
})
export class ChatComponent implements OnInit, AfterViewChecked {
  @ViewChild('chatBox') chatBox?: ElementRef<HTMLDivElement>;
  sessionId = '';
  message = '';
  messages: ChatMessage[] = [];
  chats: ChatSession[] = [];
  loading = false;
  loadingHistory = false;
  uploadingDoc = false;
  uploadingImage = false;
  dragOver = false;
  errorMessage = '';
  profileMenuOpen = false;
  activePanel: 'profile' | 'settings' | null = null;
  showLogoutConfirm = false;
  rightPanelDark = false;
  profileLoading = false;
  profileError = '';
  userProfile: UserProfile | null = null;
  private readonly chatsStorageKey = 'chat_sessions';
  private readonly activeSessionStorageKey = 'active_chat_session';
  private readonly rightPanelThemeKey = 'right_panel_dark';
  private readonly imageStoreKey = 'chat_image_previews';
  private shouldScroll = false;
  constructor(
    private chatService: ChatService,
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}
  ngOnInit() {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }
    this.loadStoredSessions();
    this.rightPanelDark = localStorage.getItem(this.rightPanelThemeKey) === 'true';
    this.loadProfile();
    this.fetchSessions();
  }
  ngAfterViewChecked() {
    if (!this.shouldScroll) {
      return;
    }
    this.scrollToBottom();
    this.shouldScroll = false;
  }
  createNewChat() {
    this.errorMessage = '';
    this.loadingHistory = true;
    this.chatService.newChat().subscribe({
      next: (res: unknown) => {
        const id = this.extractSessionId(res);
        if (!id) {
          this.showError('New chat was created, but no session id was returned.');
          this.loadingHistory = false;
          return;
        }
        const existing = this.chats.find((chat) => chat.id === id);
        if (!existing) {
          this.chats.unshift({ id, title: this.extractTitle(res) || 'New Chat' });
        }
        this.sessionId = id;
        this.messages = [];
        this.loadingHistory = false;
        this.persistSessions();
        this.cdr.detectChanges();
      },
      error: (err: unknown) => {
        this.loadingHistory = false;
        this.showError(this.extractError(err, 'Could not create a new chat.'));
      }
    });
  }
  loadChat(sessionId: string) {
    if (sessionId === this.sessionId && this.messages.length > 0) {
      return;
    }
    this.sessionId = sessionId;
    this.messages = [];
    this.errorMessage = '';
    this.loadingHistory = true;
    localStorage.setItem(this.activeSessionStorageKey, sessionId);
    this.chatService.getChatHistory(sessionId).subscribe({
      next: (res: unknown) => {
        this.messages = this.normalizeHistory(res);
        this.loadingHistory = false;
        this.markForScroll();
        this.cdr.detectChanges();
      },
      error: (err: unknown) => {
        this.loadingHistory = false;
        this.showError(this.extractError(err, 'Could not load chat history.'));
      }
    });
  }
  sendMessage() {
    const text = this.message.trim();

    if (!text || !this.sessionId || this.loading) {
      return;
    }
    const isFirstQuestion = !this.messages.some((msg) => msg.role === 'user');
    this.message = '';
    this.errorMessage = '';
    this.messages.push({ role: 'user', type: 'text', content: text });
    this.markForScroll();
    if (isFirstQuestion) {
      this.setChatTitleFromQuestion(text);
    }
    this.loading = true;
    this.chatService.sendMessage(this.sessionId, text).subscribe({
      next: (res: unknown) => {
        this.messages.push({
          role: 'bot',
          type: 'text',
          content: this.extractBotReply(res)
        });
        this.loading = false;
        this.markForScroll();
        this.cdr.detectChanges();
      },
      error: (err: unknown) => {
        this.loading = false;
        this.messages.push({
          role: 'system',
          type: 'error',
          content: this.extractError(err, 'Message failed. Please try again.')
        });
        this.markForScroll();
      }
    });
  }
  onDocSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) {
      this.uploadDocument(file);
    }
  }
  onImageSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';

    if (file) {
      this.uploadImage(file);
    }
  }
  onDocDrop(event: DragEvent) {
    event.preventDefault();
    this.dragOver = false;
    const file = event.dataTransfer?.files?.[0];

    if (file) {
      this.uploadDocument(file);
    }
  }
  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.dragOver = true;
  }
  onDragLeave() {
    this.dragOver = false;
  }
  startRename(chat: ChatSession, event: MouseEvent) {
    event.stopPropagation();
    chat.renaming = true;
    chat.draftTitle = chat.title;
  }
  saveRename(chat: ChatSession, event?: Event) {
    event?.stopPropagation();
    const nextTitle = (chat.draftTitle || '').trim();
    if (!nextTitle) {
      chat.renaming = false;
      chat.draftTitle = chat.title;
      return;
    }
    chat.title = nextTitle;
    chat.renaming = false;
    this.persistSessions();
    this.chatService.renameChat(chat.id, nextTitle).subscribe({
      error: (err: unknown) => {
        this.showError(this.extractError(err, 'Chat was renamed locally, but backend rename failed.'));
      }
    });
  }
  deleteChat(chat: ChatSession, event: MouseEvent) {
    event.stopPropagation();
    const previousActiveId = this.sessionId;
    this.chats = this.chats.filter((item) => item.id !== chat.id);
    if (chat.id === previousActiveId) {
      const next = this.chats[0];
      this.sessionId = '';
      this.messages = [];
      if (next) {
        this.loadChat(next.id);
      } else {
        localStorage.removeItem(this.activeSessionStorageKey);
      }
    }
    this.persistSessions();

    this.chatService.deleteChat(chat.id).subscribe({
      error: (err: unknown) => {
        this.showError(this.extractError(err, 'Chat was removed locally, but backend delete failed.'));
      }
    });
  }
  toggleProfileMenu() {
    this.profileMenuOpen = !this.profileMenuOpen;
  }
  openProfile() {
    this.profileMenuOpen = false;
    this.activePanel = 'profile';
    this.profileError = '';
    if (this.userProfile) {
      return;
    }
    this.loadProfile();
  }
  private loadProfile() {
    if (this.profileLoading) {
      return;
    }
    this.profileLoading = true;
    this.authService.profile().subscribe({
      next: (res: unknown) => {
        const data = this.payloadRecord(res);
        const id = data?.['id'] ?? data?.['user_id'];
        this.userProfile = {
          id: id === undefined || id === null ? '-' : String(id),
          username: this.valueAsString(data?.['username'] ?? data?.['name']) || '-'
        };
        this.profileLoading = false;
      },
      error: (err: unknown) => {
        this.profileLoading = false;
        this.profileError = this.extractError(err, 'Could not load profile details.');
      }
    });
  }
  openSettings() {
    this.profileMenuOpen = false;
    this.activePanel = 'settings';
  }
  requestLogout() {
    this.profileMenuOpen = false;
    this.showLogoutConfirm = true;
  }
  closePanel() {
    this.activePanel = null;
  }
  cancelLogout() {
    this.showLogoutConfirm = false;
  }
  toggleRightPanelMode() {
    this.rightPanelDark = !this.rightPanelDark;
    localStorage.setItem(this.rightPanelThemeKey, String(this.rightPanelDark));
  }
  confirmLogout() {
    this.showLogoutConfirm = false;
    this.authService.logout();
    this.router.navigate(['/login']);
  }
  trackChat(_: number, chat: ChatSession) {
    return chat.id;
  }
  trackMessage(index: number) {
    return index;
  }
  private fetchSessions() {
    this.chatService.getChats().subscribe({
      next: (res: unknown) => {
        const sessions = this.normalizeChats(res);

        if (sessions.length > 0) {
          this.chats = this.mergeSessions(sessions, this.chats);
          this.persistSessions();
        }

        const storedActive = localStorage.getItem(this.activeSessionStorageKey);
        const active = this.chats.find((chat) => chat.id === storedActive) || this.chats[0];

        if (active) {
          this.loadChat(active.id);
        } else {
          this.createNewChat();
        }
      },
      error: () => {
        const active = this.chats.find((chat) => chat.id === this.sessionId) || this.chats[0];

        if (active) {
          this.loadChat(active.id);
        } else {
          this.createNewChat();
        }
      }
    });
  }

  private uploadDocument(file: File) {
    if (!this.sessionId) {
      this.showError('Create or select a chat before uploading a document.');
      return;
    }

    this.uploadingDoc = true;
    this.errorMessage = '';
    this.messages.push({
      role: 'user',
      type: 'file',
      content: 'Document uploaded',
      fileName: file.name
    });
    this.markForScroll();

    this.chatService.uploadDocs(this.sessionId, file).subscribe({
      next: (res: unknown) => {
        const reply = this.extractUploadReply(res);
        if (reply) {
          this.messages.push({ role: 'bot', type: 'text', content: reply });
        }
        this.uploadingDoc = false;
        this.markForScroll();
        this.cdr.detectChanges();
      },
      error: (err: unknown) => {
        this.uploadingDoc = false;
        this.messages.push({
          role: 'system',
          type: 'error',
          content: this.extractError(err, 'Document upload failed.')
        });
        this.markForScroll();
        this.cdr.detectChanges();
      }
    });
  }

  private uploadImage(file: File) {
    if (!this.sessionId) {
      this.showError('Create or select a chat before uploading an image.');
      return;
    }

    this.uploadingImage = true;
    this.errorMessage = '';

    this.fileToDataUrl(file).then((previewUrl) => {
      this.saveImagePreview(this.sessionId, file.name, previewUrl);
      this.messages.push({
        role: 'user',
        type: 'image',
        content: 'Image uploaded',
        fileName: file.name,
        previewUrl
      });
      this.markForScroll();

      this.chatService.uploadImage(this.sessionId, file).subscribe({
        next: (res: unknown) => {
          const reply = this.extractUploadReply(res);
          this.messages.push({
            role: 'bot',
            type: 'text',
            content: reply || 'Image uploaded successfully.'
          });
          this.uploadingImage = false;
          this.markForScroll();
          this.cdr.detectChanges();
        },
        error: (err: unknown) => {
          this.uploadingImage = false;
          this.messages.push({
            role: 'system',
            type: 'error',
            content: this.extractError(err, 'Image upload failed.')
          });
          this.markForScroll();
          this.cdr.detectChanges();
        }
      });
    }).catch(() => {
      this.uploadingImage = false;
      this.messages.push({
        role: 'system',
        type: 'error',
        content: 'Image preview could not be prepared.'
      });
      this.markForScroll();
      this.cdr.detectChanges();
    });
  }

  private setChatTitleFromQuestion(question: string) {
    const title = question.length > 36 ? `${question.slice(0, 36)}...` : question;
    const chat = this.chats.find((item) => item.id === this.sessionId);

    if (!chat) {
      return;
    }

    chat.title = title;
    this.persistSessions();

    this.chatService.renameChat(chat.id, title).subscribe({
      error: () => {
        this.persistSessions();
      }
    });
  }

  private loadStoredSessions() {
    const rawSessions = localStorage.getItem(this.chatsStorageKey);
    const activeSession = localStorage.getItem(this.activeSessionStorageKey);

    if (rawSessions) {
      try {
        const parsed = JSON.parse(rawSessions) as ChatSession[];
        this.chats = parsed.filter((chat) => chat.id && chat.title);
      } catch {
        this.chats = [];
      }
    }

    if (activeSession) {
      this.sessionId = activeSession;
    }
  }

  private persistSessions() {
    const sessions = this.chats.map(({ id, title }) => ({ id, title }));
    localStorage.setItem(this.chatsStorageKey, JSON.stringify(sessions));

    if (this.sessionId) {
      localStorage.setItem(this.activeSessionStorageKey, this.sessionId);
    }
  }

  private normalizeChats(res: unknown): ChatSession[] {
    const data = this.payloadRecord(res);
    const list =
      this.asArray(data?.['chats']) ||
      this.asArray(data?.['sessions']) ||
      this.asArray(data?.['data']) ||
      this.asArray(res) ||
      [];

    return list
      .map((item) => {
        const record = this.asRecord(item);
        const id = this.extractSessionId(record);
        const title = this.extractTitle(record) || 'New Chat';
        return id ? { id, title } : null;
      })
      .filter((item): item is ChatSession => !!item);
  }

  private mergeSessions(primary: ChatSession[], fallback: ChatSession[]) {
    const fallbackMap = new Map(fallback.map((chat) => [chat.id, chat.title]));

    return primary.map((chat) => ({
      ...chat,
      title: chat.title === 'New Chat' && fallbackMap.has(chat.id)
        ? fallbackMap.get(chat.id) || chat.title
        : chat.title
    }));
  }

  private normalizeHistory(res: unknown): ChatMessage[] {
    const data = this.payloadRecord(res);
    const messages =
      this.asArray(data?.['messages']) ||
      this.asArray(data?.['history']) ||
      this.asArray(data?.['data']) ||
      this.asArray(res) ||
      [];

    const normalized: ChatMessage[] = [];

    messages.forEach((item) => {
      const record = this.asRecord(item);

      if (!record) {
        return;
      }

      const pairedUserText = this.valueAsString(record['message'] ?? record['user'] ?? record['question']);
      const pairedBotText = this.valueAsString(record['response'] ?? record['bot'] ?? record['answer']);

      if (pairedUserText && pairedBotText) {
        normalized.push(this.messageFromHistoryUserText(pairedUserText));
        normalized.push({ role: 'bot', type: 'text', content: pairedBotText });
        return;
      }

      const role = this.normalizeRole(record['role']);
      const content = this.valueAsString(
        record['content'] ??
          record['message'] ??
          record['text'] ??
          record['answer'] ??
          record['response']
      );

      if (role && content) {
        normalized.push({ role, type: 'text', content });
        return;
      }

      const userText = this.valueAsString(record['user'] ?? record['question'] ?? record['message']);
      const botText = this.valueAsString(record['bot'] ?? record['answer'] ?? record['response']);

      if (userText) {
        normalized.push(this.messageFromHistoryUserText(userText));
      }

      if (botText) {
        normalized.push({ role: 'bot', type: 'text', content: botText });
      }
    });

    return normalized;
  }

  private normalizeRole(value: unknown): MessageRole | null {
    const role = String(value || '').toLowerCase();

    if (role === 'user') {
      return 'user';
    }

    if (role === 'assistant' || role === 'bot' || role === 'ai') {
      return 'bot';
    }

    if (role === 'system') {
      return 'system';
    }

    return null;
  }
  private messageFromHistoryUserText(content: string): ChatMessage {
    if (content.trim().toUpperCase() === '[IMAGE]') {
      const storedImage = this.getLatestImagePreview(this.sessionId);
      return {
        role: 'user',
        type: 'image',
        content: 'Image uploaded',
        fileName: storedImage?.fileName || 'Uploaded image',
        previewUrl: storedImage?.previewUrl
      };
    }
    return { role: 'user', type: 'text', content };
  }
  private fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }
  private saveImagePreview(sessionId: string, fileName: string, previewUrl: string) {
    const previews = this.loadImagePreviews();
    const sessionPreviews = previews[sessionId] || [];
    sessionPreviews.push({ fileName, previewUrl });
    previews[sessionId] = sessionPreviews.slice(-10);
    localStorage.setItem(this.imageStoreKey, JSON.stringify(previews));
  }
  private getLatestImagePreview(sessionId: string) {
    const previews = this.loadImagePreviews()[sessionId] || [];
    return previews[previews.length - 1];
  }
  private loadImagePreviews(): Record<string, { fileName: string; previewUrl: string }[]> {
    const raw = localStorage.getItem(this.imageStoreKey);
    if (!raw) {
      return {};
    }
    try {
      return JSON.parse(raw) as Record<string, { fileName: string; previewUrl: string }[]>;
    } catch {
      return {};
    }
  }
  private extractSessionId(res: unknown) {
    const data = this.payloadRecord(res);
    const value =
      data?.['session_id'] ??
      data?.['chat_id'] ??
      data?.['id'] ??
      this.asRecord(data?.['chat'])?.['id'];
    return value === undefined || value === null ? '' : String(value);
  }
  private extractTitle(res: unknown) {
    const data = this.payloadRecord(res);
    return this.valueAsString(data?.['title'] ?? data?.['name'] ?? data?.['chat_title']);
  }
  private extractBotReply(res: unknown) {
    const data = this.payloadRecord(res);
    return (
      this.valueAsString(
        data?.['response'] ??
          data?.['reply'] ??
          data?.['answer'] ??
          data?.['message'] ??
          data?.['content']
      ) || 'No response returned.'
    );
  }
  private extractUploadReply(res: unknown) {
    const data = this.payloadRecord(res);
    return this.valueAsString(
      data?.['summary'] ??
        data?.['response'] ??
        data?.['answer'] ??
        data?.['message'] ??
        data?.['detail']
    );
  }
  private extractError(err: unknown, fallback: string) {
    const data = this.asRecord(err);
    const error = this.asRecord(data?.['error']);
    const nestedError = this.asRecord(error?.['error']);
    const detail = data?.['detail'] ?? error?.['detail'] ?? error?.['message'];
    if (Array.isArray(detail) && detail.length > 0) {
      const first = this.asRecord(detail[0]);
      return this.valueAsString(first?.['msg']) || fallback;
    }
    return this.valueAsString(detail ?? nestedError?.['message'] ?? data?.['message']) || fallback;
  }
  private showError(message: string) {
    this.errorMessage = message;
  }
  private markForScroll() {
    this.shouldScroll = true;
  }
  private scrollToBottom() {
    const element = this.chatBox?.nativeElement;
    if (element) {
      element.scrollTop = element.scrollHeight;
    }
  }
  private asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }
  private payloadRecord(value: unknown): Record<string, unknown> | null {
    const record = this.asRecord(value);
    const nestedData = this.asRecord(record?.['data']);
    return nestedData || record;
  }
  private asArray(value: unknown): unknown[] | null {
    return Array.isArray(value) ? value : null;
  }
  private valueAsString(value: unknown) {
    return typeof value === 'string' ? value.trim() : '';
  }
}
