import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ChatComponent } from './chat/chat.component';
import { HomeComponent } from './home/home.component';
import { SignInComponent } from './sign-in/sign-in.component';
import { authGuard } from './core/guards/auth.guard';

/**
 * Application routing configuration
 * 
 * Routes are organized by access level:
 * - Public routes (no authentication required)
 * - Protected routes (authentication required)
 */
export const routes: Routes = [
  // Public routes
  { 
    path: '', 
    component: HomeComponent, 
    pathMatch: 'full',
    data: { title: 'Home' }
  },
  { 
    path: 'home', 
    component: HomeComponent,
    data: { title: 'Home' }
  },
  { 
    path: 'login', 
    component: SignInComponent,
    data: { title: 'Sign In' }
  },

  // Chat routes
  {
    path: 'chat/:id',
    component: ChatComponent,
    canActivate: [authGuard],
    data: { title: 'Chat', requiresAuth: true }
  },

  // Fallback route
  { 
    path: '**', 
    redirectTo: '',
    data: { title: 'Page Not Found' }
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, {
    enableTracing: false, // Set to true for debugging
    scrollPositionRestoration: 'top',
    anchorScrolling: 'enabled'
  })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
