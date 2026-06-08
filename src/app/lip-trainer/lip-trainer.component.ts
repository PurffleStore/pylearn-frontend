

import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { LipTrainerService } from './services/lip-trainer.service';
import { VowelCard, ConsonantCard } from './models/letter.model';

interface PracticeItem {
  letter: string;       // e.g. 'A' or 'a'
  word: string;         // display word
  phonetics: string;
  imgSrc: string;       // kept for compatibility (word image not shown)
  audioSrc: string;
  videoSrc: string;     // main mouth video
  animSrc?: string;     // override path for left-panel animation video
}

// ─── Asset base paths ───────────────────────────────────────────────────────
const MAIN  = 'assets/lip-trainer/main/';
const ANIM  = 'assets/pronunciation/animvideo/';
const AUDIO = 'assets/pronunciation/audio/';

/**
 * Build one PracticeItem.
 * @param ltr      Display letter ('A', 'Å', 'a', 'ö', …)
 * @param word     Word shown in the practice card
 * @param ph       IPA phonetics
 * @param vid      Filename in MAIN/ for mouth video
 * @param animFile Override for animation mp4 slug (defaults to word)
 */
function mkItem(
  ltr: string, word: string, ph: string,
  vid: string, animFile?: string
): PracticeItem {
  const slug = (animFile ?? word).toLowerCase().replace(/\s+/g, '-');
  return {
    letter:   ltr,
    word,
    phonetics: ph,
    imgSrc:   ANIM  + slug + '.mp4',
    audioSrc: AUDIO + slug + '.mp3',
    videoSrc:  MAIN + vid,
  };
}

@Component({
  selector: 'app-lip-trainer',
  templateUrl: './lip-trainer.component.html',
  styleUrls: ['./lip-trainer.component.css']
})
export class LipTrainerComponent implements AfterViewInit, OnDestroy {

  @ViewChild('centerVideo') centerVideoRef?: ElementRef<HTMLVideoElement>;
  @ViewChild('animVideo')   animVideoRef?:  ElementRef<HTMLVideoElement>;
  @ViewChild('videoCanvas') canvasRef?:     ElementRef<HTMLCanvasElement>;
  private rafId: number | null = null;

