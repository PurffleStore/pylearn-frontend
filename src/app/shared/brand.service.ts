import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

// Add type for brand names
export type BrandName = 'Py-Learn' | 'MJ-Learn';

@Injectable({ providedIn: 'root' })
export class BrandService {
  private nameSubject: BehaviorSubject<BrandName>;
  private logoSubject: BehaviorSubject<string>;

  readonly name$;
  readonly logo$;

  // Show/hide footer based on brand
  public showFooter: boolean = true;

  // Social links for each brand
  public socialLinks: Record<BrandName, {
    website: string;
    linkedin: string;
    youtube: string;
    facebook: string;
    instagram: string;
  }> = {
      'Py-Learn': {
        website: 'https://pykara.ai',
        linkedin: 'https://www.linkedin.com/in/pykara-technologies',
        youtube: 'https://www.youtube.com/@PykaraTechnologies',
        facebook: 'https://www.facebook.com/people/Pykara/100087653675803',
        instagram: 'https://www.instagram.com/pykaratechnologie'
      },
      'MJ-Learn': {
        website: 'https://www.majema.se',
        linkedin: 'https://www.linkedin.com/company/majemaforlaget',
        youtube: 'https://www.youtube.com/@majemaforlaget3014',
        facebook: 'https://www.facebook.com/majemaforlaget',
        instagram: 'https://www.instagram.com/majemaforlaget'
      }
    };

  constructor() {
    // Detect brand by URL and port
    const url = window.location.href;
    //const port = window.location.port;
    let brandName: BrandName = 'Py-Learn'; // default to Py-Learn for type safety
    let logoPath = 'assets/images/pykara-logo.png';

    if (url.includes('pykara-py-learn')) {
      brandName = 'Py-Learn';
      logoPath = 'assets/images/pykara-logo.png';
      this.showFooter = true;
    } else if (url.includes('majemaai-mj-learn')) {
      brandName = 'MJ-Learn';
      logoPath = 'assets/images/majema-logo.png';
      this.showFooter = true;
    }
    //else if (url.includes('localhost')) {
    //  if (port === '4200') {
    //    brandName = 'Py-Learn';
    //    logoPath = 'assets/images/pykara-logo.png';
    //    this.showFooter = true;
    //  } else if (port === '4300') {
    //    brandName = 'MJ-Learn';
    //    logoPath = 'assets/images/majema-logo.png';
    //    this.showFooter = true;
    //  }
    //}


    this.nameSubject = new BehaviorSubject<BrandName>(brandName);
    this.logoSubject = new BehaviorSubject<string>(logoPath);
    this.name$ = this.nameSubject.asObservable();
    this.logo$ = this.logoSubject.asObservable();
  }

  get name(): BrandName { return this.nameSubject.value; }
  get logo(): string { return this.logoSubject.value; }

  setName(name: BrandName) { this.nameSubject.next(name); }
  setLogo(path: string) { this.logoSubject.next(path); }

  get socialLinksCurrent() {
    // Use 'as BrandName' to ensure type safety
    return this.socialLinks[this.name as BrandName];
  }
}
