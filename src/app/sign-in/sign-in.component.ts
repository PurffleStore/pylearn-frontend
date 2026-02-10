// sign-in.component.ts
import { 
  Component, 
  ChangeDetectionStrategy, 
  Output, 
  EventEmitter, 
  OnInit,
  OnDestroy,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { trigger, transition, style, animate } from '@angular/animations';
import { Subject, takeUntil, finalize } from 'rxjs';

import { BrandService } from '../shared/brand.service';
import { AuthenticationService } from '../core/services/authentication.service';
import { LoginCredentials, AuthError } from '../core/interfaces/auth.interface';

/**
 * Professional SignIn Component
 * 
 * Features:
 * - Reactive form validation
 * - Accessibility compliant
 * - Error handling
 * - Loading states
 * - Memory leak prevention
 * - Clean architecture
 */
@Component({
  selector: 'app-sign-in',
  standalone: true,
  imports: [
    CommonModule, 
    ReactiveFormsModule, 
    FormsModule, 
    RouterLink
  ],
  templateUrl: './sign-in.component.html',
  styleUrls: ['./sign-in.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('fadeInOut', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('300ms ease-in', style({ opacity: 1 }))
      ]),
      transition(':leave', [
        animate('300ms ease-out', style({ opacity: 0 }))
      ])
    ])
  ]
})
export class SignInComponent implements OnInit, OnDestroy {
  // Component outputs
  @Output() readonly close = new EventEmitter<void>();

  // Reactive form
  public readonly signInForm: FormGroup;

  // Component state
  public isLoading = false;
  public isSubmitted = false;
  public showPassword = false;
  public errorMessage = '';
  public showForgotModal = false;
  public forgotEmail = '';

  // Private properties
  private readonly destroy$ = new Subject<void>();
  private readonly REDIRECT_URL_KEY = 'redirectAfterLogin';
  private readonly DEFAULT_REDIRECT = '/home';

