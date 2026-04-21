import {
  Component, OnInit, OnDestroy, ViewChild, ElementRef,
  AfterViewChecked, AfterViewInit, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ChatService, ChatResponse } from './chatllm.service';
import { Subscription } from 'rxjs';
import { Router } from '@angular/router';

interface Message {
  text: string;
  safeHtml?: SafeHtml;
  hasTimings: boolean;
  role: 'user' | 'bot';
  time: string;
  videoKey?: string;
}

interface Window {
  SpeechRecognition: any;
  webkitSpeechRecognition: any;
}

@Component({
  selector: 'app-chatllm',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chatllm.component.html',
  styleUrls: ['./chatllm.component.css']
})
export class ChatLLMComponent implements OnInit, AfterViewInit, OnDestroy, AfterViewChecked {
  @ViewChild('messagesScroll') private messagesScroll!: ElementRef;
  @ViewChild('tutorVideo') private tutorVideo!: ElementRef<HTMLVideoElement>;
  @ViewChild('inputField') private inputField!: ElementRef<HTMLInputElement>;

  messages: Message[] = [];
  suggestions: string[] = [];
  userInput = '';
  isTyping = false;
  inputFocused = false;
  showScrollUp = false;
  showScrollDown = false;

  // Overlay
  showOverlay = true;

  // Video state
  showPoster = false;
  isMuted = false;
  videoStatus = 'Click play to begin';
  introPlayed = false;
  currentVideoKey = 'blink';
  lastQuestionVideoKey = '';
  isActivePlaying = false;
  isVideoPaused = false;

  // Speech bubble
  showSpeechBubble = true;
  speechBubbleText = 'Hi! I am your English Tutor.';

  // Word highlight tracking
  currentHighlightMsgIndex = -1;

  private shouldScroll = false;
  private videoSub!: Subscription;
  private timeUpdateHandler: (() => void) | null = null;
  private introStartTimer: any = null;

  recognition: any = null;
  isListening = false;
  speechSupported = false;
  private videoQueue: string[] = [];
  private isPlayingQueue = false;

  constructor(
    private chatService: ChatService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private sanitizer: DomSanitizer
  ) { }

  ngOnInit(): void {
    this.chatService.resetSession();
    this.messages = [];
    this.suggestions = [];
    this.userInput = '';
    this.isTyping = false;

    this.chatService.loadVideoMap().subscribe({
      error: () => console.warn('Could not load video map')
    });

    this.videoSub = this.chatService.video$.subscribe(key => {
      if (key && key !== this.currentVideoKey) {
        this.currentVideoKey = key;
        this.playVideoByKey(key);
      }
    });
    this.initSpeechRecognition();
  }

  ngAfterViewInit(): void {
    // Do not auto play here.
    // Wait until user clicks Start Lesson.
  }

