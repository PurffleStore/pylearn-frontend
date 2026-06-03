import {
  Component, ElementRef, Inject, OnDestroy, OnInit, ViewChild, ChangeDetectorRef
} from '@angular/core';
import { finalize, takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { PronunciationService, ScoreResponse, PhonemeDetail } from './pronunciation.service';
import { trigger, transition, style, animate } from '@angular/animations';

interface PracticeItem {
  letter: string;
  word: string;
  phonetics: string;
  imgSrc: string;
  audioSrc: string;
}

interface ImprovementTip {
  number: string;
  title: string;
  description: string;
}

@Component({
  selector: 'app-pronunciation',
  templateUrl: './pronunciation.component.html',
  styleUrls: ['./pronunciation.component.css'],
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('300ms ease-in', style({ opacity: 1 }))
      ]),
      transition(':leave', [
        animate('200ms ease-out', style({ opacity: 0 }))
      ])
    ]),
    trigger('slideUp', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(50px) scale(0.95)' }),
        animate('400ms cubic-bezier(0.34, 1.56, 0.64, 1)', 
          style({ opacity: 1, transform: 'translateY(0) scale(1)' }))
      ]),
      transition(':leave', [
        animate('300ms ease-in', 
          style({ opacity: 0, transform: 'translateY(30px) scale(0.98)' }))
      ])
    ])
  ]
})
export class PronunciationComponent implements OnInit, OnDestroy {
  @ViewChild('videoEl') videoElRef?: ElementRef<HTMLVideoElement>;

  // UI STATE
  showVideo = false;
  videoSrc = '';
  isPlayingVideo = false;
  playIconDataUrl = 'assets/pronunciation/play.png';
  pauseIconDataUrl = 'assets/pronunciation/pause.png';

  // DATA
  items: PracticeItem[] = [
    { letter: 'A', word: 'Apple', phonetics: '/ˈæpəl/', imgSrc: 'assets/pronunciation/animvideo/apple.mp4', audioSrc: 'assets/pronunciation/audio/apple.mp3' },
    { letter: 'B', word: 'Ball', phonetics: '/bɔːl/', imgSrc: 'assets/pronunciation/animvideo/ball.mp4', audioSrc: 'assets/pronunciation/audio/ball.mp3' },
    { letter: 'C', word: 'Cat', phonetics: '/kæt/', imgSrc: 'assets/pronunciation/animvideo/cat.mp4', audioSrc: 'assets/pronunciation/audio/cat.mp3' },
    { letter: 'D', word: 'Dog', phonetics: '/dɒɡ/', imgSrc: 'assets/pronunciation/animvideo/dog.mp4', audioSrc: 'assets/pronunciation/audio/dog.mp3' },
    { letter: 'E', word: 'Egg', phonetics: '/eɡ/', imgSrc: 'assets/pronunciation/animvideo/egg.mp4', audioSrc: 'assets/pronunciation/audio/egg.mp3' },
    { letter: 'F', word: 'Fish', phonetics: '/fɪʃ/', imgSrc: 'assets/pronunciation/animvideo/fish.mp4', audioSrc: 'assets/pronunciation/audio/fish.mp3' },
    { letter: 'G', word: 'Grapes', phonetics: '/ɡreɪps/', imgSrc: 'assets/pronunciation/animvideo/grapes.mp4', audioSrc: 'assets/pronunciation/audio/grapes.mp3' },
    { letter: 'H', word: 'Hat', phonetics: '/hæt/', imgSrc: 'assets/pronunciation/animvideo/hat.mp4', audioSrc: 'assets/pronunciation/audio/hat.mp3' },
    { letter: 'I', word: 'Ice cream', phonetics: '/ˈaɪs ˌkriːm/', imgSrc: 'assets/pronunciation/animvideo/icecream.mp4', audioSrc: 'assets/pronunciation/audio/icecream.mp3' },
    { letter: 'J', word: 'Jar', phonetics: '/dʒɑːr/', imgSrc: 'assets/pronunciation/animvideo/jar.mp4', audioSrc: 'assets/pronunciation/audio/jar.mp3' },
    { letter: 'K', word: 'Kite', phonetics: '/kaɪt/', imgSrc: 'assets/pronunciation/animvideo/kite.mp4', audioSrc: 'assets/pronunciation/audio/kite.mp3' },
    { letter: 'L', word: 'Lion', phonetics: '/ˈlaɪən/', imgSrc: 'assets/pronunciation/animvideo/lion.mp4', audioSrc: 'assets/pronunciation/audio/lion.mp3' },
    { letter: 'M', word: 'Moon', phonetics: '/muːn/', imgSrc: 'assets/pronunciation/animvideo/moon.mp4', audioSrc: 'assets/pronunciation/audio/moon.mp3' },
    { letter: 'N', word: 'Nest', phonetics: '/nest/', imgSrc: 'assets/pronunciation/animvideo/nest.mp4', audioSrc: 'assets/pronunciation/audio/nest.mp3' },
    { letter: 'O', word: 'Orange', phonetics: '/ˈɒrɪndʒ/', imgSrc: 'assets/pronunciation/animvideo/orange.mp4', audioSrc: 'assets/pronunciation/audio/orange.mp3' },
    { letter: 'P', word: 'Pig', phonetics: '/pɪɡ/', imgSrc: 'assets/pronunciation/animvideo/pig.mp4', audioSrc: 'assets/pronunciation/audio/pig.mp3' },
    { letter: 'Q', word: 'Queen', phonetics: '/kwiːn/', imgSrc: 'assets/pronunciation/animvideo/queen.mp4', audioSrc: 'assets/pronunciation/audio/queen.mp3' },
    { letter: 'R', word: 'Rabbit', phonetics: '/ˈræbɪt/', imgSrc: 'assets/pronunciation/animvideo/rabbit.mp4', audioSrc: 'assets/pronunciation/audio/rabbit.mp3' },
    { letter: 'S', word: 'Sun', phonetics: '/sʌn/', imgSrc: 'assets/pronunciation/animvideo/sun.mp4', audioSrc: 'assets/pronunciation/audio/sun.mp3' },
    { letter: 'T', word: 'Tree', phonetics: '/triː/', imgSrc: 'assets/pronunciation/animvideo/tree.mp4', audioSrc: 'assets/pronunciation/audio/tree.mp3' },
    { letter: 'U', word: 'Umbrella', phonetics: '/ʌmˈbrelə/', imgSrc: 'assets/pronunciation/animvideo/umbrella.mp4', audioSrc: 'assets/pronunciation/audio/umbrella.mp3' },
    { letter: 'V', word: 'Van', phonetics: '/væn/', imgSrc: 'assets/pronunciation/animvideo/van.mp4', audioSrc: 'assets/pronunciation/audio/van.mp3' },
    { letter: 'W', word: 'Watch', phonetics: '/wɒtʃ/', imgSrc: 'assets/pronunciation/animvideo/watch.mp4', audioSrc: 'assets/pronunciation/audio/watch.mp3' },
    { letter: 'X', word: 'Xylophone', phonetics: '/ˈzaɪləfəʊn/', imgSrc: 'assets/pronunciation/animvideo/xylophone.mp4', audioSrc: 'assets/pronunciation/audio/xylophone.mp3' },
    { letter: 'Y', word: 'Yarn', phonetics: '/jɑːn/', imgSrc: 'assets/pronunciation/animvideo/yarn.mp4', audioSrc: 'assets/pronunciation/audio/yarn.mp3' },
    { letter: 'Z', word: 'Zebra', phonetics: '/ˈzebrə/', imgSrc: 'assets/pronunciation/animvideo/zebra.mp4', audioSrc: 'assets/pronunciation/audio/zebra.mp3' }
  ];

