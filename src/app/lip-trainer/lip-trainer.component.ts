

import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, ViewChild } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';

interface PracticeItem {
  letter: string;       // 'A' or 'a'
  word: string;         // display word  e.g. 'Apple' / 'apple'
  phonetics: string;
  imgSrc: string;       // word animation video (left panel)
  audioSrc: string;
  videoSrc: string;     // main mouth video
}

// ─── Asset base paths ───────────────────────────────────────────────────────
const MAIN  = 'assets/lip-trainer/main/';   // real mouth videos
const ANIM  = 'assets/pronunciation/animvideo/';
const AUDIO = 'assets/pronunciation/audio/';

/**
 * Build one PracticeItem.
 * @param ltr      Display letter ('A' or 'a')
 * @param word     Word shown in the practice card (title-cased for uppercase, lower for lowercase)
 * @param ph       IPA phonetics
 * @param vid      Filename in MAIN/ for video
 * @param animFile Override for the left-panel animation mp4 (defaults to word+'.mp4')
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

/**
 * Lip Trainer component.
 *
 * Displays video demonstrations of mouth movements for each letter of the alphabet,
 * paired with audio pronunciation and animated word examples. Allows students to
 * adjust playback speed and practice phonics at their own pace.
 */
@Component({
  selector: 'app-lip-trainer',
  templateUrl: './lip-trainer.component.html',
  styleUrls: ['./lip-trainer.component.css']
})
export class LipTrainerComponent implements AfterViewInit, OnDestroy {

  @ViewChild('centerVideo') centerVideoRef?: ElementRef<HTMLVideoElement>;