  ngOnDestroy(): void {
    if (this.videoSub) this.videoSub.unsubscribe();
    if (this.recognition && this.isListening) this.recognition.stop();
    this.removeTimeUpdateListener();

    if (this.introStartTimer) {
      clearTimeout(this.introStartTimer);
    }
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  // ─── OVERLAY: Start Lesson ───────────────────────────────────────────────

  onStartLesson(): void {
    this.showOverlay = false;
    this.introPlayed = true;
    this.isVideoPaused = false;

    this.addBotMessage(
      "Good morning! Let's begin our lesson on tenses. You can ask me any question about tenses"
    );
    this.loadSuggestions();

    // First play blink video immediately
    this.playBlink();

    // Clear old timer if any
    if (this.introStartTimer) {
      clearTimeout(this.introStartTimer);
    }

    // After 2 seconds, start intro video
    this.introStartTimer = setTimeout(() => {
      this.startIntroVideo();
      this.focusInput();
    }, 2000);
  }

  private startIntroVideo(): void {
    const introUrl = this.chatService.resolveVideoUrl('intro');
    const video = this.tutorVideo?.nativeElement;

    if (video && introUrl) {
      video.src = introUrl;
      video.muted = this.isMuted;
      video.loop = false;

      this.isActivePlaying = true;
      this.isVideoPaused = false;
      this.videoStatus = '▶ intro';
      this.speechBubbleText = '▶ Playing introduction...';

      video.play().catch(() => { });

      video.onended = () => {
        video.onended = null;
        this.playBlink();
        this.speechBubbleText = 'Ask me anything about tenses!';
        this.focusInput();
        this.cdr.detectChanges();
      };
    } else {
      this.playBlink();
      this.speechBubbleText = 'Ask me anything about tenses!';
      this.focusInput();
    }
  }

  // ─── INPUT FOCUS ─────────────────────────────────────────────────────────

  focusInput(): void {
    if (this.showOverlay) return;

    requestAnimationFrame(() => {
      const input = this.inputField?.nativeElement;
      if (input && document.activeElement !== input) {
        input.focus();
      }
    });
  }

  onInputBlur(): void {
    this.inputFocused = false;

    if (!this.showOverlay) {
      setTimeout(() => this.focusInput(), 0);
    }
  }

  // ─── VIDEO CONTROLS ──────────────────────────────────────────────────────

  onPlayButtonClick(): void {
    if (this.lastQuestionVideoKey) {
      this.playVideoByKey(this.lastQuestionVideoKey);
    }
    this.focusInput();
  }

  onPlayPause(): void {
    const video = this.tutorVideo?.nativeElement;
    if (!video) return;

    if (this.isActivePlaying && !this.isVideoPaused) {
      video.pause();
      this.isVideoPaused = true;
      this.videoStatus = '⏸ Paused';
    } else if (this.isActivePlaying && this.isVideoPaused) {
      video.play().catch(() => { });
      this.isVideoPaused = false;
      this.videoStatus = '▶ Resuming...';
    } else {
      this.onPlayButtonClick();
    }

    this.focusInput();
  }

  private playBlink(): void {
    const video = this.tutorVideo?.nativeElement;
    if (!video) return;

    this.removeTimeUpdateListener();

    const blinkUrl = this.chatService.resolveVideoUrl('blink');
    video.src = blinkUrl;
    video.loop = true;
    video.muted = true;
    video.play().catch(() => { });

    this.videoStatus = 'Idle';
    this.showPoster = false;
    this.isActivePlaying = false;
    this.isVideoPaused = false;
  }

  private playVideoByKey(key: string): void {
    const video = this.tutorVideo?.nativeElement;
    if (!video) return;

    this.lastQuestionVideoKey = key;
    const url = this.chatService.resolveVideoUrl(key);
    const displayName = key.replace(/_/g, ' ').replace('videos/', '').replace('.mp4', '');

    this.videoStatus = '▶ ' + displayName;
    this.showPoster = false;
    this.isActivePlaying = true;
    this.isVideoPaused = false;
    this.speechBubbleText = '▶ ' + displayName;

    this.removeTimeUpdateListener();

    video.loop = false;
    video.src = url;
    video.muted = this.isMuted;

    let msgIndex = -1;
    for (let i = this.messages.length - 1; i >= 0; i--) {
      const m: Message = this.messages[i];
      if (m.role === 'bot' && m.videoKey === key && m.hasTimings) {
        msgIndex = i;
        break;
      }
    }
    this.currentHighlightMsgIndex = msgIndex;

    if (msgIndex >= 0) {
      this.timeUpdateHandler = () => {
        const t = video.currentTime;
        const container = document.querySelector(`[data-msg-index="${msgIndex}"]`);
        if (!container) return;

        container.querySelectorAll<HTMLElement>('.timed-word').forEach(span => {
          const start = parseFloat(span.getAttribute('data-start') ?? '-1');
          const end = parseFloat(span.getAttribute('data-end') ?? '-1');

          if (start >= 0 && t >= start && t < end) {
            span.classList.add('word-active');
          } else {
            span.classList.remove('word-active');
          }
        });
      };

      video.addEventListener('timeupdate', this.timeUpdateHandler);
    }

    video.play().catch(() => {
      this.videoStatus = displayName + ' (file missing)';
    });

    video.onended = () => {
      video.onended = null;

      if (msgIndex >= 0) {
        const container = document.querySelector(`[data-msg-index="${msgIndex}"]`);
        container?.querySelectorAll<HTMLElement>('.word-active')
          .forEach(el => el.classList.remove('word-active'));
      }

      this.currentHighlightMsgIndex = -1;
      this.removeTimeUpdateListener();
      this.playBlink();
      this.speechBubbleText = 'Click ▶ to replay the answer!';
      this.focusInput();
      this.cdr.detectChanges();
    };
  }

  private removeTimeUpdateListener(): void {
    const video = this.tutorVideo?.nativeElement;
    if (video && this.timeUpdateHandler) {
      video.removeEventListener('timeupdate', this.timeUpdateHandler);
      this.timeUpdateHandler = null;
    }
  }

  onReplay(): void {
    const video = this.tutorVideo?.nativeElement;
    if (video?.src) {
      video.currentTime = 0;
      video.play().catch(() => { });
    }
    this.focusInput();
  }

  onToggleMute(): void {
    this.isMuted = !this.isMuted;
    const video = this.tutorVideo?.nativeElement;
    if (video) video.muted = this.isMuted;
    this.focusInput();
  }

  // ─── CHAT ────────────────────────────────────────────────────────────────

  formatText(text: string): string {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }

  buildTimedHtml(html: string): SafeHtml {
    const tagged = html.replace(
      /<span\b([^>]*\bdata-start="[^"]*"[^>]*)>/gi,
      (match, attrs) => {
        if (/class="[^"]*timed-word/.test(attrs)) return match;
        return `<span class="timed-word"${attrs}>`;
      }
    );
    return this.sanitizer.bypassSecurityTrustHtml(tagged);
  }