  // UI enhancement properties
  public readonly learningFacts = [
    'Master grammar with adaptive quizzes',
    'Improve reading with AI-generated passages', 
    'Train listening and pronunciation effectively'
  ];

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly router: Router,
    private readonly authService: AuthenticationService,
    private readonly changeDetectorRef: ChangeDetectorRef,
    public readonly brandService: BrandService
  ) {
    this.signInForm = this.createSignInForm();
  }

  // Lifecycle hooks
  public ngOnInit(): void {
    this.initializeComponent();
  }

  public ngOnDestroy(): void {
    this.cleanup();
  }

  // Public methods
  
  /**
   * Handle form submission
   */
  public onSubmit(): void {
    this.isSubmitted = true;
    this.signInForm.markAllAsTouched();

    if (this.signInForm.invalid) {
      this.focusFirstInvalidField();
      return;
    }

    this.performSignIn();
  }

  /**
   * Toggle password visibility
   */
  public togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  /**
   * Handle forgot password
   */
  public openForgotPasswordModal(event: Event): void {
    event.preventDefault();
    this.showForgotModal = true;
  }

  /**
   * Close forgot password modal
   */
  public closeForgotPasswordModal(): void {
    this.showForgotModal = false;
    this.forgotEmail = '';
  }

  /**
   * Send password reset email
   */
  public sendPasswordReset(): void {
    if (!this.forgotEmail || !this.isValidEmail(this.forgotEmail)) {
      return;
    }

    // In real implementation, call password reset API
    this.showSuccessMessage('Password reset link sent to your email');
    this.closeForgotPasswordModal();
  }

  /**
   * Close the component
   */
  public closeComponent(): void {
    this.router.navigate([this.DEFAULT_REDIRECT]);
    this.close.emit();
  }

  // Form control getters for template
  public get emailControl() {
    return this.signInForm.get('email');
  }

  public get passwordControl() {
    return this.signInForm.get('password');
  }

  public get isFormValid(): boolean {
    return this.signInForm.valid;
  }

  // Social media links getter
  public get socialLinks() {
    return this.brandService.socialLinksCurrent;
  }

  public get websiteDisplay(): string {
    return 'www.' + this.socialLinks.website.replace(/^https?:\/\/(www\.)?/, '');
  }

  // Private methods

  /**
   * Create reactive form with validation
   */
  private createSignInForm(): FormGroup {
    return this.formBuilder.group({
      email: ['', [Validators.required, Validators.minLength(3)]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      rememberMe: [false]
    });
  }

  /**
   * Initialize component
   */
  private initializeComponent(): void {
    this.clearErrorMessage();
    
    // Check if user is already authenticated
    if (this.authService.isLoggedIn()) {
      this.navigateToRedirectUrl();
    }
  }

  /**
   * Perform sign in operation
   */
  private performSignIn(): void {
    const credentials: LoginCredentials = {
      username: this.emailControl?.value?.trim() || '',
      password: this.passwordControl?.value || ''
    };

    this.setLoadingState(true);
    this.clearErrorMessage();

    this.authService.login(credentials)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.setLoadingState(false))
      )
      .subscribe({
        next: () => this.handleSignInSuccess(credentials.username),
        error: (error: AuthError) => this.handleSignInError(error)
      });
  }

  /**
   * Handle successful sign in
   */
  private handleSignInSuccess(username: string): void {
    this.showSuccessMessage('Sign in successful');
    this.navigateToRedirectUrl();
  }

  /**
   * Handle sign in error
   */
  private handleSignInError(error: AuthError): void {
    this.errorMessage = error.message || 'Sign in failed. Please try again.';
    this.changeDetectorRef.markForCheck();
    
    // Clear error after delay
    setTimeout(() => {
      this.clearErrorMessage();
    }, 5000);
  }

  /**
   * Navigate to redirect URL or default
   */
  private navigateToRedirectUrl(): void {
    let redirectUrl = localStorage.getItem(this.REDIRECT_URL_KEY);
    
    // Validate redirect URL to prevent open redirect attacks
    if (!this.isValidRedirectUrl(redirectUrl)) {
      redirectUrl = this.DEFAULT_REDIRECT;
    }
    
    localStorage.removeItem(this.REDIRECT_URL_KEY);
    this.router.navigate([redirectUrl]);
  }

  /**
   * Validate redirect URL to prevent open redirect attacks
   */
  private isValidRedirectUrl(url: string | null): boolean {
    if (!url || url.trim() === '') {
      return false;
    }
    
    // Only allow internal routes that start with /
    if (!url.startsWith('/')) {
      return false;
    }
    
    // Prevent directory traversal attacks
    if (url.includes('..')) {
      return false;
    }
    
    // Prevent protocol-relative URLs (//example.com)
    if (url.startsWith('//')) {
      return false;
    }
    
    return true;
  }

  /**
   * Set loading state
   */
  private setLoadingState(loading: boolean): void {
    this.isLoading = loading;
    this.changeDetectorRef.markForCheck();
  }

  /**
   * Clear error message
   */
  private clearErrorMessage(): void {
    this.errorMessage = '';
    this.changeDetectorRef.markForCheck();
  }

  /**
   * Show success message
   */
  private showSuccessMessage(message: string): void {
    // In real implementation, use a toast service
    console.log(message);
  }

  /**
   * Focus first invalid form field
   */
  private focusFirstInvalidField(): void {
    setTimeout(() => {
      const firstInvalidControl = document.querySelector('.ng-invalid') as HTMLElement;
      firstInvalidControl?.focus();
    }, 0);
  }

  /**
   * Validate email format
   */
  public isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Cleanup subscriptions and resources
   */
  private cleanup(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Public methods for external component communication

  /**
   * Programmatically trigger sign in (for external components)
   */
  public triggerSignIn(): void {
    this.onSubmit();
  }

  /**
   * Get authentication status observable
   */
  public get authStatus$() {
    return this.authService.isLoggedIn$;
  }

  /**
   * Check if user is currently authenticated
   */
  public get isAuthenticated(): boolean {
    return this.authService.isLoggedIn();
  }
}
