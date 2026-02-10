import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { BrandService } from '../brand.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent {
  @Input() title: string | null = null;
  @Input() showHome: boolean = true;
  @Input() logoSrc?: string;    // optional override
  @Input() productName?: string; // optional override

  constructor(public brand: BrandService) {}
}