  getTime(): string {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  private addBotMessage(text: string, videoKey?: string): void {
    const hasTimings = text.includes('data-start');

    const msg: Message = {
      text,
      hasTimings,
      role: 'bot',
      time: this.getTime(),
      videoKey: videoKey || ''
    };

    if (hasTimings) {
      msg.safeHtml = this.buildTimedHtml(text);
    }

    this.messages.push(msg);
    this.shouldScroll = true;
  }

 sendMessage(text: string): void {
  if (!text?.trim() || this.isTyping) return;

  this.messages.push({
    text: text.trim(), hasTimings: false,
    role: 'user', time: this.getTime()
  });

  this.userInput = '';
  this.isTyping = true;
  this.shouldScroll = true;
  setTimeout(() => this.focusInput(), 50);

  this.chatService.sendMessage(text.trim()).subscribe({
    next: (res: ChatResponse) => {
      this.isTyping = false;
      this.suggestions = res.suggestions || [];

      const replyVideoKey = res.video_key || res.video_url || '';

      // ── Detect multi-topic reply (split by ---)
      const parts = res.reply.split(/\n---\n/).map((p: string) => p.trim()).filter(Boolean);

      if (parts.length > 1 && Array.isArray(res.video_keys) && res.video_keys.length > 1) {
        // Multi-topic: add each part as its own message with its own videoKey
        this.videoQueue = [];
        parts.forEach((part: string, i: number) => {
          const vKey = res.video_keys[i] || '';
          this.addBotMessage(part, vKey);
          if (vKey) this.videoQueue.push(vKey);
        });
        this.playVideoQueue();

      } else {
        // Single topic — original behaviour
        this.addBotMessage(res.reply, replyVideoKey);
        if (replyVideoKey) this.playMessageVideo(replyVideoKey);
      }

      this.focusInput();
    },
    error: () => {
      this.isTyping = false;
      this.addBotMessage('Could not reach the server. Make sure Flask is running on port 5000.');
      this.focusInput();
    }
  });
}

  playMessageVideo(videoKey: string): void {
    if (!videoKey) return;

    this.introPlayed = true;
    this.currentVideoKey = videoKey;
    this.playVideoByKey(videoKey);
    this.focusInput();
  }

  private loadSuggestions(): void {
    this.chatService.getSuggestions().subscribe({
      next: (res) => {
        this.suggestions = res.suggestions || [];
      },
      error: () => {
        this.suggestions = [
          'What is Present Simple?',
          'List all topics',
          'Tell me a story',
          'Practice questions',
          'What tense is "I am playing cricket"?'
        ];
      }
    });
  }

  // ─── SCROLL ──────────────────────────────────────────────────────────────

  private scrollToBottom(): void {
    try {
      const el = this.messagesScroll?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    } catch (_) { }
  }

  onScroll(): void {
    const el = this.messagesScroll?.nativeElement;
    if (!el) return;

    this.showScrollUp = el.scrollTop > 100;
    this.showScrollDown = el.scrollHeight - el.scrollTop - el.clientHeight > 100;
  }

  scrollUp(): void {
    this.messagesScroll?.nativeElement?.scrollTo({ top: 0, behavior: 'smooth' });
    this.focusInput();
  }

  scrollDown(): void {
    const el = this.messagesScroll?.nativeElement;
    el?.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    this.focusInput();
  }

  goHome(): void {
    this.router.navigate(['/']);
  }

  toggleVoiceInput(): void {
  if (!this.speechSupported) {
    this.addBotMessage('Voice input is not supported in this browser.');
    this.focusInput();
    return;
  }

  if (this.isListening) {
    this.isListening = false;        // ← set false IMMEDIATELY before stop()
    this.recognition.stop();
    this.cdr.detectChanges();        // ← force icon update right away
  } else {
    this.userInput = '';
    this.recognition.start();
  }
}

  private initSpeechRecognition(): void {
  const SpeechRecognition =
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition;

  if (!SpeechRecognition) { return; }   // browser doesn't support it

  this.speechSupported = true;
  this.recognition = new SpeechRecognition();
  this.recognition.lang = 'en-US';
  this.recognition.interimResults = false;   // shows words live as you speak
  this.recognition.continuous = true;       // stops after a pause

  this.recognition.onstart  = () => { this.isListening = true;  this.cdr.detectChanges(); };
  this.recognition.onend    = () => { this.isListening = false; this.cdr.detectChanges(); };
  this.recognition.onerror  = () => { this.isListening = false; this.cdr.detectChanges(); };

 this.recognition.onresult = (event: any) => {
  let transcript = '';
  for (let i = 0; i < event.results.length; i++) {
    if (event.results[i].isFinal) {
      transcript += event.results[i][0].transcript + ' ';
    }
  }
  if (transcript.trim()) {
    this.userInput = transcript.trim();
    this.cdr.detectChanges();
  }
};

this.recognition.onerror = (event: any) => {
  // 'no-speech' and 'audio-capture' are non-fatal — keep listening
  if (event.error === 'no-speech' || event.error === 'audio-capture') {
    return;
  }
  // Fatal errors — stop properly
  this.isListening = false;
  this.cdr.detectChanges();
};

this.recognition.onend = () => {
  // If we're supposed to still be listening, restart automatically
  if (this.isListening) {
    this.recognition.start();   // ← auto-restart keeps mic alive
  } else {
    this.cdr.detectChanges();
  }
};
}

private playVideoQueue(): void {
  if (this.isPlayingQueue || this.videoQueue.length === 0) return;

  this.isPlayingQueue = true;
  const key = this.videoQueue.shift()!;

  const video = this.tutorVideo?.nativeElement;
  if (!video) { this.isPlayingQueue = false; return; }

  const url = this.chatService.resolveVideoUrl(key);

  // Find the matching bot message for this key
  let msgIndex = -1;
  for (let i = this.messages.length - 1; i >= 0; i--) {
    if (this.messages[i].role === 'bot' && this.messages[i].videoKey === key) {
      msgIndex = i;
      break;
    }
  }

  this.removeTimeUpdateListener();
  this.currentHighlightMsgIndex = msgIndex;
  this.lastQuestionVideoKey = key;

  video.loop = false;
  video.src = url;
  video.muted = this.isMuted;
  this.isActivePlaying = true;
  this.isVideoPaused = false;
  this.showPoster = false;

  // Attach word-highlight listener for this message
  if (msgIndex >= 0) {
    this.timeUpdateHandler = () => {
      const t = video.currentTime;
      const container = document.querySelector(`[data-msg-index="${msgIndex}"]`);
      if (!container) return;
      container.querySelectorAll<HTMLElement>('.timed-word').forEach(span => {
        const start = parseFloat(span.getAttribute('data-start') ?? '-1');
        const end   = parseFloat(span.getAttribute('data-end')   ?? '-1');
        if (start >= 0 && t >= start && t < end) span.classList.add('word-active');
        else span.classList.remove('word-active');
      });
    };
    video.addEventListener('timeupdate', this.timeUpdateHandler);
  }

  video.play().catch(() => {});

  video.onended = () => {
    video.onended = null;

    // Clear highlights for finished message
    if (msgIndex >= 0) {
      document.querySelector(`[data-msg-index="${msgIndex}"]`)
        ?.querySelectorAll<HTMLElement>('.word-active')
        .forEach(el => el.classList.remove('word-active'));
    }

    this.removeTimeUpdateListener();
    this.isPlayingQueue = false;

    if (this.videoQueue.length > 0) {
      // Small pause between videos so it feels natural
      setTimeout(() => this.playVideoQueue(), 600);
    } else {
      this.playBlink();
      this.speechBubbleText = 'Click ▶ to replay the answer!';
      this.focusInput();
    }

    this.cdr.detectChanges();
  };
}
}
