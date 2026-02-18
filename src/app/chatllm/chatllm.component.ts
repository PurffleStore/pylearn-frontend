// staticchat.component.ts
import {
  Component,
  OnInit,
  ViewChild,
  ElementRef,
  HostListener,
  AfterViewInit,
  Inject,
  NgZone,
  PLATFORM_ID,
} from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ChatLLMService, ChatMessage, SearchResponse, Question } from './chatllm.service';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { isPlatformBrowser } from '@angular/common';
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

@Component({
  selector: 'app-chatllm',
  templateUrl: './chatllm.component.html',
  styleUrls: ['./chatllm.component.css']
})
export class ChatLLMComponent implements OnInit, AfterViewInit {

  @ViewChild('chatContainer') private chatContainer!: ElementRef;
  @ViewChild('messageInput') private messageInput!: ElementRef;
  @ViewChild('videoPlayer') videoRef!: ElementRef<HTMLVideoElement>;

  chatForm: FormGroup;
  messages: (ChatMessage & { 
    suggestions?: string[],
    _baseText?: string,
    _activeContentType?: string | null,
    _activeContentText?: string | null,
    _activeMediaIndex?: number,
    _mediaType?: string
  })[] = [];
  isTyping = false;

  // ✅ Suggestions shown near input (same place always)
  suggestedQuestions: string[] = [];
  showSuggestions = false;

  // Optional local list for search/autocomplete while typing
  allQuestions: Question[] = [];

  searchQuery = new Subject<string>();
  selectedQuestions: Set<string> = new Set();

  // ✅ Follow-ups from backend (/ask response)
  followupQuestions: string[] = [];

  // navigation index for pair view
  currentPairIndex = 0;

  // 🎬 Video sources
  blinkVideoSrc = 'assets/staticchat/blink.mp4';
  introVideoSrc = 'assets/staticchat/intro.mp4';

  // Video state
  currentVideoType: 'blink' | 'intro' | 'response' = 'blink';
  currentResponseVideoUrl: string | null = null;
  isVideoPlaying = false;

  // audio player for response audio
  private audioPlayer: HTMLAudioElement | null = null;

  hasChatStarted = false;
  lastResponseVideoUrl: string | null = null;

  supported = false;
  isListening = false; // treat this as "isRecording"
  showActions = false;

  private isBrowser = false;

  private mediaStream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: BlobPart[] = [];

  private uploadInProgress = false;
  isSpeechProcessing = false;

