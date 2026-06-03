import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { tap, catchError, switchMap, finalize } from 'rxjs/operators';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';

/**
 * Represents a local user credential entry.
 * Used for standard demo accounts that authenticate without a backend API call.
 */
interface LocalCredential {
  username: string;
  password: string;
}

/**
 * Authentication service responsible for managing user authentication state
 * and handling login/logout operations with automatic token refresh.
 *
 * Supports two authentication paths:
 * 1. Local credential check — for the five standard demo accounts (pykara1–pykara5).
 * 2. API-backed authentication — for all other accounts via the backend.
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

  /**
   * Standard demo accounts for local authentication.
   * These credentials are intentionally hardcoded for demonstration purposes only
   * and do not represent real user data.
   */
  private readonly LOCAL_CREDENTIALS: ReadonlyArray<LocalCredential> = [
    { username: 'Pykara1', password: 'Pyk@12345' },
    { username: 'Pykara2', password: 'Pyk@12345' },
    { username: 'Pykara3', password: 'Pyk@12345' },
    { username: 'Pykara4', password: 'Pyk@12345' },
    { username: 'Pykara5', password: 'Pyk@12345' }
  ];

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
   * Authenticate user with credentials.
   *
   * For the five standard demo accounts (pykara1–pykara5), authentication is
   * resolved locally without an API call. All other accounts are authenticated
   * via the backend API.
   *
   * @param credentials - The username and password supplied by the user.
   * @returns An Observable that emits on success or errors with an AuthError.
   */
  public login(credentials: { username: string; password: string }): Observable<any> {
    if (this.isLocalCredential(credentials.username, credentials.password)) {
      return this.performLocalLogin(credentials.username);
    }

    return this.http.post(
      `${this.API_BASE_URL}${this.LOGIN_ENDPOINT}`,
      { username: credentials.username, password: credentials.password },
      { withCredentials: true }
    ).pipe(
      tap(() => {
        this.setLoggedIn(true);
        this.startAutoRefresh();
        localStorage.setItem('username', credentials.username);
      }),
      catchError(this.handleAuthError.bind(this))
    );
  }

  /**
   * Check whether the supplied credentials match a local demo account.
   *
   * @param username - The username to look up.
   * @param password - The password to verify.
   * @returns `true` if a matching local credential exists, otherwise `false`.
   */
  private isLocalCredential(username: string, password: string): boolean {
    return this.LOCAL_CREDENTIALS.some(
      (credential) => credential.username === username && credential.password === password
    );
  }

  /**
   * Complete a local (non-API) login for demo accounts.
   * Sets authentication state and persists the username to localStorage.
   *
   * @param username - The authenticated username.
   * @returns An Observable that immediately emits a success result.
   */
  private performLocalLogin(username: string): Observable<{ success: boolean }> {
    this.setLoggedIn(true);
    localStorage.setItem('username', username);
    return of({ success: true });
  }

  /**
   * Log out the current user.
   *
   * For local demo accounts, the session is cleared immediately without an API
   * call. For API-authenticated accounts, a logout request is sent to the backend
   * and the local session is cleaned up regardless of the response.
   *
   * @returns An Observable that completes after logout handling is finished.
   */
  public logout(): Observable<any> {
    const currentUsername = localStorage.getItem('username') ?? '';
    const isLocal = this.LOCAL_CREDENTIALS.some(
      (credential) => credential.username === currentUsername
    );

    if (isLocal) {
      this.handleLogoutSuccess();
      return of({ success: true });
    }

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