  // ── Item list: 26 uppercase then 26 lowercase ────────────────────────────
  items: PracticeItem[] = [

    // ── Uppercase A – Z ─────────────────────────────────────────────────────
    // Uppercase A: Default = "Angel" (Long-A sound only)
    mkItem('A', 'Angel',     '/eɪndʒəl/',       'angel.mp4'),
    mkItem('B', 'Ball',      '/bɔːl/',         'ball.mp4'),
    mkItem('C', 'Cat',       '/kæt/',          'cat.mp4'),
    mkItem('D', 'Dog',       '/dɒɡ/',          'dog.mp4'),
    mkItem('E', 'Egg',       '/eɡ/',           'egg.mp4'),
    mkItem('F', 'Fish',      '/fɪʃ/',          'fish.mp4'),
    mkItem('G', 'Grapes',    '/ɡreɪps/',       'grapes.mp4'),
    mkItem('H', 'Hat',       '/hæt/',          'hat.mp4'),
    mkItem('I', 'Ice cream', '/ˈaɪs ˌkriːm/', 'ice-cream.mp4', 'icecream'),
    mkItem('J', 'Jar',       '/dʒɑːr/',        'jar.mp4'),
    mkItem('K', 'Kite',      '/kaɪt/',         'kite.mp4'),
    mkItem('L', 'Lion',      '/ˈlaɪən/',       'lion.mp4'),
    mkItem('M', 'Moon',      '/muːn/',         'moon.mp4'),
    mkItem('N', 'Nest',      '/nest/',         'nest.mp4'),
    mkItem('O', 'Orange',    '/ˈɒrɪndʒ/',      'orange.mp4'),
    mkItem('P', 'Pig',       '/pɪɡ/',          'pig.mp4'),
    mkItem('Q', 'Queen',     '/kwiːn/',        'queen.mp4'),
    mkItem('R', 'Rabbit',    '/ˈræbɪt/',       'rabbit.mp4'),
    mkItem('S', 'Sun',       '/sʌn/',          'sun.mp4'),
    mkItem('T', 'Tree',      '/triː/',         'tree.mp4'),
    mkItem('U', 'Umbrella',  '/ʌmˈbrelə/',     'umbrella.mp4'),
    mkItem('V', 'Van',       '/væn/',          'van.mp4'),
    mkItem('W', 'Watch',     '/wɒtʃ/',         'watch.mp4'),
    mkItem('X', 'Xylophone', '/ˈzaɪləfəʊn/',  'xylophone.mp4'),
    mkItem('Y', 'Yarn',      '/jɑːn/',         'yarn.mp4'),
    mkItem('Z', 'Zebra',     '/ˈzebrə/',       'zebra.mp4'),

    // ── Lowercase a – z ─────────────────────────────────────────────────────
    // Lowercase a: Default = "apple" (Short-A sound only)
    mkItem('a', 'apple',     '/ˈæpəl/',         'apple.mp4'),
    mkItem('b', 'ball',      '/bɔːl/',         'ball.mp4'),
    mkItem('c', 'cat',       '/kæt/',          'cat.mp4'),
    mkItem('d', 'dog',       '/dɒɡ/',          'dog.mp4'),
    mkItem('e', 'egg',       '/eɡ/',           'egg.mp4'),
    mkItem('f', 'fish',      '/fɪʃ/',          'fish.mp4'),
    mkItem('g', 'grapes',    '/ɡreɪps/',       'grapes.mp4'),
    mkItem('h', 'hat',       '/hæt/',          'hat.mp4'),
    mkItem('i', 'ice cream', '/ˈaɪs ˌkriːm/', 'ice-cream.mp4', 'icecream'),
    mkItem('j', 'jar',       '/dʒɑːr/',        'jar.mp4'),
    mkItem('k', 'kite',      '/kaɪt/',         'kite.mp4'),
    mkItem('l', 'lion',      '/ˈlaɪən/',       'lion.mp4'),
    mkItem('m', 'moon',      '/muːn/',         'moon.mp4'),
    mkItem('n', 'nest',      '/nest/',         'nest.mp4'),
    mkItem('o', 'orange',    '/ˈɒrɪndʒ/',      'orange.mp4'),
    mkItem('p', 'pig',       '/pɪɡ/',          'pig.mp4'),
    mkItem('q', 'queen',     '/kwiːn/',        'queen.mp4'),
    mkItem('r', 'rabbit',    '/ˈræbɪt/',       'rabbit.mp4'),
    mkItem('s', 'sun',       '/sʌn/',          'sun.mp4'),
    mkItem('t', 'tree',      '/triː/',         'tree.mp4'),
    mkItem('u', 'umbrella',  '/ʌmˈbrelə/',     'umbrella.mp4'),
    mkItem('v', 'van',       '/væn/',          'van.mp4'),
    mkItem('w', 'watch',     '/wɒtʃ/',         'watch.mp4'),
    mkItem('x', 'xylophone', '/ˈzaɪləfəʊn/',  'xylophone.mp4'),
    mkItem('y', 'yarn',      '/jɑːn/',         'yarn.mp4'),
    mkItem('z', 'zebra',     '/ˈzebrə/',       'zebra.mp4'),
  ];

  // ── State ────────────────────────────────────────────────────────────────
  index = 0;

  isVideoPlaying = false;
  isVideoPaused  = false;

  /**
   * For Uppercase A: 'long-a' = angel.mp4
   * For Lowercase a: 'short-a' = apple.mp4
   * For other letters: 'sound' = any non-A letter
   * null = idle / stopped
   */
  playingPhase: 'short-a' | 'long-a' | 'sound' | null = null;

  // Speed — only normal (1×) remains
  speedOptions: number[] = [1];
  playbackSpeed = 1;
  playIconUrl   = 'assets/pronunciation/play.png';
  pauseIconUrl  = 'assets/pronunciation/pause.png';

  // ── Helpers ──────────────────────────────────────────────────────────────
  get current(): PracticeItem { return this.items[this.index]; }
  get isUppercaseGroup(): boolean { return this.index < 26; }
  get isLetterA(): boolean {
    const l = this.current.letter;
    return l === 'A' || l === 'a';
  }
  get playIcon(): string {
    return (this.isVideoPlaying && !this.isVideoPaused) ? this.pauseIconUrl : this.playIconUrl;
  }

