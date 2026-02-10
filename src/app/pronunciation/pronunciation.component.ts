import {
  Component, ElementRef, Inject, OnDestroy, OnInit, ViewChild, ChangeDetectorRef
} from '@angular/core';
import { finalize, takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { PronunciationService, ScoreResponse } from './pronunciation.service';

interface PracticeItem {
  letter: string;
  word: string;
  phonetics: string;
  imgSrc: string;
  audioSrc: string;
}

@Component({
  selector: 'app-pronunciation',
  templateUrl: './pronunciation.component.html',
  styleUrls: ['./pronunciation.component.css']
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

  private readonly silenceMs = 3000;
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
    if (this.lastVideoBlobUrl) {
      try { URL.revokeObjectURL(this.lastVideoBlobUrl); } catch { }
      this.lastVideoBlobUrl = null;
    }
  }

  // Toggle recording state
  async toggleRecording(): Promise<void> {
    if (this.isRecording) {
      this.stopRecording(false);
      return;
    }
    this.startPreRecordCountdown();
  }

  // Start pre-record countdown
  private startPreRecordCountdown(): void {
    this.score = 0;
    this.shortfeedback = '';
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
    const myRunId = ++this.recordRunId;

    this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.mediaRecorder = new MediaRecorder(this.mediaStream, { mimeType: this.currentMimeType });
    this.chunks = [];

    this.mediaRecorder.ondataavailable = e => e.data.size && this.chunks.push(e.data);
    this.mediaRecorder.onstop = () => { if (myRunId === this.recordRunId) this.onRecordingStopped(myRunId); };

    this.isRecording = true;
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

    this.api.scorePronunciation(blob, word)
      .pipe(
        takeUntil(this.cancelScoring$),
        finalize(() => {
          this.isScoring = false;
          this.isOscillating = false;
          try { this.cdr.detectChanges(); } catch { }
        })
      )
      .subscribe((res: ScoreResponse) => {
        if (runId !== this.recordRunId) return;
        this.score = this.normalizeScore(res.score);
        this.shortfeedback = res.feedback;
        this.showResult = true;

        if (res.videoBlobBase64) {
          const bytes = Uint8Array.from(atob(res.videoBlobBase64), c => c.charCodeAt(0));
          const videoBlob = new Blob([bytes], { type: 'video/mp4' });
          if (this.lastVideoBlobUrl) { try { URL.revokeObjectURL(this.lastVideoBlobUrl); } catch { } }
          this.videoUrl = URL.createObjectURL(videoBlob);
          this.lastVideoBlobUrl = this.videoUrl;
          this.tryPlayFeedbackVideo(this.videoUrl);
        }
        try { this.cdr.detectChanges(); } catch { }
      }, (_err: unknown) => {
        if (runId !== this.recordRunId) return;
        this.shortfeedback = 'Error while scoring. Please try again.';
        this.showResult = true;
        try { this.cdr.detectChanges(); } catch { }
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
    setTimeout(() => {
      const v = this.videoElRef?.nativeElement;
      if (!v) return;
      v.src = url;
      v.load();
      v.play()
        .then(() => { this.isPlayingVideo = true; try { this.cdr.detectChanges(); } catch { } })
        .catch(() => { this.isPlayingVideo = false; try { this.cdr.detectChanges(); } catch { } });
    }, 0);
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
  }

  // Play sample audio for current word
  playWordAudio(): void {
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
