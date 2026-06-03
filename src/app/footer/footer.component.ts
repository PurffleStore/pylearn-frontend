import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { BrandService } from '../shared/brand.service';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.css'],
  standalone: true,
  imports: [CommonModule, RouterModule]
})
export class FooterComponent {
  showPrivacyPopup = false;
  showTermsPopup = false;

  constructor(public brandService: BrandService, private router: Router) { }

  /**
   * Navigates to the Student Portal and opens the specified subject section.
   * @param section The section identifier: 'english' | 'maths' | 'science'
   */
  goToSubject(section: string): void {
    this.router.navigate(['/student-portal'], { queryParams: { section } });
  }

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
}
