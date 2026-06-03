import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { BrandService } from '../brand.service';

/**
 * Shared page header component.
 *
 * Renders the platform logo, optional page title, and a home navigation link.
 * Accepts optional input overrides so individual pages can customise the logo
 * or product name without forking the template.
 */
@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent {
  /** Optional page title displayed next to the logo. */
  @Input() title: string | null = null;
  /** Whether to show the home navigation link. Defaults to true. */
  @Input() showHome: boolean = true;
  /** Optional logo image path that overrides the brand default. */
  @Input() logoSrc?: string;
  /** Optional product name that overrides the brand default. */
  @Input() productName?: string;

  constructor(public brand: BrandService) {}
}