  index = 0;
  get current(): PracticeItem { return this.items[this.index]; }

  // RECORDING
  isRecording = false;
  isScoring = false;
  isOscillating = false;

  private mediaStream?: MediaStream;
  private mediaRecorder?: MediaRecorder;
  private chunks: BlobPart[] = [];
  private currentMimeType = 'audio/webm';

  recordedAudioUrl: string | null = null;
  lastRecordedBlob: Blob | null = null;

  // SILENCE DETECTION
  private audioCtx?: AudioContext;
  private analyser?: AnalyserNode;
  private micSource?: MediaStreamAudioSourceNode;
  private silenceCheckId?: number;

  private lastSpeechAt = 0;
  private recordingStartedAt = 0;
  private hasSpoken = false;

  private readonly silenceMs = 1000;
  private readonly startSilenceMs = 3000;
  private readonly silenceThreshold = 0.01;

  // COUNTDOWN
  duration = 3;
  isCountingDown = false;
  timeLeft = this.duration;
  private preRecordIntervalId?: number;

  readonly radius = 38;
  readonly circumference = 2 * Math.PI * this.radius;
  strokeDashoffset = this.circumference;

  // RESULT
  showResult = false;
  score = 0;
  videoUrl = '';
  private lastVideoBlobUrl: string | null = null;
  shortfeedback: string = '';

  // ATTEMPT TRACKING (for near_miss, perfect_first_try, improvement detection)
  private attemptCounts: Record<string, number> = {};
  private lastScores: Record<string, number> = {};

  // FEATURE 2: PARENT DASHBOARD
  showDashboard = false;

  // FEATURE: STAR RATING
  starsAnimating = false;
  private starsTimer?: number;

  // FEATURE: CELEBRATION
  private celebrationTimer?: number;

  // FEATURE: BADGES
  newBadge: string | null = null;

  // PHONEME DETAILS (for colored word + table)
  phonemeDetails: PhonemeDetail[] = [];
  studentPhonemes: string[] = [];
  referencePhonemes: string[] = [];

  // PHONEME TIP (smart secondary tip from backend, shown below the video feedback text)
  phonemeTip: string = '';

  // SECOND CLIP TEXT (teaching sentence from the second video clip, if two clips were played)
  videoClipText2: string = '';

  // FEEDBACK MODAL
  showFeedbackModal = false;

  // CANCEL / RESET CONTROL
  private cancelScoring$ = new Subject<void>();
  private recordRunId = 0;

  // Lifecycle
  constructor(
    private api: PronunciationService,
    public dialogRef: MatDialogRef<PronunciationComponent>,
    @Inject(MAT_DIALOG_DATA) public data: unknown,
    private cdr: ChangeDetectorRef
  ) { }

  // Initialize component
  ngOnInit(): void {
    this.setupBestMimeType();
    this.resetResult();
  }

