import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { tap, catchError, switchMap, finalize } from 'rxjs/operators';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';

/**
 * Authentication service responsible for managing user authentication state
 * and handling login/logout operations with automatic token refresh.
 */
@Injectable({
  providedIn: 'root'
})
export class AuthenticationService {
  private readonly API_BASE_URL = environment.apiBaseUrl;
  private readonly TOKEN_REFRESH_INTERVAL = 12 * 60 * 1000; // 12 minutes
  private readonly LOGIN_ENDPOINT = '/auth/login';
  private readonly LOGOUT_ENDPOINT = '/auth/logout';
  private readonly REFRESH_ENDPOINT = '/auth/refresh';
  private readonly CHECK_AUTH_ENDPOINT = '/auth/check-auth';

  private readonly loggedInSubject = new BehaviorSubject<boolean>(false);
  private refreshIntervalId: number | null = null;

  public readonly isLoggedIn$ = this.loggedInSubject.asObservable();

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router
  ) {
    this.initializeAuthState();
  }

  /**
   * Initialize authentication state on service creation
   */
  private initializeAuthState(): void {
    const hasUserSession = this.hasValidSession();
    this.loggedInSubject.next(hasUserSession);
  }

  /**
   * Check if user has a valid session
   */
  private hasValidSession(): boolean {
    return typeof localStorage !== 'undefined' && !!localStorage.getItem('username');
  }

  /**
   * Get current authentication status
   */
  public isLoggedIn(): boolean {
    return this.loggedInSubject.value;
  }

  /**
   * Update authentication status
   */
  public setLoggedIn(status: boolean): void {
    this.loggedInSubject.next(status);
  }

  /**
   * Authenticate user with credentials
   */
  public login(credentials: { username: string; password: string }): Observable<any> {
    const loginData = {
      username: credentials.username,
      password: credentials.password
    };

    return this.http.post(`${this.API_BASE_URL}${this.LOGIN_ENDPOINT}`, loginData, {
      withCredentials: true
    }).pipe(
      tap(() => {
        this.setLoggedIn(true);
        this.startAutoRefresh();
        localStorage.setItem('username', credentials.username);
      }),
      catchError(this.handleAuthError.bind(this))
    );
  }

  /**
   * Log out current user
   */
  public logout(): Observable<any> {
    return this.http.post(`${this.API_BASE_URL}${this.LOGOUT_ENDPOINT}`, {}, {
      withCredentials: true
    }).pipe(
      tap(() => this.handleLogoutSuccess()),
      catchError((error) => {
        // Even if logout fails, clean up local state
        this.handleLogoutSuccess();
        return throwError(() => error);
      }),
      finalize(() => this.handleLogoutSuccess())
    );
  }

  /**
   * Check if current session is valid
   */
  public checkSession(): Observable<boolean> {
    return this.http.get(`${this.API_BASE_URL}${this.CHECK_AUTH_ENDPOINT}`, {
      withCredentials: true
    }).pipe(
      tap(() => {
        this.setLoggedIn(true);
        this.startAutoRefresh();
      }),
      switchMap(() => [true]),
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          return this.attemptTokenRefresh();
        }
        this.setLoggedIn(false);
        return [false];
      })
    );
  }

  /**
   * Start automatic token refresh
   */
  public startAutoRefresh(): void {
    if (this.refreshIntervalId) {
      return;
    }

    this.refreshIntervalId = window.setInterval(() => {
      this.refreshAccessToken().subscribe({
        error: () => this.handleRefreshError()
      });
    }, this.TOKEN_REFRESH_INTERVAL);
  }

  /**
   * Stop automatic token refresh
   */
  public clearAutoRefresh(): void {
    if (this.refreshIntervalId) {
      clearInterval(this.refreshIntervalId);
      this.refreshIntervalId = null;
    }
  }

  /**
   * Refresh access token
   */
  private refreshAccessToken(): Observable<any> {
    return this.http.post(`${this.API_BASE_URL}${this.REFRESH_ENDPOINT}`, {}, {
      withCredentials: true
    }).pipe(
      catchError(this.handleRefreshError.bind(this))
    );
  }

  /**
   * Attempt to refresh token when session check fails
   */
  private attemptTokenRefresh(): Observable<boolean> {
    return this.http.post(`${this.API_BASE_URL}${this.REFRESH_ENDPOINT}`, {}, {
      withCredentials: true
    }).pipe(
      tap(() => {
        this.setLoggedIn(true);
        this.startAutoRefresh();
      }),
      switchMap(() => [true]),
      catchError(() => {
        this.setLoggedIn(false);
        return [false];
      })
    );
  }

  /**
   * Handle authentication errors
   */
  private handleAuthError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'Authentication failed';
    
    if (error.error?.message) {
      errorMessage = error.error.message;
    } else if (error.status === 401) {
      errorMessage = 'Invalid credentials';
    } else if (error.status === 0) {
      errorMessage = 'Network error - please check your connection';
    }

    return throwError(() => ({ message: errorMessage, status: error.status }));
  }

  /**
   * Handle refresh token errors
   */
  private handleRefreshError(): Observable<never> {
    this.clearTokens();
    this.setLoggedIn(false);
    this.router.navigate(['/login']);
    return throwError(() => new Error('Session expired'));
  }

  /**
   * Handle successful logout
   */
  private handleLogoutSuccess(): void {
    this.clearTokens();
    this.clearAutoRefresh();
    this.setLoggedIn(false);
    localStorage.removeItem('username');
  }

  /**
   * Clear authentication tokens
   */
  private clearTokens(): void {
    // Clear HTTP-only cookies by setting expired date
    document.cookie = 'access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; secure; samesite=strict';
    document.cookie = 'refresh_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; secure; samesite=strict';
  }

  /**
   * Get access token from cookies (for debugging purposes)
   */
  public getAccessToken(): string | null {
    if (typeof document === 'undefined') {
      return null;
    }

    const cookies = document.cookie.split('; ');
    const tokenCookie = cookies.find(cookie => cookie.startsWith('access_token='));
    return tokenCookie ? tokenCookie.split('=')[1] : null;
  }

  /**
   * Cleanup on service destruction
   */
  public ngOnDestroy(): void {
    this.clearAutoRefresh();
  }
}
