import {
  Component, OnInit, OnDestroy, ViewChild, ElementRef,
  AfterViewChecked, AfterViewInit, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService, ChatResponse } from './chatllm.service';
import { Subscription } from 'rxjs';
import { Router } from '@angular/router';

interface Message {
  text: string;
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

  messages: Message[] = [];
  suggestions: string[] = [];
  userInput = '';
  isTyping = false;
  inputFocused = false;
  showScrollUp = false;
  showScrollDown = false;

  // Video state
  showPoster = false;
  isMuted = false;
  videoStatus = 'Click play to begin';
  introPlayed = false;
  currentVideoKey = 'blink';
  lastQuestionVideoKey = '';    // stores last question video for replay
  isActivePlaying = false;      // true when intro/question video is actively playing
  isVideoPaused = false;        // true when paused mid-playback

  // Speech bubble
  showSpeechBubble = true;
  speechBubbleText = 'Hi! I am your English Tutor.\nClick \u25B6 to begin the lesson!';

  private shouldScroll = false;
  private videoSub!: Subscription;
  recognition: any = null;
  isListening = false;
  speechSupported = false;

  constructor(
    private chatService: ChatService,
    private cdr: ChangeDetectorRef,
    private router: Router
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
  }

  ngAfterViewInit(): void {
    // Start blink as soon as the video element is ready
    this.playBlink();
  }

  ngOnDestroy(): void {
    if (this.videoSub) this.videoSub.unsubscribe();

    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  // ─── VIDEO CONTROLS ───

  onPlayButtonClick(): void {
    if (!this.introPlayed) {
      // ── First click: play the intro ──
      this.introPlayed = true;
      this.showPoster = false;
      this.isActivePlaying = true;
      this.isVideoPaused = false;
      this.speechBubbleText = '▶ Playing introduction...';

      const introUrl = this.chatService.resolveVideoUrl('intro');
      const video = this.tutorVideo?.nativeElement;
      if (video && introUrl) {
        video.src = introUrl;
        video.muted = this.isMuted;
        video.loop = false;
        video.play().catch(() => { });
        this.videoStatus = '▶ intro';

        // When intro ends → blink + welcome message
        video.onended = () => {
          video.onended = null;
          this.playBlink();
          this.speechBubbleText = 'Ask me anything about tenses!';
          this.addBotMessage(
            "Good morning! Let's begin our lesson on tenses. You can ask me any question about tenses"
          );
          this.loadSuggestions();
          this.cdr.detectChanges();
        };
      } else {
        // No intro video — go straight to blink + welcome
        this.playBlink();
        this.speechBubbleText = 'Ask me anything about tenses!';
        this.addBotMessage(
          "Good morning! Let's begin our lesson on tenses. You can ask me any question about tenses"
        );
        this.loadSuggestions();
      }
    } else if (this.lastQuestionVideoKey) {
      // ── Subsequent clicks: replay the last question video ──
      this.playVideoByKey(this.lastQuestionVideoKey);
    }
  }

  onPlayPause(): void {
    const video = this.tutorVideo?.nativeElement;
    if (!video) return;

    if (this.isActivePlaying && !this.isVideoPaused) {
      // Currently playing → pause
      video.pause();
      this.isVideoPaused = true;
      this.videoStatus = '⏸ Paused';
    } else if (this.isActivePlaying && this.isVideoPaused) {
      // Currently paused → resume
      video.play().catch(() => { });
      this.isVideoPaused = false;
      this.videoStatus = '▶ Resuming...';
    } else {
      // Idle (blink playing) → start intro or replay last video
      this.onPlayButtonClick();
    }
  }

  private playBlink(): void {
    const video = this.tutorVideo?.nativeElement;
    if (!video) return;
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

    this.lastQuestionVideoKey = key;  // store for replay via play button
    const url = this.chatService.resolveVideoUrl(key);
    const displayName = key.replace(/_/g, ' ').replace('videos/', '').replace('.mp4', '');
    this.videoStatus = '▶ ' + displayName;
    this.showPoster = false;
    this.isActivePlaying = true;
    this.isVideoPaused = false;
    this.speechBubbleText = '▶ ' + displayName;

    video.loop = false;
    video.src = url;
    video.muted = this.isMuted;
    video.play().catch(() => {
      this.videoStatus = displayName + ' (file missing)';
    });

    // When done → back to blink, show play button for replay
    video.onended = () => {
      video.onended = null;
      this.playBlink();
      this.speechBubbleText = 'Click \u25B6 to replay the answer!';
      this.cdr.detectChanges();
    };
  }

  onReplay(): void {
    const video = this.tutorVideo?.nativeElement;
    if (video?.src) {
      video.currentTime = 0;
      video.play().catch(() => { });
    }
  }

  onToggleMute(): void {
    this.isMuted = !this.isMuted;
    const video = this.tutorVideo?.nativeElement;
    if (video) video.muted = this.isMuted;
  }

  // ─── CHAT ───

  formatText(text: string): string {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }

  getTime(): string {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  private addBotMessage(text: string, videoKey?: string): void {
    this.messages.push({
      text,
      role: 'bot',
      time: this.getTime(),
      videoKey: videoKey || ''
    });
    this.shouldScroll = true;
  }

  sendMessage(text: string): void {
    if (!text?.trim() || this.isTyping) return;

    this.messages.push({
      text: text.trim(),
      role: 'user',
      time: this.getTime()
    });

    this.userInput = '';
    this.isTyping = true;
    this.shouldScroll = true;

    this.chatService.sendMessage(text.trim()).subscribe({
      next: (res: ChatResponse) => {
        this.isTyping = false;

        const replyVideoKey = res.video_key || res.video_url || '';

        this.addBotMessage(res.reply, replyVideoKey);
        this.suggestions = res.suggestions || [];

        // Ensure reply video plays immediately in same right panel
        if (replyVideoKey) {
          this.playMessageVideo(replyVideoKey);
        }
      },
      error: () => {
        this.isTyping = false;
        this.addBotMessage("Could not reach the server. Make sure Flask is running on port 5000.");
      }
    });
  }

  playMessageVideo(videoKey: string): void {
    if (!videoKey) return;

    // allow response videos even if intro was not clicked
    this.introPlayed = true;
    this.currentVideoKey = videoKey;
    this.playVideoByKey(videoKey);
  }

  private loadSuggestions(): void {
    this.chatService.getSuggestions().subscribe({
      next: (res) => { this.suggestions = res.suggestions || []; },
      error: () => {
        this.suggestions = [
          'What is Present Simple?', 'List all topics',
          'Tell me a story', 'Practice questions',
          'What tense is "I am playing cricket"?'
        ];
      }
    });
  }

  // ─── SCROLL ───

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
  }

  scrollDown(): void {
    const el = this.messagesScroll?.nativeElement;
    el?.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }

  goHome() {
    this.router.navigate(['/']);
  }

 
  toggleVoiceInput(): void {
    if (!this.speechSupported) {
      this.addBotMessage('Voice input is not supported in this browser.');
      return;
    }

    if (this.isListening) {
      this.recognition.stop();
    } else {
      this.userInput = '';
      this.recognition.start();
    }
  }
}