  // Helper to determine if current A is uppercase or lowercase
  get isUpperCaseA(): boolean {
    return this.current.letter === 'A';
  }

  // Check if current letter is a vowel (A, E, I, O, U) - case insensitive
  get isCurrentVowel(): boolean {
    return this.isVowel(this.current.letter);
  }

  isVowel(letter: string): boolean {
    return ['A','E','I','O','U','a','e','i','o','u'].includes(letter ?? '');
  }
  
  isUppercase(letter: string): boolean {
    return letter === letter.toUpperCase() && letter !== letter.toLowerCase();
  }

  // ── Constructor ──────────────────────────────────────────────────────────
  constructor(public dialogRef: MatDialogRef<LipTrainerComponent>) {}

  ngAfterViewInit(): void {
    this.loadIdleFrame();
  }

  ngOnDestroy(): void { this.hardStop(); }

  // ── Core video helper ────────────────────────────────────────────────────
  private playSrc(src: string, onReady: (v: HTMLVideoElement) => void): void {
    const v = this.centerVideoRef?.nativeElement;
    if (!v) return;

    // Cancel any previous pending callback first
    v.onloadeddata = null;
    v.src = src;

    // IMPORTANT: attach the handler BEFORE v.load() so that fast-loading
    // or already-cached videos (e.g. ball.mp4, cat.mp4) don't fire
    // loadeddata before the listener is registered.
    v.onloadeddata = () => {
      v.onloadeddata = null;
      onReady(v);
    };

    v.load();
  }

  // ── Idle frame (default state) ───────────────────────────────────────────
  private loadIdleFrame(): void {
    this.playSrc(this.current.videoSrc, v => {
      v.currentTime = 0.01;
      v.pause();
    });
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

    if (this.isLetterA) {
      // Set appropriate phase based on case
      if (this.isUpperCaseA) {
        this.playingPhase = 'long-a';  // Uppercase A: Long-A sound
      } else {
        this.playingPhase = 'short-a'; // Lowercase a: Short-A sound
      }
    } else {
      this.playingPhase = 'sound';
    }
    
    this.playSrc(this.current.videoSrc, v => {
      v.currentTime = 0;
      v.playbackRate = this.playbackSpeed;
      v.play().catch(_e => { /* Video autoplay blocked — user interaction required */ });
    });
  }

  pauseVideo(): void {
    this.centerVideoRef?.nativeElement?.pause();
    this.isVideoPaused = true;
  }

  resumeVideo(): void {
    const v = this.centerVideoRef?.nativeElement;
    if (v) { v.playbackRate = this.playbackSpeed; v.play().catch(_e => { /* Resume blocked */ }); }
    this.isVideoPaused = false;
  }

  onVideoEnded(): void {
    // Just stop playback, don't play any second sound
    this.isVideoPlaying = false;
    this.isVideoPaused  = false;
    this.playingPhase   = null;
    // Video stays on last frame
  }

  private hardStop(): void {
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
    try { new Audio(src).play().catch(() => {}); } catch { /* Audio playback not supported */ }
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
    // Only allow toggle for vowel letters (A, E, I, O, U)
    if (!this.isCurrentVowel) return;
    
    if (this.isUppercaseGroup) {
      this.goTo(this.index + 26);
    } else {
      this.goTo(this.index - 26);
    }
  }

  // ── Keyboard ─────────────────────────────────────────────────────────────
  @HostListener('document:keydown', ['$event'])
  handleKeydown(e: KeyboardEvent): void {
    const tag = ((e.target as HTMLElement)?.tagName ?? '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;

    switch (e.key) {
      case ' ':
      case 'Spacebar':  this.onPlayClick();            e.preventDefault(); break;
      case 'ArrowRight': this.next();                  e.preventDefault(); break;
      case 'ArrowLeft':  this.prev();                  e.preventDefault(); break;
    }
  }

  // ── Dialog ───────────────────────────────────────────────────────────────
  closePopup(): void {
    this.hardStop();
    this.dialogRef.close();
  }
}