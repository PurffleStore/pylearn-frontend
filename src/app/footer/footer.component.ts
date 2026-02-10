import { Component } from '@angular/core';
import { BrandService } from '../shared/brand.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.css'],
  standalone: true,
  imports: [CommonModule]
})
export class FooterComponent {
  showPrivacyPopup = false;
  showTermsPopup = false;

  constructor(public brandService: BrandService) { }

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
