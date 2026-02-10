import { Component, Inject, OnInit } from '@angular/core';
import { BrandService } from './shared/brand.service';
import { Title } from '@angular/platform-browser';
import { DOCUMENT } from '@angular/common';
import { AuthenticationService } from './core/services/authentication.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  constructor(
    private authService: AuthenticationService,
    public brandService: BrandService,
    private titleService: Title,
    @Inject(DOCUMENT) private document: Document
  ) { }
  title = 'Py-Learn';

  ngOnInit(): void {
    // Set dynamic title
    this.titleService.setTitle(this.brandService.name);

    // Set dynamic favicon
    const favicon: HTMLLinkElement | null = this.document.querySelector("link[rel*='icon']");
    if (favicon) {
      favicon.href = this.brandService.name === 'Py-Learn'
        ? 'assets/favicon.png'
        : 'assets/majema-favicon.png'; // Make sure this file exists for MJ-Learn
    }

    this.authService.checkSession().subscribe((status) => {
      if (status) {
        this.authService.startAutoRefresh();
      }
    });
  }
}