  // Cleanup on destroy
  ngOnDestroy(): void {
    this.cancelScoring$.next();
    this.cancelScoring$.complete();
    this.stopTracks();
    this.safeStopRecorder();
    this.teardownAudioGraph();
    if (this.starsTimer) clearTimeout(this.starsTimer);
    if (this.celebrationTimer) clearTimeout(this.celebrationTimer);
    if (this.lastVideoBlobUrl) {
      try { URL.revokeObjectURL(this.lastVideoBlobUrl); } catch { }
      this.lastVideoBlobUrl = null;
    }
    if (this.recordedAudioUrl) {
      try { URL.revokeObjectURL(this.recordedAudioUrl); } catch { }
      this.recordedAudioUrl = null;
    }
  }

  // ADD THIS METHOD - Play user's recorded pronunciation
  playUserRecording(): void {
    this.flashButton('.user-recording-btn');
    if (this.recordedAudioUrl) {
      try {
        const audio = new Audio(this.recordedAudioUrl);
        audio.currentTime = 0;
        audio.play().catch(_err => {
          this.shortfeedback = 'Unable to play recording. Please try again.';
          this.cdr.detectChanges();
        });
      } catch (_error) {
        // Audio object creation failed — browser may not support this format
      }
    } else if (this.lastRecordedBlob) {
      // Create URL from blob if not already created
      try {
        if (this.recordedAudioUrl) {
          URL.revokeObjectURL(this.recordedAudioUrl);
        }
        this.recordedAudioUrl = URL.createObjectURL(this.lastRecordedBlob);
        const audio = new Audio(this.recordedAudioUrl);
        audio.currentTime = 0;
        audio.play().catch(_err => { /* Playback blocked by browser autoplay policy */ });
      } catch (_error) {
        // Blob URL creation failed
      }
    } else {
      this.shortfeedback = 'No recording found. Please record your pronunciation first.';
      this.cdr.detectChanges();
    }
  }

  // Toggle feedback modal
  toggleFeedbackModal(): void {
    this.showFeedbackModal = !this.showFeedbackModal;
    try { this.cdr.detectChanges(); } catch { }
  }

  // Get score feedback message
  getScoreFeedback(): string {
    const score = this.score || 0;
    if (score >= 90) return 'Excellent! Perfect pronunciation! 🌟';
    if (score >= 80) return 'Great job! Very good pronunciation! 👏';
    if (score >= 70) return 'Good! Keep practicing! 👍';
    if (score >= 60) return 'Nice try! Practice more! 💪';
    if (score >= 50) return 'Getting better! Keep going! 🎯';
    return 'Keep practicing! You\'ll improve! 🚀';
  }

  // Get score CSS class
  getScoreClass(): string {
    const score = this.score || 0;
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'fair';
    return 'needs-work';
  }

  // Build colored letter segments from the target word and phoneme correctness
  getColoredWordLetters(): { text: string; correct: boolean }[] {
    const word = this.current.word.toLowerCase().replace(/\s+/g, '');
    const details = this.phonemeDetails;

    if (!details.length || !word) {
      return [{ text: word, correct: true }];
    }

    const n = word.length;
    const numPhonemes = details.length;
    const segments: { text: string; correct: boolean }[] = [];
    let letterIdx = 0;

    for (let i = 0; i < numPhonemes; i++) {
      const endIdx =
        i === numPhonemes - 1
          ? n
          : Math.round(((i + 1) * n) / numPhonemes);
      const text = word.slice(letterIdx, endIdx);
      const correct = details[i]?.correct ?? true;
      letterIdx = endIdx;

      if (!text) continue;

      // Merge adjacent segments with the same correctness
      if (segments.length > 0 && segments[segments.length - 1].correct === correct) {
        segments[segments.length - 1].text += text;
      } else {
        segments.push({ text, correct });
      }
    }

    // Any remaining letters (edge case)
    if (letterIdx < n) {
      const tail = word.slice(letterIdx);
      const last = segments[segments.length - 1];
      if (last && !last.correct) {
        last.text += tail;
      } else {
        segments.push({ text: tail, correct: false });
      }
    }

    return segments;
  }

  // Get improvement tips based on score
  getImprovementTips(): ImprovementTip[] {
    const score = this.score || 0;
    const tips: ImprovementTip[] = [];

    if (score < 100) {
      tips.push({
        number: '1',
        title: 'Listen Carefully',
        description: 'Pay attention to the audio pronunciation and repeat it slowly.'
      });
    }

    if (score < 85) {
      tips.push({
        number: '2',
        title: 'Mouth Position',
        description: 'Watch how the mouth moves in the video and copy the same position.'
      });
    }

    if (score < 75) {
      tips.push({
        number: '3',
        title: 'Slow Practice',
        description: 'Practice saying the word slowly first, then gradually speed up.'
      });
    }

    if (score < 65) {
      tips.push({
        number: '4',
        title: 'Record & Compare',
        description: 'Record yourself and compare it with the sample audio multiple times.'
      });
    }

    if (tips.length === 0) {
      tips.push({
        number: '✓',
        title: 'Perfect!',
        description: 'You nailed it! Ready for the next word?'
      });
    }

    return tips;
  }

