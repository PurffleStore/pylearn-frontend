import {
  AfterViewInit,
  Directive,
  ElementRef,
  HostListener,
  Input,
  NgZone,
  OnDestroy,
} from '@angular/core';

/**
 * [fitText] directive — shrinks font size so the text ALWAYS fits
 * inside the visible scroll-panel without clipping.
 *
 * HOW IT WORKS
 * ─────────────
 * The bubble no longer has a max-height, so we cannot use
 * "container.scrollHeight > max-height" as the overflow signal.
 *
 * Instead we walk UP the DOM to find the nearest ancestor that has a
 * definite clientHeight (the .pair panel, which is min-height:100% of
 * the .chat-messages scroll container).  That height is our ceiling.
 *
 * We measure:
 *   usedHeight = bubble.getBoundingClientRect().bottom
 *              - panel.getBoundingClientRect().top
 *
 * and shrink the font until usedHeight ≤ panelHeight - BOTTOM_PADDING,
 * or until we reach fitTextMinPx.
 *
 * USAGE in HTML:
 *   <span class="answer-text"
 *         [innerHTML]="pair.bot._safeHtml"
 *         fitText
 *         [fitTextMaxVw]="1.5"
 *         [fitTextMinPx]="11">
 *   </span>
 *
 * The directive is placed on the .answer-text span (the element whose
 * font-size is adjusted).  It automatically detects the .pair ancestor
 * as the available-height container.
 */
@Directive({ selector: '[fitText]' })
export class FitTextDirective implements AfterViewInit, OnDestroy {

  /** Starting / maximum font size expressed in vw units */
  @Input() fitTextMaxVw = 1.5;

  /** Hard minimum — never go below this many px */
  @Input() fitTextMinPx = 11;

  /** Shrink step in px  (smaller = smoother, more iterations) */
  @Input() fitTextStepPx = 0.5;

  /**
   * Pixels reserved at the bottom of the panel for chips, timestamp,
   * padding, etc.  Increase this if chips overlap the text.
   */
  @Input() fitTextBottomPad = 120;

  private ro?: ResizeObserver;
  private scheduled = false;

  constructor(
    private el: ElementRef<HTMLElement>,
    private zone: NgZone,
  ) { }

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      // Initial fit after first paint
      requestAnimationFrame(() => this.fit());

      // Re-fit whenever the element itself resizes (e.g. innerHTML swap)
      this.ro = new ResizeObserver(() => this.scheduleFit());
      this.ro.observe(this.el.nativeElement);
    });
  }

  ngOnDestroy(): void {
    try { this.ro?.disconnect(); } catch { }
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.scheduleFit();
  }

  /** Debounce multiple ResizeObserver callbacks in the same frame */
  private scheduleFit(): void {
    if (this.scheduled) return;
    this.scheduled = true;
    requestAnimationFrame(() => {
      this.scheduled = false;
      this.fit();
    });
  }

  private fit(): void {
    const target = this.el.nativeElement;

    // ── Step 1: find the scroll panel (.pair ancestor) ──────────────────
    const panel = this.findPanelAncestor(target);
    if (!panel) return;

    const panelRect = panel.getBoundingClientRect();
    const panelH = panelRect.height;          // visible height of the panel
    if (panelH <= 0) return;

    const ceiling = panelH - this.fitTextBottomPad;   // usable height for text

    // ── Step 2: reset to the maximum font size ───────────────────────────
    const maxPx = this.vwToPx(this.fitTextMaxVw);
    let fontPx = Math.max(this.fitTextMinPx, maxPx);
    target.style.fontSize = `${fontPx}px`;

    // ── Step 3: measure how much the bubble occupies in the panel ────────
    // We need the bottom of the bubble's bounding rect relative to the
    // panel's top.  If that exceeds 'ceiling', shrink and re-measure.
    const getBubbleUsedHeight = (): number => {
      const bubble = this.findBubbleAncestor(target);
      if (!bubble) return 0;
      const br = bubble.getBoundingClientRect();
      return br.bottom - panelRect.top;
    };

    // If already fits — done
    if (getBubbleUsedHeight() <= ceiling) return;

    // ── Step 4: shrink loop ───────────────────────────────────────────────
    while (fontPx > this.fitTextMinPx && getBubbleUsedHeight() > ceiling) {
      fontPx -= this.fitTextStepPx;
      target.style.fontSize = `${fontPx}px`;
    }
  }

  /**
   * Walk up the DOM to find the first ancestor whose className includes
   * 'pair'.  This is our scroll-panel height reference.
   */
  private findPanelAncestor(el: HTMLElement): HTMLElement | null {
    let cur: HTMLElement | null = el.parentElement;
    while (cur) {
      if (cur.classList.contains('pair')) return cur;
      cur = cur.parentElement;
    }
    return null;
  }

  /**
   * Walk up to find .bot-message (the bubble) — we measure its bottom
   * edge relative to the panel top.
   */
  private findBubbleAncestor(el: HTMLElement): HTMLElement | null {
    let cur: HTMLElement | null = el.parentElement;
    while (cur) {
      if (cur.classList.contains('bot-message')) return cur;
      cur = cur.parentElement;
    }
    return null;
  }

  private vwToPx(vw: number): number {
    return (window.innerWidth * vw) / 100;
  }
}