  // ── Swedish alphabet: 29 uppercase then 29 lowercase ─────────────────────
  // Uppercase = LONG vowel sound  |  Lowercase = SHORT vowel sound
  items: PracticeItem[] = [

    // ── Uppercase A – Ö (long vowel sounds for vowels) ──────────────────────
    { ...mkItem('A', 'Arm', '/aːrm/', 'new_long_a.mp4'), animSrc: MAIN + 'letter-a-anim.mp4' },
    mkItem('B', 'Boll',    '/bɔlː/',          'boll.mp4'),
    mkItem('C', 'Citron',  '/sɪˈtruːn/',      'citron.mp4'),
    mkItem('D', 'Dag',     '/dɑːɡ/',          'dag.mp4'),
    mkItem('E', 'Elefant', '/ˌeːlɛˈfant/',    'elefant.mp4'),
    mkItem('F', 'Fisk',    '/fɪsk/',          'fisk.mp4'),
    mkItem('G', 'Gata',    '/ˈɡɑːta/',        'gata.mp4'),
    mkItem('H', 'Hus',     '/hʉːs/',          'hus.mp4'),
    mkItem('I', 'Is',      '/iːs/',           'is.mp4'),
    mkItem('J', 'Jul',     '/jʉːl/',          'jul.mp4'),
    mkItem('K', 'Ko',      '/kuː/',           'ko.mp4'),
    mkItem('L', 'Lamm',    '/lamː/',          'lamm.mp4'),
    mkItem('M', 'Mus',     '/mʉːs/',          'mus.mp4'),
    mkItem('N', 'Natt',    '/natː/',          'natt.mp4'),
    mkItem('O', 'Orm',     '/ɔrm/',           'orm.mp4'),
    mkItem('P', 'Pil',     '/piːl/',          'pil.mp4'),
    mkItem('Q', 'Quiz',    '/kvɪs/',          'quiz.mp4'),
    mkItem('R', 'Ros',     '/ruːs/',          'ros.mp4'),
    mkItem('S', 'Sol',     '/suːl/',          'sol.mp4'),
    mkItem('T', 'Tack',    '/takː/',          'tack.mp4'),
    mkItem('U', 'Uggla',   '/ˈʉːɡla/',        'uggla.mp4'),
    mkItem('V', 'Vår',     '/voːr/',          'var.mp4'),
    mkItem('W', 'Wok',     '/vɔk/',           'wok.mp4'),
    mkItem('X', 'Xylofon', '/ˌxyːlɔˈfuːn/',  'xylofon.mp4'),
    mkItem('Y', 'Yxa',     '/ˈyːksa/',        'yxa.mp4'),
    mkItem('Z', 'Zoo',     '/suː/',           'zoo.mp4'),
    mkItem('Å', 'Åt',      '/oːt/',           'at-long.mp4'),
    mkItem('Ä', 'Ägg',     '/ɛɡː/',           'agg.mp4'),
    mkItem('Ö', 'Öra',     '/ˈøːra/',         'ora.mp4'),

    // ── Lowercase a – ö (short vowel sounds for vowels) ─────────────────────
    mkItem('a', 'anka',    '/ˈaŋka/',         'short_a.mp4'),
    mkItem('b', 'boll',    '/bɔlː/',          'boll.mp4'),
    mkItem('c', 'citron',  '/sɪˈtruːn/',      'citron.mp4'),
    mkItem('d', 'dag',     '/dɑɡ/',           'dag.mp4'),
    mkItem('e', 'elva',    '/ˈɛlva/',         'elva.mp4'),
    mkItem('f', 'fisk',    '/fɪsk/',          'fisk.mp4'),
    mkItem('g', 'gata',    '/ˈɡata/',         'gata.mp4'),
    mkItem('h', 'hus',     '/hɵs/',           'hus.mp4'),
    mkItem('i', 'ill',     '/ɪlː/',           'ill.mp4'),
    mkItem('j', 'jul',     '/jɵl/',           'jul.mp4'),
    mkItem('k', 'katt',    '/katː/',          'katt.mp4'),
    mkItem('l', 'lamm',    '/lamː/',          'lamm.mp4'),
    mkItem('m', 'mus',     '/mɵs/',           'mus.mp4'),
    mkItem('n', 'natt',    '/natː/',          'natt.mp4'),
    mkItem('o', 'och',     '/ɔk/',            'och.mp4'),
    mkItem('p', 'pil',     '/pɪl/',           'pil.mp4'),
    mkItem('q', 'quiz',    '/kvɪs/',          'quiz.mp4'),
    mkItem('r', 'ros',     '/rɔs/',           'ros.mp4'),
    mkItem('s', 'sol',     '/sɔl/',           'sol.mp4'),
    mkItem('t', 'tack',    '/takː/',          'tack.mp4'),
    mkItem('u', 'under',   '/ˈɵndɛr/',        'under.mp4'),
    mkItem('v', 'vår',     '/vɔr/',           'var.mp4'),
    mkItem('w', 'wok',     '/vɔk/',           'wok.mp4'),
    mkItem('x', 'xylofon', '/ˌxylɔˈfuːn/',   'xylofon.mp4'),
    mkItem('y', 'yrke',    '/ˈʏrkɛ/',         'yrke.mp4'),
    mkItem('z', 'zoo',     '/suː/',           'zoo.mp4'),
    mkItem('å', 'åtta',    '/ˈɔtːa/',         'atta.mp4'),
    mkItem('ä', 'äpple',   '/ˈɛplɛ/',         'apple.mp4'),
    mkItem('ö', 'öppen',   '/ˈœpɛn/',         'oppen.mp4'),
  ];

  // ── State ────────────────────────────────────────────────────────────────
  index = 0;

  isVideoPlaying = false;
  isVideoPaused  = false;

  /**
   * 'long-vowel'  = uppercase vowel playing (long sound)
   * 'short-vowel' = lowercase vowel playing (short sound)
   * 'sound'       = consonant playing
   * null          = idle / stopped
   */
  playingPhase: 'short-vowel' | 'long-vowel' | 'sound' | null = null;

  speedOptions: number[] = [1];
  playbackSpeed = 1;
  playIconUrl   = 'assets/pronunciation/play.png';
  pauseIconUrl  = 'assets/pronunciation/pause.png';

  // ── Helpers ──────────────────────────────────────────────────────────────
  /** Total letters per case group (Swedish = 29) */
  get totalLetters(): number { return 29; }

