import { Routes } from '@angular/router';
import { AuthComponent } from './components/auth/auth';
import { ChatComponent } from './components/chat/chat';

export const routes: Routes = [
  { path: '', component: AuthComponent },
  { path: 'chat', component: ChatComponent }
];