  // ══════════════════════════════════════════════
  // ⭐ STAR RATING
  // ══════════════════════════════════════════════
  get starCount(): number {
    if (this.score >= 95) return 5;
    if (this.score >= 85) return 4;
    if (this.score >= 70) return 3;
    if (this.score >= 50) return 2;
    if (this.score > 0)   return 1;
    return 0;
  }

  private triggerStars(): void {
    if (this.score <= 85) return;
    this.starsAnimating = true;
    try { this.cdr.detectChanges(); } catch { }
    if (this.starsTimer) clearTimeout(this.starsTimer);
    this.starsTimer = window.setTimeout(() => {
      this.starsAnimating = false;
      try { this.cdr.detectChanges(); } catch { }
    }, 1800);
  }

  // ══════════════════════════════════════════════
  // 🎉 CELEBRATION ANIMATION
  // ══════════════════════════════════════════════
  private triggerCelebration(score: number): void {
    if (score < 50) return; // 5-star scale: confetti from 2 stars (50%) upward

    const isEpic  = score >= 85;
    const count   = isEpic ? 110 : 55;
    const epicColors = ['#FFD700','#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#FFEAA7','#DDA0DD','#98FF98','#FF9FF3','#FFB347'];
    const goodColors = ['#3aaea8','#f07b48','#FFD700','#a8d5b5','#80CBC4','#B2EBF2'];
    const colors  = isEpic ? epicColors : goodColors;
    const shapes  = ['50%', '0%', '2px 10px', '10px 2px', '50% 0%', '0% 50%'];

    // Inject keyframes once
    if (!document.getElementById('cc-kf')) {
      const s = document.createElement('style');
      s.id = 'cc-kf';
      s.textContent = `
        @keyframes ccFall {
          0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
          80%  { opacity: 0.85; }
          100% { transform: translateY(112vh) rotate(var(--r,360deg)); opacity: 0; }
        }
        @keyframes ccBurst {
          0%   { transform: translate(-50%,-55%) scale(0) rotate(-15deg); opacity: 0; }
          45%  { transform: translate(-50%,-55%) scale(1.6) rotate(8deg);  opacity: 1; }
          75%  { transform: translate(-50%,-55%) scale(1.2) rotate(-3deg); opacity: 1; }
          100% { transform: translate(-50%,-55%) scale(0.9) rotate(0);    opacity: 0; }
        }
        @keyframes ccEncourage {
          0%   { transform: translate(-50%,-55%) scale(0); opacity: 0; }
          50%  { transform: translate(-50%,-55%) scale(1.2); opacity: 1; }
          100% { transform: translate(-50%,-55%) scale(1);   opacity: 0; }
        }`;
      document.head.appendChild(s);
    }

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden;';
    document.body.appendChild(overlay);

    // Centre emoji burst
    const burst = document.createElement('div');
    if (isEpic) {
      burst.textContent = '⭐⭐⭐';
      burst.style.cssText = `position:absolute;top:50%;left:50%;
        font-size:clamp(48px,7vw,90px);white-space:nowrap;
        animation:ccBurst 1.4s ease-out forwards;pointer-events:none;`;
    } else {
      burst.textContent = '👍';
      burst.style.cssText = `position:absolute;top:50%;left:50%;
        font-size:clamp(60px,8vw,100px);
        animation:ccEncourage 1s ease-out forwards;pointer-events:none;`;
    }
    overlay.appendChild(burst);

    // Confetti pieces
    for (let i = 0; i < count; i++) {
      const el    = document.createElement('div');
      const color = colors[i % colors.length];
      const size  = 6 + Math.random() * 13;
      const left  = Math.random() * 100;
      const delay = Math.random() * 2;
      const dur   = 2.8 + Math.random() * 2;
      const rot   = Math.round(Math.random() * 720 - 360);
      const shape = shapes[Math.floor(Math.random() * shapes.length)];
      el.style.cssText =
        `position:absolute;width:${size}px;height:${size}px;background:${color};` +
        `left:${left}%;top:-${size + 10}px;border-radius:${shape};` +
        `animation:ccFall ${dur}s ease-in ${delay}s forwards;`;
      el.style.setProperty('--r', `${rot}deg`);
      overlay.appendChild(el);
    }

    const ttl = isEpic ? 5500 : 4000;
    if (this.celebrationTimer) clearTimeout(this.celebrationTimer);
    this.celebrationTimer = window.setTimeout(() => {
      if (document.body.contains(overlay)) document.body.removeChild(overlay);
    }, ttl);
  }

  // ══════════════════════════════════════════════
  // FEATURE 2: PARENT DASHBOARD
  // ══════════════════════════════════════════════
  get dashboardStats(): Array<{
    item: PracticeItem;
    bestScore: number;
    lastScore: number;
    attempts: number;
    level: string;
    color: string;
    emoji: string;
    hasBadge: boolean;
  }> {
    return this.items.map(item => {
      const wk = item.word.toLowerCase().replace(/\s+/g, '_');
      const raw = localStorage.getItem(`pp_${wk}`);
      const stored = raw ? JSON.parse(raw) : null;
      const bestScore: number = stored?.bestScore ?? 0;
      const lastScore: number = stored?.lastScore ?? 0;
      const attempts: number = stored?.attempts ?? 0;
      const hasBadge = localStorage.getItem(`pp_badge_${wk}`) === '1';

      let level = 'Not tried';
      let color = '#bdbdbd';
      let emoji = '⬜';

      if (attempts > 0) {
        if (bestScore >= 85) { level = 'Mastered!'; color = '#43a047'; emoji = '🏆'; }
        else if (bestScore >= 60) { level = 'Improving'; color = '#f5a623'; emoji = '📈'; }
        else { level = 'Needs Practice'; color = '#ef5350'; emoji = '💪'; }
      }

      return { item, bestScore, lastScore, attempts, level, color, emoji, hasBadge };
    });
  }