  get current(): PracticeItem { return this.items[this.index]; }
  get isUppercaseGroup(): boolean { return this.index < this.totalLetters; }

  get playIcon(): string {
    return (this.isVideoPlaying && !this.isVideoPaused) ? this.pauseIconUrl : this.playIconUrl;
  }

  /** True when the current letter is a Swedish vowel (A E I O U Y Å Ä Ö) */
  get isCurrentVowel(): boolean {
    return this.isVowel(this.current.letter);
  }

  isVowel(letter: string): boolean {
    return ['A','E','I','O','U','Y','Å','Ä','Ö',
            'a','e','i','o','u','y','å','ä','ö'].includes(letter ?? '');
  }

  isUppercase(letter: string): boolean {
    return letter === letter.toUpperCase() && letter !== letter.toLowerCase();
  }

  // ── Alphabet grid data ────────────────────────────────────────────────────
  readonly vowelLetters     = ['A','E','I','O','U','Y','Å','Ä','Ö'];
  readonly consonantLetters = ['B','C','D','F','G','H','J','K','L','M','N','P','Q','R','S','T','V','W','X','Z'];

  isActiveAlpha(letter: string): boolean {
    return this.current.letter.toUpperCase() === letter;
  }

  goToLetter(letter: string): void {
    const target = this.isUppercaseGroup ? letter : letter.toLowerCase();
    const idx = this.items.findIndex(it => it.letter === target);
    if (idx >= 0) {
      this.goTo(idx);
      // Play word audio after brief delay for navigation to settle
      setTimeout(() => this.playWordAudio(), 300);
    }
  }

  // ── Constructor ──────────────────────────────────────────────────────────
  constructor(
    private router: Router,
    private lipCardSvc: LipTrainerService
  ) {}

  // ── Card getters (for left + right panel) ────────────────────────────────

  /** Returns the VowelCard matching the current letter and sound type (long/short). */
  get currentVowelCard(): VowelCard | null {
    if (!this.isCurrentVowel) return null;
    const soundType = this.isUppercaseGroup ? 'long' : 'short';
    return this.lipCardSvc.vowelCards.find(
      c => c.letter === this.current.letter.toUpperCase() && c.soundType === soundType
    ) ?? null;
  }

  /** Returns the ConsonantCard matching the current letter. */
  get currentConsonantCard(): ConsonantCard | null {
    if (this.isCurrentVowel) return null;
    return this.lipCardSvc.getConsonantCard(this.current.letter.toUpperCase()) ?? null;
  }

  ngAfterViewInit(): void {
    this.loadIdleFrame();
  }

  ngOnDestroy(): void { this.hardStop(); }

  // ── Core video helper ────────────────────────────────────────────────────
  private playSrc(src: string, onReady: (v: HTMLVideoElement) => void): void {
    const v = this.centerVideoRef?.nativeElement;
    if (!v) return;

    v.onloadeddata = null;
    v.src = src;

    v.onloadeddata = () => {
      v.onloadeddata = null;
      onReady(v);
    };

    v.load();
  }

  // ── Idle frame — seek to last frame, draw once on canvas ─────────────────
  private loadIdleFrame(): void {
    this.playSrc(this.current.videoSrc, v => {
      const seekToEnd = () => {
        v.onseeked = () => {
          v.onseeked = null;
          v.pause();
          this.drawFrameOnce();
        };
        v.currentTime = Number.MAX_SAFE_INTEGER; // browser clamps to duration
      };
      if (v.readyState >= 1) {
        seekToEnd();
      } else {
        v.onloadedmetadata = () => { v.onloadedmetadata = null; seekToEnd(); };
      }
    });
    this.loadAnimVideo();
  }

  // ── Canvas compositing — white fill then video frame ─────────────────────
  private drawFrameOnce(): void {
    const v      = this.centerVideoRef?.nativeElement;
    const canvas = this.canvasRef?.nativeElement;
    if (!v || !canvas) return;
    const w = v.videoWidth  || canvas.offsetWidth  || 600;
    const h = v.videoHeight || canvas.offsetHeight || 400;
    if (canvas.width !== w)  canvas.width  = w;
    if (canvas.height !== h) canvas.height = h;
    // alpha:false → opaque canvas; no transparent bleed-through
    const ctx = canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D | null;
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(v, 0, 0, w, h);
  }