  constructor(
    private fb: FormBuilder,
    private chatService: ChatLLMService,
    @Inject(PLATFORM_ID) platformId: object,
    private zone: NgZone
  ) {
    this.chatForm = this.fb.group({
      message: ['', Validators.required]
    });

    this.searchQuery.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(query => {
      this.searchQuestions(query);
    });

    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit() {
    this.messages.push({
      id: 1,
      text: 'Hello children! Today we will learn tenses in a simple and fun way.',
      sender: 'bot',
      timestamp: new Date()
    });

    if (!this.isBrowser) return;

    const hasGetUserMedia = !!navigator.mediaDevices?.getUserMedia;
    const hasMediaRecorder = typeof (window as any).MediaRecorder !== 'undefined';
    this.supported = hasGetUserMedia && hasMediaRecorder;

    // Optional: load all questions (for search while typing)
    this.loadAllQuestions();

    // ✅ Load initial suggestions from backend (/api/suggestions)
    this.loadInitialSuggestionsFromApi();

    // start at last pair by default
    setTimeout(() => this.scrollToLastPair(), 0);
  }

  ngAfterViewInit() {
    this.playBlinkVideo();
  }

  /* ================= VIDEO CONTROL HELPERS ================= */

  private safeVideo(): HTMLVideoElement | null {
    try { return this.videoRef.nativeElement; } catch { return null; }
  }

  // Idle blink loop — keep playing but show PLAY icon in UI
  playBlinkVideo() {
    const video = this.safeVideo();
    if (!video) return;

    video.onended = null;
    video.src = this.blinkVideoSrc;
    video.loop = true;
    video.muted = true;
    video.currentTime = 0;
    video.play().catch(() => { /* ignore autoplay failure for idle */ });

    this.currentVideoType = 'blink';
    this.currentResponseVideoUrl = null;
    this.isVideoPlaying = false;
  }

  // Load and start intro
  playIntroVideo() {
    const video = this.safeVideo();
    if (!video) return;

    if (this.audioPlayer && !this.audioPlayer.paused) { this.audioPlayer.pause(); }

    video.onended = () => {
      this.playBlinkVideo();
    };

    video.src = this.introVideoSrc;
    video.loop = false;
    video.muted = false;
    video.currentTime = 0;
    video.play().catch(() => {
      video.muted = true;
      video.play().catch(() => { /* ignore */ });
    });

    this.currentVideoType = 'intro';
    this.currentResponseVideoUrl = null;
    this.isVideoPlaying = true;
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

    // Update bot message text
    if (botMsg) {
      botMsg._baseText = botMsg._baseText ?? botMsg.text;
      botMsg._activeMediaIndex = index;
      botMsg._mediaType = contentType;

      if (isShowText) {
        botMsg._activeContentType = contentType;
        botMsg.text = showText || 'No text available.';
      } else {
        botMsg._activeContentType = 'main';
        botMsg.text = botMsg._baseText;
      }
    }

    const video = this.safeVideo();
    if (!video) return;

    // stop audio if playing
    if (this.audioPlayer && !this.audioPlayer.paused) {
      this.audioPlayer.pause();
    }

    video.pause();

    const absUrl = new URL(url, window.location.href).href;
    if (video.src !== absUrl) {
      video.src = url;
    }

    video.loop = false;
    video.muted = false;
    video.currentTime = 0;
    video.load();

    video.onended = () => this.playBlinkVideo();

    this.currentVideoType = 'response';
    this.currentResponseVideoUrl = url;

    video.play().then(() => {
      this.isVideoPlaying = true;
    }).catch(() => {
      video.muted = true;
      video.play().catch(() => {});
      this.isVideoPlaying = !video.paused;
    });
  }

  // Cycle through multiple media items
// Cycle through multiple media items
cycleMedia(botMsg: any, mediaType: string, indexChange: number = 1) {
  if (!botMsg?.rawData) return;
  
  const rawData = botMsg.rawData;
  const mediaKey = mediaType + '_urls';
  const textKey = mediaType + '_texts';
  
  // Check if we have multiple items with proper null check
  if (!rawData[mediaKey]?.length) return;
  
  const currentIndex = botMsg._activeMediaIndex || 0;
  const totalItems = rawData[mediaKey].length;
  
  // Calculate new index
  let newIndex = (currentIndex + indexChange + totalItems) % totalItems;
  botMsg._activeMediaIndex = newIndex;
  botMsg._mediaType = mediaType;
  
  // Get the URL and text for this index
  const url = rawData[mediaKey][newIndex];
  const text = rawData[textKey]?.[newIndex] || `Content ${newIndex + 1}`;
  
  // Play the video/show text
  this.playResponseVideo(url, true, text, botMsg, mediaType as any, newIndex);
}

  // Top-right button behavior:
  // - If blink is running → start intro.
  // - If intro/response loaded → toggle play/pause for that loaded video.
  togglePlayPause() {
    const video = this.safeVideo();
    if (!video) return;

    if (this.currentVideoType === 'blink') {
      // Before first question → intro
      if (!this.hasChatStarted) {
        this.playIntroVideo();
        return;
      }

      // After chat started → do NOT play intro again
      // Replay last response video if available
      if (this.lastResponseVideoUrl) {
        this.playResponseVideo(this.lastResponseVideoUrl);
      }
      return;
    }

    // If user is starting/resuming a video, pause any playing audio first
    if (video.paused) {
      if (this.audioPlayer && !this.audioPlayer.paused) {
        this.audioPlayer.pause();
      }
      video.play().catch(() => { /* ignore */ });
      this.isVideoPlaying = true;
    } else {
      video.pause();
      this.isVideoPlaying = false;
    }
  }

  /* ================= SUGGESTIONS (API) ================= */

  // ✅ Initial top 5 from backend: GET /api/suggestions
  private loadInitialSuggestionsFromApi() {
    this.chatService.getSuggestions().subscribe({
      next: (res) => {
        const list = (res?.suggestions || []).map(s => s.question).filter(Boolean);
        this.suggestedQuestions = list.slice(0, 5);
        this.showSuggestions = this.suggestedQuestions.length > 0;
      },
      error: () => {
        this.suggestedQuestions = [];
        this.showSuggestions = false;
      }
    });
  }

  /* ================= CHAT SYSTEM ================= */

  loadAllQuestions() {
    this.chatService.getAllQuestions().subscribe({
      next: (response) => {
        if (response.success) {
          this.allQuestions = response.questions;
        }
      },
      error: (error) => console.error('Error loading questions:', error)
    });
  }

  onInputFocus() { this.showQuestionSuggestions(); }
  onInputClick() { this.showQuestionSuggestions(); }

  // ✅ Same place for suggestions:
  // - If followups exist -> show followups
  // - Else -> show initial suggestions from backend
  showQuestionSuggestions() {
    const currentInput = (this.chatForm.get('message')?.value || '').trim();

    // While typing -> local autocomplete (optional)
    if (currentInput.length > 0) {
      this.searchQuestions(currentInput);
      return;
    }

    // If followups exist -> show them
    if (this.followupQuestions.length > 0) {
      this.suggestedQuestions = this.followupQuestions.slice(0, 5);
      this.showSuggestions = this.suggestedQuestions.length > 0;
      return;
    }

    // Else show initial top 5 from backend
    this.loadInitialSuggestionsFromApi();
  }

  // Optional: local search when user types
  searchQuestions(query: string) {
    if (!this.allQuestions || this.allQuestions.length === 0) {
      // if not loaded, just show initial suggestions
      this.loadInitialSuggestionsFromApi();
      return;
    }

    if (query.length > 0) {
      const filtered = this.allQuestions
        .filter(q => q.question.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 5);

      this.suggestedQuestions = filtered.map(q => q.question);
      this.showSuggestions = this.suggestedQuestions.length > 0;
    } else {
      this.showQuestionSuggestions();
    }
  }

  onInputChange() {
    const query = this.chatForm.get('message')?.value;
    query ? this.searchQuery.next(query) : this.showQuestionSuggestions();
  }

  // Click on suggestion -> ask immediately
  selectQuestion(question: string) {
    this.selectedQuestions.add(question);
    this.chatForm.get('message')?.setValue(question);
    this.showSuggestions = false;
    this.suggestedQuestions = this.suggestedQuestions.filter(q => q !== question);
    this.sendMessage();
  }

  sendMessage() {
  const message = (this.chatForm.get('message')?.value || '').trim();
  if (!message) return;

  // 1) Push user message
  this.messages.push({
    id: this.messages.length + 1,
    text: message,
    sender: 'user',
    timestamp: new Date()
  });

  this.hasChatStarted = true;
  this.chatForm.reset();
  this.showSuggestions = false;
  this.isTyping = true;

  setTimeout(() => this.scrollToLastPair(), 50);

  // 2) Call backend
  this.chatService.searchQuestion(message).subscribe({
    next: (response: SearchResponse & Partial<MediaCollection>) => {
      this.isTyping = false;

      const botText = response.answer
        ? response.answer.replace(/\n/g, ' ')
        : (response.message || 'Sorry, I could not find an answer.');

      // ✅ 3) Push bot message with extra fields and media collections
      const botMessage: any = {
        id: this.messages.length + 1,
        text: botText,
        sender: 'bot',
        timestamp: new Date(),
        rawData: response,

        // Store original answer once
        _baseText: botText,
        _activeContentType: null,
        _activeContentText: null,
        
        // Track which media item is currently active (for multi-media)
        _activeMediaIndex: 0,
        _mediaType: 'main'
      };

      this.messages.push(botMessage);

      setTimeout(() => this.scrollToLastPair(), 50);

      // 4) Handle multiple audio/video files with proper null checks
      
      // Play first audio if multiple exist
      if (response.audio_urls?.length) {
        this.playAudio(response.audio_urls[0]);
      } else if (response.audio_url) {
        this.playAudio(response.audio_url);
      }
      
      // Handle multiple videos
      if (response.video_urls?.length) {
        this.lastResponseVideoUrl = response.video_urls[0];
        this.playResponseVideo(
          response.video_urls[0], 
          false, 
          response.answer, 
          botMessage, 
          'main',
          0
        );
      } else if (response.video_url) {
        this.lastResponseVideoUrl = response.video_url;
        this.playResponseVideo(response.video_url, false, response.answer, botMessage, 'main');
      }

      // 5) Update suggestions area with followups
      if ((response as any).followups?.length) {
        this.followupQuestions = (response as any).followups
          .map((f: any) => f.question)
          .filter(Boolean)
          .slice(0, 5);

        this.suggestedQuestions = this.followupQuestions;
        this.showSuggestions = this.suggestedQuestions.length > 0;
      } else {
        this.followupQuestions = [];
        this.loadInitialSuggestionsFromApi();
      }
    },

    error: () => {
      this.isTyping = false;

      this.messages.push({
        id: this.messages.length + 1,
        text: 'Sorry, I encountered an error. Please try again.',
        sender: 'bot',
        timestamp: new Date()
      });

      setTimeout(() => this.scrollToLastPair(), 50);

      this.followupQuestions = [];
      this.loadInitialSuggestionsFromApi();
    }
  });
}

  // Updated showContentText for multiple items
 // Updated showContentText for multiple items
showContentText(pair: { user?: ChatMessage, bot?: any }, type: 'detail' | 'story' | 'example') {
  if (!pair.bot?.rawData) return;

  const urlsKey = type + '_urls';
  const textsKey = type + '_texts';

  const urls = pair.bot.rawData[urlsKey];
  const texts = pair.bot.rawData[textsKey];

  // If multiple items exist with proper null check
  if (urls?.length > 1) {
    // If clicking same type, cycle to next
    if (pair.bot._activeContentType === type) {
      const currentIndex = pair.bot._activeMediaIndex || 0;
      const nextIndex = (currentIndex + 1) % urls.length;
      
      pair.bot._activeMediaIndex = nextIndex;
      pair.bot._activeContentType = type;
      pair.bot._activeContentText = texts?.[nextIndex] || `Content ${nextIndex + 1}`;
      pair.bot.text = texts?.[nextIndex] || `Content ${nextIndex + 1}`;
      
      // Play corresponding video
      if (urls[nextIndex]) {
        this.playResponseVideo(urls[nextIndex], true, pair.bot._activeContentText, pair.bot, type, nextIndex);
      }
    } else {
      // First time clicking this type - show first item
      pair.bot._activeMediaIndex = 0;
      pair.bot._activeContentType = type;
      pair.bot._activeContentText = texts?.[0] || 'No text available.';
      pair.bot.text = texts?.[0] || 'No text available.';
      
      if (urls[0]) {
        this.playResponseVideo(urls[0], true, pair.bot._activeContentText, pair.bot, type, 0);
      }
    }
  } else {
    // Single item - original behavior
    const textKey = type + '_text';
    const urlKey = type + '_url';

    const text = pair.bot.rawData[textKey];
    const url = pair.bot.rawData[urlKey];

    if (pair.bot._activeContentType === type) {
      pair.bot._activeContentType = null;
      pair.bot._activeContentText = null;
      pair.bot.text = pair.bot._baseText;
    } else {
      pair.bot._activeContentType = type;
      pair.bot._activeContentText = text || 'No text available.';
      pair.bot.text = text || 'No text available.';
    }

    if (url) {
      this.playResponseVideo(url);
    }
  }
}

  // Play audio directly
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
      this.audioPlayer.play().catch(() => { /* ignore autoplay errors */ });
    } catch (e) {
      console.error('Audio play failed', e);
    }
  }

  playVideoFromChat(url?: string) {
    if (!url) return;
    this.playResponseVideo(url);
  }

  formatAnswer(response: SearchResponse): string {
    let html = '';

    const answerText = response.answer?.replace(/\n/g, '<br>') ?? 'No answer available.';
    html += `<div class="bot-answer">${answerText}</div>`;

    if (response.audio_url || response.video_url) {
      html += `<div class="media-row">`;

      if (response.audio_url) {
        html += `
        <span class="media-icon"
              onclick="window.dispatchEvent(new CustomEvent('playAudio', { detail: '${response.audio_url}' }))">
          🎧
        </span>`;
      }

      if (response.video_url) {
        html += `
        <span class="media-icon"
              onclick="window.dispatchEvent(new CustomEvent('playVideo', { detail: '${response.video_url}' }))">
          📺
        </span>`;
      }

      html += `</div>`;
    }

    return html;
  }

  formatErrorMessage(response: SearchResponse): string {
    let message = response.message || "I couldn't find an exact match.";

    const sampleQuestions = (response as any)?.sample_questions as string[] | undefined;
    if (sampleQuestions?.length) {
      message += '<br><br><strong>Try asking:</strong><ul>';
      sampleQuestions.forEach(q => message += `<li>${q}</li>`);
      message += '</ul>';
    }

    return message;
  }

  // Build pairs: each pair is { user?: ChatMessage, bot?: ChatMessage }
  get pairedMessages(): Array<{ user?: ChatMessage, bot?: any }> {
    const pairs: Array<{ user?: ChatMessage, bot?: any }> = [];
    const msgs = this.messages || [];
    let i = 0;
    while (i < msgs.length) {
      const current = msgs[i];
      if (current.sender === 'user') {
        const pair: { user?: ChatMessage, bot?: any } = { user: current };
        const next = msgs[i + 1];
        if (next && next.sender === 'bot') {
          pair.bot = next;
          i += 2;
        } else {
          i += 1;
        }
        pairs.push(pair);
      } else if (current.sender === 'bot') {
        pairs.push({ bot: current });
        i += 1;
      } else {
        pairs.push({ bot: current });
        i += 1;
      }
    }
    return pairs;
  }

  // Scroll helpers for pair navigation
  showNextPair() {
    const total = this.pairedMessages.length;
    if (total === 0) return;
    const next = Math.min(this.currentPairIndex + 1, total - 1);
    this.scrollToPair(next);
  }

  showPreviousPair() {
    const total = this.pairedMessages.length;
    if (total === 0) return;
    const prev = Math.max(this.currentPairIndex - 1, 0);
    this.scrollToPair(prev);
  }

  private scrollToPair(index: number) {
    setTimeout(() => {
      try {
        const container = this.chatContainer.nativeElement as HTMLElement;
        const pairs = container.querySelectorAll('.pair');
        if (!pairs || pairs.length === 0) return;
        if (index < 0) index = 0;
        if (index >= pairs.length) index = pairs.length - 1;
        const target = pairs[index] as HTMLElement;
        if (!target) return;
        container.scrollTo({ top: target.offsetTop, behavior: 'smooth' });
        this.currentPairIndex = index;
      } catch (e) {
        try {
          const container = this.chatContainer.nativeElement as HTMLElement;
          if (index === 0) container.scrollTop = 0;
          else container.scrollTop = container.scrollHeight;
        } catch { }
      }
    }, 50);
  }

  private scrollToLastPair(): void {
    setTimeout(() => {
      try {
        const total = this.pairedMessages.length;
        if (total === 0) return;
        this.scrollToPair(total - 1);
      } catch { }
    }, 50);
  }

  scrollToTop(): void {
    setTimeout(() => {
      try {
        const el = this.chatContainer.nativeElement as HTMLElement;
        if (typeof el.scrollTo === 'function') {
          el.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          el.scrollTop = 0;
        }
      } catch { }
    }, 100);
  }

  clearChat() {
    this.messages = [];
    this.selectedQuestions.clear();

    this.hasChatStarted = false;
    this.lastResponseVideoUrl = null;

    // ✅ reset followups + suggestions
    this.followupQuestions = [];
    this.suggestedQuestions = [];
    this.showSuggestions = false;

    this.ngOnInit();
    this.playBlinkVideo();
  }

  /* ================= MIC / SPEECH (UNCHANGED) ================= */

  private pickMimeType(): string {
    const w: any = window;

    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/m4a',
    ];

    if (!w.MediaRecorder?.isTypeSupported) return '';
    for (const t of types) {
      if (w.MediaRecorder.isTypeSupported(t)) return t;
    }
    return '';
  }

  async toggleMic() {
    if (!this.supported || this.isListening || this.uploadInProgress) return;

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
    } catch (e: any) {
      this.zone.run(() => {
        this.handleTranscriptionError('Microphone permission denied or not available.');
        this.cleanupRecorder();
      });
    }
  }

  // ✅ Stop + transcribe
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

    try {
      this.recorder.stop();
    } catch {
      this.uploadInProgress = false;
      this.cleanupRecorder();
    }
  }

  // ❌ Stop + discard
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

  apiBaseSrc = environment.apiBaseUrl.replace(/\/+$/, '');
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
    try { this.recorder?.removeEventListener?.('dataavailable', () => { }); } catch { }

    this.recorder = null;
    this.chunks = [];

    if (this.mediaStream) {
      try { this.mediaStream.getTracks().forEach((t) => t.stop()); } catch { }
      this.mediaStream = null;
    }
  }

  @HostListener('document:click', ['$event'])
  handleClickOutside(event: Event) {
    if (this.showSuggestions && this.messageInput) {
      const clickedInside = this.messageInput.nativeElement.contains(event.target);
      if (!clickedInside) this.showSuggestions = false;
    }
  }

  /* ========== Internal handlers ========== */

  private handleTranscriptionAccepted(text: string) {
    try {
      this.chatForm.get('message')?.setValue(text);
      setTimeout(() => {
        this.messageInput?.nativeElement.focus();
      }, 0);
    } catch (e) {
      console.error('handleTranscriptionAccepted error', e);
    }
  }

  private handleTranscriptionRejected() {
    try { this.chatForm.get('message')?.setValue(''); } catch (e) {
      console.error('handleTranscriptionRejected error', e);
    }
  }

  private handleTranscriptionError(msg: string) {
    try {
      this.isSpeechProcessing = false;
      this.chatForm.get('message')?.setValue('');

      this.messages.push({
        id: this.messages.length + 1,
        text: `Transcription error: ${msg}`,
        sender: 'bot',
        timestamp: new Date()
      });
      setTimeout(() => this.scrollToLastPair(), 50);
    } catch (e) {
      console.error('handleTranscriptionError error', e);
    }
  }
}