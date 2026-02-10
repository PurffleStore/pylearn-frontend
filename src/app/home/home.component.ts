import { Component, AfterViewInit, OnInit, OnDestroy, ElementRef, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { BrandService } from '../shared/brand.service';
import { MatDialog } from '@angular/material/dialog';
import { PronunciationComponent } from '../pronunciation/pronunciation.component';
import { AuthenticationService } from '../core/services/authentication.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements AfterViewInit, OnInit, OnDestroy {
  // -------------------- UI State --------------------
  menuOpen = false;
  showGuidePopup = false;
  selectedCardTitle: string | null = null;
  showAccountMenu = false;
  showPrivacyPopup = false;
  showTermsPopup = false;

  // -------------------- Authentication State --------------------
  isAuthenticated = false;
  username: string | null = null;
  private authSub?: Subscription;

  // -------------------- Card Data --------------------
  cards = [
    { title: 'Grammar Chat', image: 'assets/images/home/Grammar_chat.png', action: () => this.goToChat(), disabled: false },
    { title: 'Voice', image: 'assets/images/home/voice.png', action: () => this.goToVoice(), disabled: true },
    { title: 'Find Word', image: 'assets/images/home/find_word.png', action: () => this.goToFindword(), disabled: true }
  ];

  // -------------------- Constructor --------------------
  constructor(
    private router: Router,
    private authService: AuthenticationService,
    private host: ElementRef,
    public brand: BrandService,
    private dialog: MatDialog
  ) { }

  // -------------------- Lifecycle Hooks --------------------
  ngOnInit(): void {
    this.isAuthenticated = this.authService.isLoggedIn();
    this.username = localStorage.getItem('username');
    this.authSub = this.authService.isLoggedIn$.subscribe((v) => {
      this.isAuthenticated = v;
      this.username = v ? localStorage.getItem('username') : null;
      if (!v) this.showAccountMenu = false;
    });
  }

  ngAfterViewInit(): void { }

  ngOnDestroy(): void {
    this.authSub?.unsubscribe();
  }

  // -------------------- Avatar Helpers --------------------
  get usernameInitial(): string {
    const u = this.username || '';
    return u.trim().charAt(0).toUpperCase() || 'U';
  }

  get displayName(): string {
    const u = this.username || '';
    if (!u) return '';
    const name = u.includes('@') ? u.split('@')[0] : u;
    return name.replace(/\b\w/g, (c) => c.toUpperCase());
  }

  get displayEmail(): string {
    return this.username || '';
  }

  // -------------------- Account Menu Controls --------------------
  toggleAccountMenu(): void { this.showAccountMenu = !this.showAccountMenu; }
  openAccountMenu(): void { this.showAccountMenu = true; }
  closeAccountMenu(): void { this.showAccountMenu = false; }

  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent) {
    if (!this.host.nativeElement.contains(ev.target)) {
      this.showAccountMenu = false;
    }
  }

  // -------------------- Main Menu Controls --------------------
  toggleMenu(): void { this.menuOpen = !this.menuOpen; }

  // -------------------- Navigation --------------------
  reloadPage(): void { window.location.href = '/'; }

  goToChat(): void { this.router.navigate(['/chat']); }
  goToVoice(): void { 
    // Disabled - do nothing
    console.log('Voice feature is currently disabled');
  }
  goToFindword(): void { 
    // Disabled - do nothing
    console.log('Find Word feature is currently disabled');
  }
  goToDetails(title: string): void {
    this.router.navigate(['/details'], { queryParams: { topic: title } });
  }

  // -------------------- Card Action Handler --------------------
  handleCardAction(card: any): void {
    if (!card.disabled) {
      card.action();
    }
  }

  // --------------------User Guide Popup Controls --------------------
  openGuidePopup(title: string): void {
    this.selectedCardTitle = title;
    this.showGuidePopup = true;
  }

  closeGuidePopup(): void {
    this.showGuidePopup = false;
    this.selectedCardTitle = null;
  }

  // -------------------- Account Actions --------------------
  goToAccount(): void {
    this.router.navigate(['/home']);
    this.showAccountMenu = false;
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => {
        localStorage.removeItem('username');
        this.showAccountMenu = false;
        this.router.navigate(['/login']);
      },
      error: () => {
        localStorage.removeItem('username');
        this.showAccountMenu = false;
        this.router.navigate(['/login']);
      }
    });
  }

  // -------------------- privacy and terms and condition Popup Controls --------------------
  openPrivacyPopup(event: Event): void {
    event.preventDefault();
    this.showPrivacyPopup = true;
  }

  closePrivacyPopup(): void {
    this.showPrivacyPopup = false;
  }

  openTermsPopup(event: Event): void {
    event.preventDefault();
    this.showTermsPopup = true;
  }

  closeTermsPopup(): void {
    this.showTermsPopup = false;
  }

  openPronunciation(): void {
    const dialogRef = this.dialog.open(PronunciationComponent, {
      width: '90vw',
      maxWidth: '95vw',
      height: '85vh',
      disableClose: true
    });
  }

}
