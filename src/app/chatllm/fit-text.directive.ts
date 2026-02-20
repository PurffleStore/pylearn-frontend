import {
  AfterViewInit,
  Directive,
  ElementRef,
  HostListener,
  Input,
  NgZone,
  OnDestroy
} from '@angular/core';

@Directive({
  selector: '[fitText]'
})
export class FitTextDirective implements AfterViewInit, OnDestroy {

  // Max font size in vw (your requirement)
  @Input() fitTextMaxVw = 1.5;

  // Minimum font size in px (do not go below this)
  @Input() fitTextMinPx = 12;

  // Step size for shrinking (smaller = smoother, slower)
  @Input() fitTextStepPx = 1;

  private ro?: ResizeObserver;

  constructor(private el: ElementRef<HTMLElement>, private zone: NgZone) {}

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      // Run once
      this.fit();

      // Re-fit when element size changes
      this.ro = new ResizeObserver(() => this.fit());
      this.ro.observe(this.el.nativeElement);
    });
  }

  ngOnDestroy(): void {
    try { this.ro?.disconnect(); } catch {}
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.fit();
  }

  private fit(): void {
    const target = this.el.nativeElement;

    // If parent has max-height, we fit inside parent.
    // You can also place the directive on the parent directly.
    const container = target.parentElement as HTMLElement | null;
    if (!container) return;

    const maxHeight = this.getMaxHeightPx(container);
    if (!maxHeight || maxHeight <= 0) return;

    // Set starting font size = maxVw converted to px
    const startPx = this.vwToPx(this.fitTextMaxVw);
    let fontPx = Math.max(this.fitTextMinPx, startPx);

    // Apply start size
    target.style.fontSize = `${fontPx}px`;

    // If it already fits, stop
    if (!this.isOverflowing(container, maxHeight)) return;

    // Shrink until it fits or hits min
    while (fontPx > this.fitTextMinPx && this.isOverflowing(container, maxHeight)) {
      fontPx -= this.fitTextStepPx;
      target.style.fontSize = `${fontPx}px`;
    }
  }

  private isOverflowing(container: HTMLElement, maxHeight: number): boolean {
    // container scrollHeight > maxHeight means overflow
    return container.scrollHeight > maxHeight + 1;
  }

  private getMaxHeightPx(el: HTMLElement): number {
    const cs = window.getComputedStyle(el);
    const mh = cs.maxHeight;

    // If max-height is "none", nothing to fit into
    if (!mh || mh === 'none') return 0;

    // e.g. "280px"
    const px = parseFloat(mh);
    return Number.isFinite(px) ? px : 0;
  }

  private vwToPx(vw: number): number {
    return (window.innerWidth * vw) / 100;
  }
}