  private startRenderLoop(): void {
    this.stopRenderLoop();
    const loop = () => {
      this.drawFrameOnce();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  private stopRenderLoop(): void {
    if (this.rafId !== null) { cancelAnimationFrame(this.rafId); this.rafId = null; }
  }

  // ── Anim video (left panel) ───────────────────────────────────────────────
  private loadAnimVideo(): void {
    const av = this.animVideoRef?.nativeElement;
    if (!av) return;
    const src = this.current.animSrc ?? this.current.imgSrc;
    if (!src) { av.src = ''; return; }
    av.src = src;
    av.load();
    av.play().catch(() => {});
  }

  // ── Playback controls ────────────────────────────────────────────────────
  onPlayClick(): void {
    if (this.isVideoPlaying) {
      this.isVideoPaused ? this.resumeVideo() : this.pauseVideo();
    } else {
      this.startVideo();
    }
  }

  startVideo(): void {
    this.isVideoPlaying = true;
    this.isVideoPaused  = false;

    if (this.isCurrentVowel) {
      // Uppercase = long vowel sound, Lowercase = short vowel sound
      this.playingPhase = this.isUppercaseGroup ? 'long-vowel' : 'short-vowel';
    } else {
      this.playingPhase = 'sound';
    }

    this.playSrc(this.current.videoSrc, v => {
      v.currentTime = 0;
      v.playbackRate = this.playbackSpeed;
      v.play().catch(e => console.warn('play error:', e));
      this.startRenderLoop();
    });
  }

  pauseVideo(): void {
    this.centerVideoRef?.nativeElement?.pause();
    this.stopRenderLoop();
    this.drawFrameOnce();
    this.isVideoPaused = true;
  }

  resumeVideo(): void {
    const v = this.centerVideoRef?.nativeElement;
    if (v) { v.playbackRate = this.playbackSpeed; v.play().catch(e => console.warn(e)); }
    this.isVideoPaused = false;
    this.startRenderLoop();
  }

  onVideoEnded(): void {
    this.stopRenderLoop();
    this.drawFrameOnce();
    this.isVideoPlaying = false;
    this.isVideoPaused  = false;
    this.playingPhase   = null;
  }

  private hardStop(): void {
    this.stopRenderLoop();
    const v = this.centerVideoRef?.nativeElement;
    if (v) { v.onloadeddata = null; v.pause(); }
    this.isVideoPlaying = false;
    this.isVideoPaused  = false;
    this.playingPhase   = null;
  }

  // ── Audio ────────────────────────────────────────────────────────────────
  playWordAudio(): void {
    if (this.isVideoPlaying) return;
    const src = this.current?.audioSrc;
    if (!src) return;
    try { new Audio(src).play().catch(() => {}); } catch { /* noop */ }
  }

  // ── Speed ────────────────────────────────────────────────────────────────
  changePlaybackSpeed(speed: number): void {
    this.playbackSpeed = speed;
    const v = this.centerVideoRef?.nativeElement;
    if (v) v.playbackRate = speed;
  }

  // ── Navigation ───────────────────────────────────────────────────────────
  goTo(i: number): void {
    if (i < 0 || i >= this.items.length || i === this.index) return;
    this.hardStop();
    this.index = i;
    setTimeout(() => this.loadIdleFrame(), 50);
  }

  prev(): void { this.goTo(this.index - 1); }
  next(): void { this.goTo(this.index + 1); }

  toggleCase(): void {
    // Only allow toggle for vowel letters
    if (!this.isCurrentVowel) return;

    if (this.isUppercaseGroup) {
      this.goTo(this.index + this.totalLetters);
    } else {
      this.goTo(this.index - this.totalLetters);
    }
  }

  // ── Keyboard ─────────────────────────────────────────────────────────────
  @HostListener('document:keydown', ['$event'])
  handleKeydown(e: KeyboardEvent): void {
    const tag = ((e.target as HTMLElement)?.tagName ?? '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;

    switch (e.key) {
      case ' ':
      case 'Spacebar':   this.onPlayClick(); e.preventDefault(); break;
      case 'ArrowRight': this.next();        e.preventDefault(); break;
      case 'ArrowLeft':  this.prev();        e.preventDefault(); break;
    }
  }

  // ── Navigation ───────────────────────────────────────────────────────────
  closePopup(): void {
    this.hardStop();
    this.router.navigate(['/home']);
  }
}