  get earnedBadges(): Array<{ word: string; letter: string }> {
    return this.items
      .filter(item => {
        const k = `pp_badge_${item.word.toLowerCase().replace(/\s+/g, '_')}`;
        return localStorage.getItem(k) === '1';
      })
      .map(item => ({ word: item.word, letter: item.letter }));
  }

  private saveWordStat(word: string, score: number): void {
    try {
      const key = `pp_${word.toLowerCase().replace(/\s+/g, '_')}`;
      const raw = localStorage.getItem(key);
      const stored = raw ? JSON.parse(raw) : { bestScore: 0, lastScore: 0, attempts: 0 };
      stored.attempts = (stored.attempts || 0) + 1;
      stored.lastScore = score;
      stored.bestScore = Math.max(stored.bestScore || 0, score);
      localStorage.setItem(key, JSON.stringify(stored));
    } catch { }
  }

  // ══════════════════════════════════════════════
  // 🏅 WORD MASTERY BADGE
  // ══════════════════════════════════════════════
  private checkBadge(word: string, score: number): void {
    try {
      const wk       = word.toLowerCase().replace(/\s+/g, '_');
      const badgeKey = `pp_badge_${wk}`;
      if (localStorage.getItem(badgeKey) === '1') return; // already earned

      const consecKey = `pp_consec_${wk}`;
      const consec    = parseInt(localStorage.getItem(consecKey) || '0', 10);

      if (score >= 80) {
        const next = consec + 1;
        localStorage.setItem(consecKey, String(next));
        if (next >= 2) {
          localStorage.setItem(badgeKey, '1');
          this.newBadge = word;
          try { this.cdr.detectChanges(); } catch { }
          setTimeout(() => {
            this.newBadge = null;
            try { this.cdr.detectChanges(); } catch { }
          }, 4500);
        }
      } else {
        localStorage.setItem(consecKey, '0'); // reset streak
      }
    } catch { }
  }

  // Toggle recording state
  async toggleRecording(): Promise<void> {
    // Prime audio playback on EVERY user click. This is what unlocks the
    // feedback video's audio later — once the page has played any audio
    // inside a user gesture, the browser allows unmuted media playback
    // for the rest of the session, even after the gesture token expires.
    // Without this, the unmuted feedback video silently fails to autoplay
    // for any backend response that takes more than ~5 seconds, which is
    // why previously only the fast score=0 path had sound.
    this.primeAudioPlayback();

    if (this.isRecording) {
      this.stopRecording(false);
      return;
    }
    // Stop any playing video before recording starts
    this.resetVideoPlayerState();
    this.startPreRecordCountdown();
  }

  // Tracks whether we've already played audio inside a user gesture this
  // session. Once true, the browser permits unmuted autoplay for media.
  private audioPrimed = false;

  /** Play a near-silent clip inside a user gesture so the browser grants
   *  unmuted media playback permission for the rest of the session. */
  private primeAudioPlayback(): void {
    if (this.audioPrimed) return;
    try {
      // Tiny silent WAV (44-byte header + a few zero samples).
      const silent =
        'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
      const a = new Audio(silent);
      a.volume = 0.0;
      const p = a.play();
      if (p && typeof p.then === 'function') {
        p.then(() => {
          this.audioPrimed = true;
          try { a.pause(); } catch { }
        }).catch(() => { /* ignore — gesture may not be active */ });
      } else {
        this.audioPrimed = true;
      }
    } catch { /* ignore */ }
  }

  // Start pre-record countdown
  private startPreRecordCountdown(): void {
    this.score = 0;
    this.shortfeedback = '';
    this.videoClipText2 = '';
    if (this.isCountingDown || this.isRecording) return;

    this.cancelScoring$.next();
    this.isScoring = false;
    this.isOscillating = false;

    this.isCountingDown = true;
    this.timeLeft = this.duration;

    const totalMs = this.duration * 1000;
    const start = performance.now();
    this.strokeDashoffset = this.circumference;

    this.preRecordIntervalId = window.setInterval(() => {
      const elapsed = performance.now() - start;
      const progress = Math.min(1, elapsed / totalMs);
      this.strokeDashoffset = this.circumference * (1 - progress);
      this.timeLeft = Math.ceil((totalMs - elapsed) / 1000);

      if (elapsed >= totalMs) {
        if (this.preRecordIntervalId) {
          try { clearInterval(this.preRecordIntervalId); } catch { }
          this.preRecordIntervalId = undefined;
        }
        this.startRecordingInternal();
      }
      try { this.cdr.detectChanges(); } catch { }
    }, 100);
  }

