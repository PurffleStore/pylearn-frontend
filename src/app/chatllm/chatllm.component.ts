// chatllm.component.ts  (FULL FILE)

import {
  Component,
  OnInit,
  ViewChild,
  ElementRef,
  HostListener,
  AfterViewInit,
  ChangeDetectorRef,
  Inject,
  NgZone,
  PLATFORM_ID,
  OnDestroy,
} from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ChatLLMService, ChatMessage, SearchResponse, Question } from './chatllm.service';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { isPlatformBrowser } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { environment } from '../../environments/environment';

// Interface for media collections from backend
interface MediaCollection {
  audio_urls: string[];
  video_urls: string[];
  detail_urls: string[];
  story_urls: string[];
  example_urls: string[];
  detail_texts: string[];
  story_texts: string[];
  example_texts: string[];
  keywords: string[];
}

type UiChatMessage = ChatMessage & {
  rawData?: any;
  _baseText?: string;
  _safeHtml?: SafeHtml;
  _activeContentType?: string | null;
  _activeContentText?: string | null;
  _activeMediaIndex?: number;
  _mediaType?: string;
  _isTyping?: boolean;
};

type PlaylistType = 'video' | 'audio' | 'detail' | 'story' | 'example';

@Component({
  selector: 'app-chatllm',
  templateUrl: './chatllm.component.html',
  styleUrls: ['./chatllm.component.css'],
})
export class ChatLLMComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('chatContainer') private chatContainer!: ElementRef;
  @ViewChild('messageInput') private messageInput!: ElementRef;
  @ViewChild('videoPlayer') videoRef!: ElementRef<HTMLVideoElement>;

  chatForm: FormGroup;

  messages: UiChatMessage[] = [];
  isTyping = false;

  // Cached pairs list (DO NOT use getter — causes ExpressionChangedAfterItHasBeenChecked)
  pairedMessagesList: Array<{ user?: ChatMessage; bot?: any }> = [];
  trackByPair = (index: number) => index;

  // Suggestions
  suggestedQuestions: string[] = [];
  showSuggestions = false;
  allQuestions: Question[] = [];

  private searchQuery = new Subject<string>();
  private followupQuestions: string[] = [];
  private isInputFocused = false;
  private suggestionsOpenedByClick = false;

  // Pair navigation
  currentPairIndex = 0;

  // Video sources
  blinkVideoSrc = 'assets/staticchat/blink.mp4';
  introVideoSrc = 'assets/staticchat/intro.mp4';

  // Video state
  currentVideoType: 'blink' | 'intro' | 'response' = 'blink';
  currentResponseVideoUrl: string | null = null;
  isVideoPlaying = false;

  hasChatStarted = false;
  lastResponseVideoUrl: string | null = null;
  private lastResponseBotMsg: UiChatMessage | null = null;

  // Audio player
  private audioPlayer: HTMLAudioElement | null = null;

  // Mic
  supported = false;
  isListening = false;
  showActions = false;

  private isBrowser = false;

  private mediaStream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: BlobPart[] = [];
  private uploadInProgress = false;

  isSpeechProcessing = false;

  apiBaseSrc = environment.apiBaseUrl.replace(/\/+$/, '');

  // Generic playlist state
  private playlist: string[] = [];
  private playlistIndex = 0;
  private playlistOwnerMsgId?: number | null = null;
  private playlistType: PlaylistType | null = null;
  private playlistLoop = false;

  // Word highlight
  private highlightBotMsg: UiChatMessage | null = null;
  private highlightSpans: HTMLElement[] = [];
  private timeUpdateHandler: (() => void) | null = null;

  // ResizeObserver-based text fitting is handled by the [fitText] directive.
  // No per-bubble observers needed in the component.

  constructor(
    private fb: FormBuilder,
    private chatService: ChatLLMService,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) platformId: object,
    private zone: NgZone
  ) {
    this.chatForm = this.fb.group({
      message: ['', Validators.required],
    });

    this.searchQuery
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((query) => this.searchQuestions(query));

    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit() {
    this.messages.push({
      id: 1,
      text: "Good morning! Let's begin our lesson on tenses. You can ask me any question about tenses",
      sender: 'bot',
      timestamp: new Date(),
    });

    this.rebuildPairs();

    if (!this.isBrowser) return;

    const hasGetUserMedia = !!navigator.mediaDevices?.getUserMedia;
    const hasMediaRecorder = typeof (window as any).MediaRecorder !== 'undefined';
    this.supported = hasGetUserMedia && hasMediaRecorder;

    this.loadAllQuestions();
    this.loadInitialSuggestionsFromApi();

    requestAnimationFrame(() => this.scrollToLastPair());
  }

  ngAfterViewInit() {
    this.playBlinkVideo();
  }

  ngOnDestroy() {
    this.removeTimeUpdateListener();
  }

  /* ================= PAIRS (CACHED) ================= */

  private rebuildPairs(): void {
    const pairs: Array<{ user?: ChatMessage; bot?: any }> = [];
    const msgs = this.messages || [];
    let i = 0;

    while (i < msgs.length) {
      const current = msgs[i];

      if (current.sender === 'user') {
        const pair: { user?: ChatMessage; bot?: any } = { user: current };
        const next = msgs[i + 1];
        if (next && next.sender === 'bot') {
          pair.bot = next;
          i += 2;
        } else {
          i += 1;
        }
        pairs.push(pair);
      } else {
        pairs.push({ bot: current });
        i += 1;
      }
    }

    this.pairedMessagesList = pairs;
  }

  /* ================= SAFE HTML HELPER ================= */

  buildSafeHtml(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  /* ================= WORD HIGHLIGHT ================= */

  private attachHighlightListener(botMsg: UiChatMessage): void {
    this.removeTimeUpdateHandler();
    this.highlightBotMsg = botMsg;

    const video = this.safeVideo();
    if (!video) return;

    this.cdr.detectChanges();

    setTimeout(() => {
      const spans = this.collectSpansForMsg(botMsg);
      this.highlightSpans = spans;

      if (!spans.length) {
        setTimeout(() => {
          this.highlightSpans = this.collectSpansForMsg(botMsg);
          if (!this.highlightSpans.length) return;
          this.wireTimeUpdate(video);
        }, 100);
        return;
      }

      this.wireTimeUpdate(video);
    }, 50);
  }

  private wireTimeUpdate(video: HTMLVideoElement): void {
    if (this.timeUpdateHandler) return;

    this.timeUpdateHandler = () => {
      this.zone.runOutsideAngular(() => {
        this.highlightWordsForTime(video.currentTime);
      });
    };
    video.addEventListener('timeupdate', this.timeUpdateHandler);
  }

  private attachHighlightListenerForAudio(botMsg: UiChatMessage): void {
    this.removeTimeUpdateHandler();
    this.highlightBotMsg = botMsg;

    const audio = this.audioPlayer;
    if (!audio) return;

    this.cdr.detectChanges();

    setTimeout(() => {
      const spans = this.collectSpansForMsg(botMsg);
      this.highlightSpans = spans;

      if (!spans.length) {
        setTimeout(() => {
          this.highlightSpans = this.collectSpansForMsg(botMsg);
          if (!this.highlightSpans.length) return;
          this.wireAudioTimeUpdate(audio);
        }, 100);
        return;
      }

      this.wireAudioTimeUpdate(audio);
    }, 50);
  }

  private wireAudioTimeUpdate(audio: HTMLAudioElement): void {
    if (this.timeUpdateHandler) return;

    this.timeUpdateHandler = () => {
      this.zone.runOutsideAngular(() => {
        this.highlightWordsForTime(audio.currentTime);
      });
    };
    audio.addEventListener('timeupdate', this.timeUpdateHandler);
  }

  private collectSpansForMsg(botMsg: UiChatMessage): HTMLElement[] {
    const container = this.chatContainer?.nativeElement as HTMLElement | null;
    if (!container) return [];

    const pairEls = Array.from(container.querySelectorAll<HTMLElement>('.pair'));
    for (const pairEl of pairEls) {
      const idx = parseInt(pairEl.getAttribute('data-index') ?? '-1', 10);
      if (idx < 0) continue;
      const pairData = this.pairedMessagesList[idx];
      if (!pairData?.bot || pairData.bot.id !== botMsg.id) continue;

      const answerEl = pairEl.querySelector<HTMLElement>('.answer-text');
      if (answerEl) {
        const spans = Array.from(answerEl.querySelectorAll<HTMLElement>('span[data-start]'));
        if (spans.length) return spans;
      }
    }

    // Fallback: last answer-text with timed spans
    const allAnswerEls = Array.from(container.querySelectorAll<HTMLElement>('.answer-text'));
    for (let i = allAnswerEls.length - 1; i >= 0; i--) {
      const spans = Array.from(allAnswerEls[i].querySelectorAll<HTMLElement>('span[data-start]'));
      if (spans.length) return spans;
    }

    return [];
  }

  private removeTimeUpdateHandler(): void {
    if (this.timeUpdateHandler) {
      const video = this.safeVideo();
      if (video) video.removeEventListener('timeupdate', this.timeUpdateHandler);
      if (this.audioPlayer) this.audioPlayer.removeEventListener('timeupdate', this.timeUpdateHandler);
      this.timeUpdateHandler = null;
    }
    this.highlightSpans.forEach(s => s.classList.remove('word-highlight'));
    this.highlightSpans = [];
    this.highlightBotMsg = null;
  }

  private detachTimeUpdateOnly(): void {
    if (this.timeUpdateHandler) {
      const video = this.safeVideo();
      if (video) video.removeEventListener('timeupdate', this.timeUpdateHandler);
      if (this.audioPlayer) this.audioPlayer.removeEventListener('timeupdate', this.timeUpdateHandler);
      this.timeUpdateHandler = null;
    }
  }

  private detachAudioTimeUpdateOnly(): void {
    if (this.timeUpdateHandler && this.audioPlayer) {
      this.audioPlayer.removeEventListener('timeupdate', this.timeUpdateHandler);
      this.timeUpdateHandler = null;
    }
  }

  private removeTimeUpdateListener = this.removeTimeUpdateHandler.bind(this);

  private highlightWordsForTime(currentTime: number): void {
    for (const span of this.highlightSpans) {
      const start = parseFloat(span.getAttribute('data-start') ?? '-1');
      const end = parseFloat(span.getAttribute('data-end') ?? '-1');
      if (start < 0 || end < 0) continue;

      if (currentTime >= start && currentTime <= end) {
        span.classList.add('word-highlight');
      } else {
        span.classList.remove('word-highlight');
      }
    }
  }

  /* ================= VIDEO HELPERS ================= */

  private safeVideo(): HTMLVideoElement | null {
    try { return this.videoRef.nativeElement; } catch { return null; }
  }

  playBlinkVideo() {
    const video = this.safeVideo();
    if (!video) return;

    this.removeTimeUpdateHandler();

    video.onended = null;
    video.src = this.blinkVideoSrc;
    video.loop = true;
    video.muted = true;
    video.currentTime = 0;
    video.play().catch(() => { });

    this.currentVideoType = 'blink';
    this.currentResponseVideoUrl = null;
    this.isVideoPlaying = false;
  }

  playIntroVideo() {
    const video = this.safeVideo();
    if (!video) return;

    this.removeTimeUpdateHandler();

    if (this.audioPlayer && !this.audioPlayer.paused) {
      this.audioPlayer.pause();
    }

    video.onended = () => this.playBlinkVideo();
    video.src = this.introVideoSrc;
    video.loop = false;
    video.muted = false;
    video.currentTime = 0;

    video.play()
      .then(() => {
        this.currentVideoType = 'intro';
        this.currentResponseVideoUrl = null;
        this.isVideoPlaying = true;
      })
      .catch(() => {
        video.muted = true;
        video.play().catch(() => { });
        this.currentVideoType = 'intro';
        this.currentResponseVideoUrl = null;
        this.isVideoPlaying = !video.paused;
      });
  }

  playResponseVideo(
    url?: string,
    isShowText: boolean = false,
    showText?: string,
    botMsg?: any,
    contentType?: 'detail' | 'story' | 'example' | 'main',
    index: number = 0
  ) {
    if (!url) return;

    if (botMsg) {
      botMsg._baseText = botMsg._baseText ?? botMsg.text;
      botMsg._activeMediaIndex = index;
      botMsg._mediaType = contentType;

      const newText = isShowText
        ? (showText || 'No text available.')
        : botMsg._baseText;

      if (botMsg.text !== newText || !botMsg._safeHtml) {
        botMsg.text = newText;
        botMsg._safeHtml = this.buildSafeHtml(newText);
        botMsg._activeContentType = isShowText ? contentType : 'main';
      }
    }

    const video = this.safeVideo();
    if (!video) return;

    if (this.audioPlayer && !this.audioPlayer.paused) {
      this.audioPlayer.pause();
      try { this.audioPlayer.currentTime = 0; } catch { }
    }

    video.pause();

    const absUrl = new URL(url, window.location.href).href;
    if (video.src !== absUrl) { video.src = url; }

    video.loop = false;
    video.muted = false;
    video.currentTime = 0;
    video.load();

    if (botMsg) { this.attachHighlightListener(botMsg); }

    video.onended = () => this.playBlinkVideo();

    this.currentVideoType = 'response';
    this.currentResponseVideoUrl = url;

    video.play()
      .then(() => { this.isVideoPlaying = true; })
      .catch(() => {
        video.muted = true;
        video.play().catch(() => { });
        this.isVideoPlaying = !video.paused;
      });
  }

  togglePlayPause() {
    const video = this.safeVideo();
    if (!video) return;

    if (this.currentVideoType === 'blink') {
      if (!this.hasChatStarted) {
        this.playIntroVideo();
        return;
      }

      if (this.audioPlayer && !this.audioPlayer.paused) {
        this.audioPlayer.pause();
        this.detachAudioTimeUpdateOnly();
        return;
      }

      if (
        this.audioPlayer &&
        this.audioPlayer.paused &&
        this.audioPlayer.src &&
        this.audioPlayer.currentTime > 0 &&
        this.highlightBotMsg
      ) {
        this.audioPlayer.play().catch(() => { });
        if (this.highlightBotMsg && !this.timeUpdateHandler) {
          if (this.highlightSpans.length) {
            this.wireAudioTimeUpdate(this.audioPlayer);
          } else {
            this.attachHighlightListenerForAudio(this.highlightBotMsg);
          }
        }
        return;
      }

      if (this.lastResponseVideoUrl) {
        this.playResponseVideo(
          this.lastResponseVideoUrl,
          false,
          undefined,
          this.lastResponseBotMsg ?? undefined
        );
      }
      return;
    }

    if (video.paused) {
      video.play().catch(() => { });
      this.isVideoPlaying = true;

      if (this.highlightBotMsg && !this.timeUpdateHandler) {
        if (this.highlightSpans.length) {
          this.wireTimeUpdate(video);
        } else {
          this.attachHighlightListener(this.highlightBotMsg);
        }
      }
    } else {
      video.pause();
      this.isVideoPlaying = false;
      this.detachTimeUpdateOnly();
    }
  }

  /* ================= PLAYLIST ================= */

  private uniq(list: any[]): string[] {
    return Array.from(new Set((list || []).filter(Boolean).map((x) => String(x))));
  }

  private buildPlaylistFromBot(botMsg: UiChatMessage, type: PlaylistType): string[] {
    const rd = botMsg?.rawData || {};

    if (type === 'video') {
      return this.uniq(rd.video_urls?.length ? rd.video_urls : (rd.video_url ? [rd.video_url] : []));
    }
    if (type === 'audio') {
      return this.uniq(rd.audio_urls?.length ? rd.audio_urls : (rd.audio_url ? [rd.audio_url] : []));
    }

    const key = `${type}_urls`;
    const singleKey = `${type}_url`;
    const arr = Array.isArray(rd[key]) ? rd[key] : [];
    const single = rd[singleKey] ? [rd[singleKey]] : [];

    return this.uniq(arr.length ? arr : single);
  }

  private getTextForIndex(
    botMsg: UiChatMessage,
    type: 'detail' | 'story' | 'example',
    idx: number
  ): string {
    const rd = botMsg?.rawData || {};
    const textsKey = `${type}_texts`;
    const textKey = `${type}_text`;

    if (Array.isArray(rd[textsKey]) && rd[textsKey][idx]) return String(rd[textsKey][idx]);
    if (rd[textKey]) return String(rd[textKey]);
    return `${type} ${idx + 1}`;
  }

  private stopCurrentPlaylist(): void {
    this.playlist = [];
    this.playlistIndex = 0;
    this.playlistOwnerMsgId = null;
    this.playlistType = null;
  }

  startPlaylist(botMsg: UiChatMessage, type: PlaylistType) {
    if (!botMsg) return;

    this.stopCurrentPlaylist();

    const items = this.buildPlaylistFromBot(botMsg, type);
    if (!items.length) return;

    this.playlistOwnerMsgId = botMsg.id;
    this.playlistType = type;
    this.playlist = items;
    this.playlistIndex = 0;

    this.playPlaylistItem(botMsg);
  }

  private playNextInPlaylist(botMsg: UiChatMessage) {
    if (!this.playlist.length) return;

    const next = this.playlistIndex + 1;

    if (next < this.playlist.length) {
      this.playlistIndex = next;
      this.playPlaylistItem(botMsg);
      return;
    }

    if (this.playlistLoop) {
      this.playlistIndex = 0;
      this.playPlaylistItem(botMsg);
    } else {
      this.stopCurrentPlaylist();
      this.playBlinkVideo();
    }
  }

  private playPlaylistItem(botMsg: UiChatMessage) {
    if (!this.playlist.length || !this.playlistType) return;

    if (this.playlistOwnerMsgId !== botMsg.id) {
      this.stopCurrentPlaylist();
      return;
    }

    const idx = Math.max(0, Math.min(this.playlistIndex, this.playlist.length - 1));
    const url = this.playlist[idx];
    const type = this.playlistType;

    if (type === 'audio') {
      this.playAudio(url);
      this.lastResponseBotMsg = botMsg;

      if (this.audioPlayer) {
        this.audioPlayer.onended = () => {
          if (this.playlistOwnerMsgId !== botMsg.id) return;
          this.playNextInPlaylist(botMsg);
        };
      }

      this.attachHighlightListenerForAudio(botMsg);
      return;
    }

    const showText = (type === 'detail' || type === 'story' || type === 'example');
    const contentText = showText
      ? this.getTextForIndex(botMsg, type as any, idx)
      : (botMsg?._baseText || botMsg.text);

    this.lastResponseVideoUrl = url;
    this.lastResponseBotMsg = botMsg;

    this.playResponseVideo(
      url,
      showText,
      contentText,
      botMsg,
      type === 'video' ? 'main' : (type as any),
      idx
    );

    const video = this.safeVideo();
    if (video) {
      video.onended = () => {
        if (this.playlistOwnerMsgId !== botMsg.id) return;
        this.playNextInPlaylist(botMsg);
      };
    }
  }

  /* ================= SUGGESTIONS ================= */

  private loadInitialSuggestionsFromApi() {
    this.chatService.getSuggestions().subscribe({
      next: (res) => {
        const list = (res?.suggestions || []).map((s: any) => s.question).filter(Boolean);
        this.suggestedQuestions = list.slice(0, 5);
        this.showSuggestions = false;
      },
      error: () => {
        this.suggestedQuestions = [];
        this.showSuggestions = false;
      },
    });
  }

  loadAllQuestions() {
    this.chatService.getAllQuestions().subscribe({
      next: (response: any) => {
        if (response?.success) {
          this.allQuestions = response.questions || [];
        } else if (Array.isArray(response)) {
          this.allQuestions = response;
        } else if (response?.questions) {
          this.allQuestions = response.questions;
        } else {
          this.allQuestions = [];
        }
      },
      error: () => { this.allQuestions = []; },
    });
  }

  onInputClick() {
    this.isInputFocused = true;
    this.suggestionsOpenedByClick = true;
    this.showQuestionSuggestions(true);
  }

  onInputBlur() {
    setTimeout(() => {
      this.isInputFocused = false;
      this.suggestionsOpenedByClick = false;
      this.showSuggestions = false;
    }, 180);
  }

  onInputChange() {
    if (!this.suggestionsOpenedByClick) return;

    const query = (this.chatForm.get('message')?.value || '').toString();
    if (query.trim()) {
      this.searchQuery.next(query);
    } else {
      this.showQuestionSuggestions(true);
    }
  }

  private showQuestionSuggestions(forceOpen = false) {
    if (!this.suggestionsOpenedByClick && !forceOpen) {
      this.showSuggestions = false;
      return;
    }

    const currentInput = (this.chatForm.get('message')?.value || '').trim();

    if (currentInput.length > 0) {
      this.searchQuestions(currentInput);
      return;
    }

    if (this.followupQuestions.length > 0) {
      this.suggestedQuestions = this.followupQuestions.slice(0, 5);
      this.showSuggestions = this.suggestedQuestions.length > 0;
      return;
    }

    this.showSuggestions = this.suggestedQuestions.length > 0;
  }

  private searchQuestions(query: string) {
    if (!this.allQuestions || this.allQuestions.length === 0) {
      this.showSuggestions =
        this.suggestionsOpenedByClick && this.suggestedQuestions.length > 0;
      return;
    }

    const q = (query || '').trim().toLowerCase();
    if (!q) { this.showQuestionSuggestions(true); return; }

    const filtered = this.allQuestions
      .filter((x) => (x.question || '').toLowerCase().includes(q))
      .slice(0, 5);

    this.suggestedQuestions = filtered.map((x) => x.question);
    this.showSuggestions =
      this.suggestionsOpenedByClick && this.suggestedQuestions.length > 0;
  }

  selectQuestion(question: string) {
    const q = (question || '').trim();
    if (!q) return;

    this.chatForm.get('message')?.setValue(q);
    this.showSuggestions = false;
    this.suggestionsOpenedByClick = false;

    this.sendMessage();
  }

  /* ================= SEND MESSAGE ================= */

  sendMessage() {
    const message = (this.chatForm.get('message')?.value || '').trim();
    if (!message) return;

    this.stopCurrentPlaylist();
    this.stopAudio();

    this.messages.push({
      id: this.messages.length + 1,
      text: message,
      sender: 'user',
      timestamp: new Date(),
    });

    this.hasChatStarted = true;
    this.chatForm.reset();
    this.showSuggestions = false;

    const typingMsg: UiChatMessage = {
      id: this.messages.length + 1,
      text: '',
      sender: 'bot',
      timestamp: new Date(),
      _isTyping: true,
    };
    this.messages.push(typingMsg);

    this.rebuildPairs();
    requestAnimationFrame(() => this.scrollToLastPair());

    this.chatService.searchQuestion(message).subscribe({
      next: (response: SearchResponse & Partial<MediaCollection> & any) => {
        this.removeTypingPlaceholder();

        const rawAnswer = response?.answer
          ? String(response.answer)
          : String(response?.message || 'Sorry, I could not find an answer.');

        // Strip newlines for display; keep HTML for innerHTML
        const botText = rawAnswer.replace(/\n/g, ' ');
        const safeHtml = this.buildSafeHtml(botText);

        const botMessage: UiChatMessage = {
          id: this.messages.length + 1,
          text: botText,
          sender: 'bot',
          timestamp: new Date(),
          rawData: response,
          _baseText: botText,
          _safeHtml: safeHtml,
          _activeContentType: null,
          _activeContentText: null,
          _activeMediaIndex: 0,
          _mediaType: 'main',
        };

        this.messages.push(botMessage);

        this.rebuildPairs();
        requestAnimationFrame(() => this.scrollToLastPair());

        const hasVideos = (response?.video_urls?.length > 0) || !!response?.video_url;
        if (hasVideos) {
          this.startPlaylist(botMessage, 'video');
        }

        if (response?.followups?.length) {
          this.followupQuestions = response.followups
            .map((f: any) => f?.question)
            .filter(Boolean)
            .slice(0, 5);
          this.suggestedQuestions = this.followupQuestions;
          this.showSuggestions = false;
        } else {
          this.followupQuestions = [];
          this.loadInitialSuggestionsFromApi();
        }
      },

      error: () => {
        this.removeTypingPlaceholder();

        this.messages.push({
          id: this.messages.length + 1,
          text: 'Sorry, I encountered an error. Please try again.',
          sender: 'bot',
          timestamp: new Date(),
        });

        this.rebuildPairs();
        requestAnimationFrame(() => this.scrollToLastPair());

        this.followupQuestions = [];
        this.loadInitialSuggestionsFromApi();
      },
    });
  }

  /* ================= AUDIO ================= */

  playAudio(url?: string) {
    if (!url) return;

    try {
      const video = this.safeVideo();
      if (video && this.currentVideoType !== 'blink' && !video.paused) {
        video.pause();
        this.isVideoPlaying = false;
      }

      if (!this.audioPlayer) {
        this.audioPlayer = new Audio();
      } else {
        this.audioPlayer.pause();
      }

      this.audioPlayer.src = url;
      this.audioPlayer.currentTime = 0;
      this.audioPlayer.onended = null;
      this.audioPlayer.play().catch(() => { });
    } catch (e) {
      console.error('Audio play failed', e);
    }
  }

  private stopAudio() {
    try {
      if (this.audioPlayer) {
        this.audioPlayer.pause();
        this.audioPlayer.currentTime = 0;
        this.audioPlayer.onended = null;
      }
    } catch { }
  }

  /* ================= SCROLL ================= */

  private scrollToPair(index: number) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          const container = this.chatContainer?.nativeElement as HTMLElement;
          if (!container) return;

          const pairs = container.querySelectorAll('.pair');
          if (!pairs || pairs.length === 0) return;

          let idx = index;
          if (idx < 0) idx = 0;
          if (idx >= pairs.length) idx = pairs.length - 1;

          const target = pairs[idx] as HTMLElement;
          if (!target) return;

          const cRect = container.getBoundingClientRect();
          const tRect = target.getBoundingClientRect();
          const delta = (tRect.top - cRect.top) + container.scrollTop;

          container.scrollTo({ top: delta, behavior: 'smooth' });
          this.currentPairIndex = idx;
        } catch { }
      });
    });
  }

  private scrollToLastPair(): void {
    const total = this.pairedMessagesList.length;
    if (total === 0) return;
    this.scrollToPair(total - 1);
  }

  showNextPair() {
    const total = this.pairedMessagesList.length;
    if (total === 0) return;
    this.scrollToPair(Math.min(this.currentPairIndex + 1, total - 1));
  }

  showPreviousPair() {
    const total = this.pairedMessagesList.length;
    if (total === 0) return;
    this.scrollToPair(Math.max(this.currentPairIndex - 1, 0));
  }

  clearChat() {
    this.messages = [];
    this.hasChatStarted = false;
    this.lastResponseVideoUrl = null;
    this.followupQuestions = [];
    this.suggestedQuestions = [];
    this.showSuggestions = false;
    this.suggestionsOpenedByClick = false;

    this.stopCurrentPlaylist();
    this.stopAudio();

    this.ngOnInit();
    this.playBlinkVideo();
  }

  /* ================= MIC / SPEECH ================= */

  private pickMimeType(): string {
    const w: any = window;
    const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/m4a'];
    if (!w.MediaRecorder?.isTypeSupported) return '';
    for (const t of types) {
      if (w.MediaRecorder.isTypeSupported(t)) return t;
    }
    return '';
  }

  private pauseVideoAndStopAudioForMic(): void {
    const video = this.safeVideo();
    if (video && !video.paused) {
      video.pause();
      this.isVideoPlaying = false;
    }
    this.stopCurrentPlaylist();
    this.stopAudio();
  }

  async toggleMic() {
    if (!this.supported || this.isListening || this.uploadInProgress) return;

    this.pauseVideoAndStopAudioForMic();

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });

      const mimeType = this.pickMimeType();
      this.chunks = [];

      this.recorder = mimeType
        ? new MediaRecorder(this.mediaStream, { mimeType })
        : new MediaRecorder(this.mediaStream);

      this.recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) this.chunks.push(e.data);
      };

      this.recorder.onerror = () => {
        this.zone.run(() => {
          this.handleTranscriptionError('Audio recording error.');
          this.cleanupRecorder();
        });
      };

      this.zone.run(() => {
        this.isListening = true;
        this.showActions = true;
      });

      this.recorder.start();
    } catch {
      this.zone.run(() => {
        this.handleTranscriptionError('Microphone permission denied or not available.');
        this.cleanupRecorder();
      });
    }
  }

  accept() {
    if (!this.recorder || this.uploadInProgress) return;

    this.uploadInProgress = true;

    this.recorder.onstop = async () => {
      try {
        const mime = this.recorder?.mimeType || 'audio/webm';
        const blob = new Blob(this.chunks, { type: mime });

        this.zone.run(() => {
          this.isSpeechProcessing = true;
          this.showActions = false;
          this.isListening = false;
          this.chatForm.get('message')?.setValue('⏳ Converting speech to text...');
        });

        const text = await this.sendToBackendForTranscription(blob);

        this.zone.run(() => {
          this.isSpeechProcessing = false;
          if (text && text.trim()) {
            this.handleTranscriptionAccepted(text.trim());
          } else {
            this.chatForm.get('message')?.setValue('');
          }
        });
      } catch (err: any) {
        this.zone.run(() => {
          this.handleTranscriptionError(
            typeof err?.message === 'string' ? err.message : 'Transcription failed.'
          );
          this.showActions = false;
          this.isListening = false;
        });
      } finally {
        this.uploadInProgress = false;
        this.cleanupRecorder();
      }
    };

    try { this.recorder.stop(); } catch {
      this.uploadInProgress = false;
      this.cleanupRecorder();
    }
  }

  reject() {
    if (this.uploadInProgress) return;

    try { this.recorder?.stop(); } catch { }

    this.zone.run(() => {
      this.handleTranscriptionRejected();
      this.showActions = false;
      this.isListening = false;
    });

    this.cleanupRecorder();
  }

  private async sendToBackendForTranscription(blob: Blob): Promise<string> {
    const url = `${this.apiBaseSrc}/chat_llm/transcribe`;
    const form = new FormData();
    form.append('file', blob, 'speech.webm');

    const res = await fetch(url, { method: 'POST', body: form });

    if (!res.ok) {
      const msg = await res.text().catch(() => '');
      throw new Error(msg || `Transcribe API failed (${res.status}).`);
    }

    const data = await res.json();
    return (data?.text || '').toString();
  }

  private cleanupRecorder() {
    this.recorder = null;
    this.chunks = [];

    if (this.mediaStream) {
      try { this.mediaStream.getTracks().forEach((t) => t.stop()); } catch { }
      this.mediaStream = null;
    }
  }

  @HostListener('document:click', ['$event'])
  handleClickOutside(event: Event) {
    if (!this.showSuggestions || !this.messageInput) return;

    const clickedInside = this.messageInput.nativeElement.contains(event.target);
    if (!clickedInside) {
      this.showSuggestions = false;
      this.suggestionsOpenedByClick = false;
    }
  }

  private handleTranscriptionAccepted(text: string) {
    try {
      this.chatForm.get('message')?.setValue(text);
      setTimeout(() => { this.messageInput?.nativeElement.focus(); }, 0);
    } catch (e) { console.error('handleTranscriptionAccepted error', e); }
  }

  private handleTranscriptionRejected() {
    try { this.chatForm.get('message')?.setValue(''); }
    catch (e) { console.error('handleTranscriptionRejected error', e); }
  }

  private handleTranscriptionError(msg: string) {
    try {
      this.isSpeechProcessing = false;
      this.chatForm.get('message')?.setValue('');

      this.messages.push({
        id: this.messages.length + 1,
        text: `Transcription error: ${msg}`,
        sender: 'bot',
        timestamp: new Date(),
      });

      this.rebuildPairs();
      requestAnimationFrame(() => this.scrollToLastPair());
    } catch (e) { console.error('handleTranscriptionError error', e); }
  }

  private removeTypingPlaceholder(): void {
    const idx = this.messages.findIndex((m: any) => m?._isTyping === true);
    if (idx !== -1) { this.messages.splice(idx, 1); }
    this.rebuildPairs();
  }
}
