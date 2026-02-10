import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthenticationService } from '../services/authentication.service';
import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

/**
 * Route guard to protect authenticated routes
 * Redirects unauthenticated users to login page with return URL
 */
export const authGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const authService = inject(AuthenticationService);
  const router = inject(Router);

  // Check if user is already logged in locally
  if (authService.isLoggedIn()) {
    return true;
  }

  // Check session with server
  return authService.checkSession().pipe(
    map((isAuthenticated: boolean) => {
      if (isAuthenticated) {
        return true;
      }
      
      // Store intended destination for redirect after login
      localStorage.setItem('redirectAfterLogin', state.url);
      router.navigate(['/login']);
      return false;
    }),
    catchError(() => {
      // On error, redirect to login
      localStorage.setItem('redirectAfterLogin', state.url);
      router.navigate(['/login']);
      return of(false);
    })
  );
};