  // Start recording
  private async startRecordingInternal(): Promise<void> {
    this.isCountingDown = false;
    // Set isRecording = true HERE (before await) so the play/mic buttons stay
    // disabled during the getUserMedia permission prompt. Without this, there
    // is a window between countdown ending and recording actually starting
    // where buttons are briefly re-enabled and can be clicked unexpectedly.
    this.isRecording = true;
    const myRunId = ++this.recordRunId;
    try { this.cdr.detectChanges(); } catch { }

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      // Mic permission denied or unavailable — reset state cleanly
      this.isRecording = false;
      try { this.cdr.detectChanges(); } catch { }
      return;
    }

    this.mediaRecorder = new MediaRecorder(this.mediaStream, { mimeType: this.currentMimeType });
    this.chunks = [];

    this.mediaRecorder.ondataavailable = e => e.data.size && this.chunks.push(e.data);
    this.mediaRecorder.onstop = () => { if (myRunId === this.recordRunId) this.onRecordingStopped(myRunId); };

    this.setupSilenceDetection(this.mediaStream);
    this.mediaRecorder.start();
    try { this.cdr.detectChanges(); } catch { }
  }

  // Stop recording
  stopRecording(_isAutoStop: boolean = false): void {
    if (!this.isRecording) return;
    if (this.preRecordIntervalId) {
      try { clearInterval(this.preRecordIntervalId); } catch { }
      this.preRecordIntervalId = undefined;
    }
    this.isCountingDown = false;
    this.isRecording = false;
    this.safeStopRecorder();
    this.stopTracks();
    this.teardownAudioGraph();
    try { this.cdr.detectChanges(); } catch { }
  }

  // Safely stop media recorder
  private safeStopRecorder(): void {
    try {
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }
    } catch { }
  }

  // Handle recording stopped
  private onRecordingStopped(runId: number): void {
    if (runId !== this.recordRunId) return;
    const blob = new Blob(this.chunks, { type: this.currentMimeType });
    this.chunks = [];

    if (!blob || blob.size < 2000) {
      this.isOscillating = false;
      this.isScoring = false;
      this.shortfeedback = 'No voice detected. Please try again.';
      this.showResult = true;
      try { this.cdr.detectChanges(); } catch { }
      return;
    }

    this.lastRecordedBlob = blob;
    
    // Create URL for playback
    if (this.recordedAudioUrl) {
      try { URL.revokeObjectURL(this.recordedAudioUrl); } catch { }
    }
    this.recordedAudioUrl = URL.createObjectURL(blob);

    // Needle oscillates while the backend is scoring. It stops the moment
    // the score response arrives, so the score appears at the same instant
    // the wobble ends.
    this.isOscillating = true;
    try { this.cdr.detectChanges(); } catch { }

    this.sendForScoring(blob, this.current.word, runId);
  }

  // Setup silence detection
  private setupSilenceDetection(stream: MediaStream): void {
    this.teardownAudioGraph();

    this.audioCtx = new AudioContext();
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 2048;

    this.micSource = this.audioCtx.createMediaStreamSource(stream);
    this.micSource.connect(this.analyser);

    this.recordingStartedAt = performance.now();
    this.lastSpeechAt = this.recordingStartedAt;
    this.hasSpoken = false;

    const loop = () => {
      if (!this.analyser || !this.isRecording) return;
      const data = new Float32Array(this.analyser.fftSize);
      this.analyser.getFloatTimeDomainData(data);
      let sumSq = 0;
      for (let i = 0; i < data.length; i++) sumSq += data[i] * data[i];
      const rms = Math.sqrt(sumSq / data.length);
      const now = performance.now();

      if (rms > this.silenceThreshold) {
        this.lastSpeechAt = now;
        this.hasSpoken = true;
      }

      if (!this.hasSpoken && (now - this.recordingStartedAt) > this.startSilenceMs) { this.stopRecording(true); return; }
      if (this.hasSpoken && (now - this.lastSpeechAt) > this.silenceMs) { this.stopRecording(true); return; }

      this.silenceCheckId = window.setTimeout(loop, 100);
    };
    loop();
  }

  // Teardown audio graph
  private teardownAudioGraph(): void {
    if (this.silenceCheckId) {
      try { clearTimeout(this.silenceCheckId); } catch { }
      this.silenceCheckId = undefined;
    }
    try { this.micSource?.disconnect(); } catch { }
    try { this.analyser?.disconnect(); } catch { }
    try { this.audioCtx?.close(); } catch { }
    this.micSource = undefined;
    this.analyser = undefined;
    this.audioCtx = undefined;
  }

  // Stop media tracks
  private stopTracks(): void {
    this.mediaStream?.getTracks().forEach(t => t.stop());
    this.mediaStream = undefined;
  }

  // Send to backend for scoring
  private sendForScoring(blob: Blob, word: string, runId: number): void {
    if (runId !== this.recordRunId) return;
    this.isScoring = true;

    const wordKey = word.toLowerCase();
    const attemptNumber = (this.attemptCounts[wordKey] || 0) + 1;
    const previousScore = this.lastScores[wordKey] ?? -1;
    this.attemptCounts[wordKey] = attemptNumber;

    this.api.scorePronunciation(blob, word, attemptNumber, previousScore)
      .pipe(
        takeUntil(this.cancelScoring$),
        finalize(() => {
          // Safety net for cancel/error paths. On the success path we already
          // toggled these flags inside the subscribe handler (see below) so the
          // score and the needle stop in the SAME render frame.
          this.isScoring = false;
          this.isOscillating = false;
          try { this.cdr.detectChanges(); } catch { }
        })
      )
      .subscribe({
        next: (res: ScoreResponse) => {
          if (runId !== this.recordRunId) return;

          // ── STEP 1: render the SCORE immediately ──────────────────────
          // Anything cheap goes here, then we flush the view so the user
          // sees the number and the settled needle at the same instant the
          // backend response arrives. The heavy base64→Blob decode for the
          // feedback video is deferred to STEP 2 so it doesn't block the
          // score paint (decoding a few-MB video can take 100-500ms on the
          // main thread and was the cause of the perceived UI delay).
          this.score = this.normalizeScore(res.score);
          this.shortfeedback = res.feedback;
          this.phonemeTip = (res as any).phoneme_tip || '';
          this.videoClipText2 = res.video_clip_text2 || '';
          this.showResult = true;
          this.isScoring = false;
          this.isOscillating = false;
          this.phonemeDetails = res.phoneme_details || [];
          this.studentPhonemes = res.student_phonemes || [];
          this.referencePhonemes = res.reference_phonemes || [];
          this.lastScores[word.toLowerCase()] = this.score;
          try { this.cdr.detectChanges(); } catch { }

          // ── STEP 2: side-effects and the heavy video decode ───────────
          // Deferred so the score paint above isn't blocked by either the
          // animations or the base64 decode below.
          setTimeout(() => {
            try { this.saveWordStat(word, this.score); } catch { }
            try { this.triggerStars(); } catch { }
            try { this.triggerCelebration(this.score); } catch { }
            try { this.checkBadge(word, this.score); } catch { }

            if (res.videoBlobBase64) {
              try {
                const bytes = Uint8Array.from(atob(res.videoBlobBase64 as string), c => c.charCodeAt(0));
                const videoBlob = new Blob([bytes], { type: 'video/mp4' });
                if (this.lastVideoBlobUrl) { try { URL.revokeObjectURL(this.lastVideoBlobUrl); } catch { } }
                this.videoUrl = URL.createObjectURL(videoBlob);
                this.lastVideoBlobUrl = this.videoUrl;
                this.tryPlayFeedbackVideo(this.videoUrl);
              } catch (e) {
                // Failed to decode videoBlobBase64 — video feedback will be skipped
              }
            }
            try { this.cdr.detectChanges(); } catch { }
          }, 0);
        },
        error: (err: unknown) => {
          if (runId !== this.recordRunId) return;
          let msg = 'Error while scoring. Please try again.';
          try {
            const body = (err as any)?.error;
            if (body?.error) msg = body.error;
            else if (body?.message) msg = body.message;
          } catch { }
          this.shortfeedback = msg;
          this.score = 0;
          this.showResult = true;
          try { this.cdr.detectChanges(); } catch { }
        }
      });
  }

  // Cancel everything before navigation/close
  private cancelAllRunningProcesses(): void {
    this.recordRunId++;
    this.cancelScoring$.next();
    this.isScoring = false;
    this.isOscillating = false;

    if (this.preRecordIntervalId) {
      try { clearInterval(this.preRecordIntervalId); } catch { }
      this.preRecordIntervalId = undefined;
    }
    this.isCountingDown = false;
    this.timeLeft = this.duration;
    this.strokeDashoffset = this.circumference;

    this.isRecording = false;
    this.safeStopRecorder();
    this.stopTracks();
    this.teardownAudioGraph();
    this.chunks = [];

    this.resetVideoPlayerState();
    try { this.cdr.detectChanges(); } catch { }
  }

  // Reset video player state
  private resetVideoPlayerState(): void {
    try {
      const v = this.videoElRef?.nativeElement;
      if (v) {
        v.pause();
        v.currentTime = 0;
        v.removeAttribute('src');
        v.load();
      }
    } catch { }
    this.showVideo = false;
    this.videoSrc = '';
    this.isPlayingVideo = false;
  }

  // Normalize score 0..100
  private normalizeScore(n: unknown): number {
    const num = Number(n);
    return isNaN(num) ? 0 : Math.min(100, Math.max(0, Math.round(num)));
  }

  // Play feedback video
  private tryPlayFeedbackVideo(url: string): void {
    this.showVideo = true;
    this.videoSrc = url;
    // Force Angular to render #videoEl into the DOM before we try to access it
    try { this.cdr.detectChanges(); } catch { }
    setTimeout(() => {
      const v = this.videoElRef?.nativeElement;
      if (!v) return;

      // Audio was primed earlier inside toggleRecording (user gesture),
      // so the browser allows unmuted media playback here. Set state
      // BEFORE calling play() — flipping .muted after play() can cause
      // Chrome to pause the video, which previously made it look like
      // the video wasn't playing at all.
      v.muted = false;
      v.volume = 1.0;

      const playUnmuted = () => v.play();

      playUnmuted()
        .then(() => {
          this.isPlayingVideo = true;
          try { this.cdr.detectChanges(); } catch { }
        })
        .catch((err: unknown) => {
          // Last-ditch fallback: if the browser still blocks unmuted
          // playback (e.g. priming was rejected), play muted so the
          // user at least sees the video, then attempt one unmute.
          // Unmuted playback blocked by autoplay policy — retrying muted so video still displays
          v.muted = true;
          v.play()
            .then(() => {
              this.isPlayingVideo = true;
              // Try to unmute after a beat; if Chrome blocks it the
              // video keeps playing silently, which is still better
              // than no video.
              setTimeout(() => { try { v.muted = false; } catch { } }, 120);
              try { this.cdr.detectChanges(); } catch { }
            })
            .catch((_err2: unknown) => {
              // Feedback video playback failed even when muted — no video shown
              this.isPlayingVideo = false;
              try { this.cdr.detectChanges(); } catch { }
            });
        });
    }, 50);
  }

  // Choose best mime type
  private setupBestMimeType(): void {
    const preferredMimeTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/ogg'
    ];
    for (const t of preferredMimeTypes) {
      try {
        if (typeof MediaRecorder !== 'undefined'
          && typeof MediaRecorder.isTypeSupported === 'function'
          && MediaRecorder.isTypeSupported(t)) {
          this.currentMimeType = t;
          return;
        }
      } catch {
        // some browsers may throw on unsupported queries
      }
    }
  }

  // Reset current result
  private resetResult(): void {
    this.showResult = false;
    this.score = 0;
    this.showVideo = false;
    this.videoSrc = '';
    this.shortfeedback = '';
    this.showFeedbackModal = false;
    this.phonemeDetails = [];
    this.studentPhonemes = [];
    this.referencePhonemes = [];
    this.phonemeTip = '';
  }

  // Play sample audio for current word
  playWordAudio(): void {
    this.flashButton('.correct-pronunciation-btn');
    const src = this.current?.audioSrc || this.getAudioSrcFromWord(this.current.word);
    if (!src) return;
    try {
      const audio = new Audio(src);
      audio.currentTime = 0;
      audio.play().catch(() => { });
    } catch { }
  }

  // Resolve audio path by word
  private getAudioSrcFromWord(word: string): string {
    if (!word) return '';
    const fileName = word.trim().toLowerCase().replace(/\s+/g, '-');
    return `assets/pronunciation/audio/${fileName}.mp3`;
  }

  // Handle video ended
  onVideoEnded(): void {
    this.resetVideoPlayerState();
    this.isOscillating = false;
    try { this.cdr.detectChanges(); } catch { }
  }

  // Handle video play
  onVideoPlay(): void {
    this.isPlayingVideo = true;
    try { this.cdr.detectChanges(); } catch { }
  }

  // Handle video pause
  onVideoPause(): void {
    this.isPlayingVideo = false;
    try { this.cdr.detectChanges(); } catch { }
  }

  // Toggle play/pause for video
  toggleVideoPlay(): void {
    try {
      const v = this.videoElRef?.nativeElement;
      if (!this.showVideo) {
        this.videoSrc = this.getVideoSrcFromWord(this.current.word);
        this.showVideo = true;
        setTimeout(() => {
          const video = this.videoElRef?.nativeElement;
          if (!video) return;
          video.src = this.videoSrc;
          video.load();
          video.play()
            .then(() => { this.isPlayingVideo = true; try { this.cdr.detectChanges(); } catch { } })
            .catch(() => { this.isPlayingVideo = false; try { this.cdr.detectChanges(); } catch { } });
        }, 0);
        return;
      }
      if (!v) return;
      if (v.paused) {
        v.play()
          .then(() => { this.isPlayingVideo = true; try { this.cdr.detectChanges(); } catch { } })
          .catch(() => { this.isPlayingVideo = false; try { this.cdr.detectChanges(); } catch { } });
      } else {
        v.pause();
        this.isPlayingVideo = false;
        try { this.cdr.detectChanges(); } catch { }
      }
    } catch { }
  }

  // Resolve video path by word
  private getVideoSrcFromWord(word: string): string {
    if (!word) return '';
    const fileName = word.trim().toLowerCase().replace(/\s+/g, '-');
    return `assets/pronunciation/videos/${fileName}.mp4`;
  }

  // Gauge needle angle (-90..+90)
  get needleAngle(): number {
    const value = Math.max(0, Math.min(100, Number(this.score || 0)));
    return -90 + (value * 1.8);
  }

  // Go to previous item
  prev(): void {
    if (this.index <= 0) return;
    this.cancelAllRunningProcesses();
    this.index--;
    this.resetAfterNavigation();
  }
  private flashButton(selector: string): void {
    const btn = document.querySelector(selector) as HTMLElement;
    if (!btn) return;
    btn.classList.remove('btn-clicked');
    // Force reflow so removing+adding the class restarts the animation
    void btn.offsetWidth;
    btn.classList.add('btn-clicked');
    setTimeout(() => btn.classList.remove('btn-clicked'), 400);
  }
  // Go to next item
  next(): void {
    if (this.index >= this.items.length - 1) return;
    this.cancelAllRunningProcesses();
    this.index++;
    this.resetAfterNavigation();
  }

  // Reset state after navigation
  private resetAfterNavigation(): void {
    this.cancelAllRunningProcesses();
    this.score = 0;
    this.showResult = false;
    this.shortfeedback = '';
    this.lastRecordedBlob = null;
    this.showFeedbackModal = false;
    if (this.recordedAudioUrl) {
      try { URL.revokeObjectURL(this.recordedAudioUrl); } catch { }
      this.recordedAudioUrl = null;
    }
    try { this.cdr.detectChanges(); } catch { }
  }

  // Close popup
  closePopup(): void {
    this.cancelAllRunningProcesses();
    this.dialogRef.close();
  }
}