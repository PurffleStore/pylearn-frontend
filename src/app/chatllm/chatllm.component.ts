// chatllm.component.ts  (FULL FILE)

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

type UiChatMessage = ChatMessage & {
  rawData?: any;
  _baseText?: string;
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
export class ChatLLMComponent implements OnInit, AfterViewInit {
  @ViewChild('chatContainer') private chatContainer!: ElementRef;
  @ViewChild('messageInput') private messageInput!: ElementRef;
  @ViewChild('videoPlayer') videoRef!: ElementRef<HTMLVideoElement>;

  chatForm: FormGroup;

  messages: UiChatMessage[] = [];
  isTyping = false;

  // ✅ Cached pairs list (DO NOT use getter)
  pairedMessagesList: Array<{ user?: ChatMessage; bot?: any }> = [];
  trackByPair = (index: number) => index;

  // Suggestions
  suggestedQuestions: string[] = [];
  showSuggestions = false;
  allQuestions: Question[] = [];

  private searchQuery = new Subject<string>();
  private followupQuestions: string[] = [];
  private isInputFocused = false;

  // ✅ Only show suggestions if user opened by clicking the input
  private suggestionsOpenedByClick = false;

  // Pair navigation
  currentPairIndex = 0;

  // 🎬 Video sources
  blinkVideoSrc = 'assets/staticchat/blink.mp4';
  introVideoSrc = 'assets/staticchat/intro.mp4';

  // Video state
  currentVideoType: 'blink' | 'intro' | 'response' = 'blink';
  currentResponseVideoUrl: string | null = null;
  isVideoPlaying = false;

  hasChatStarted = false;
  lastResponseVideoUrl: string | null = null;

  // 🔊 Audio player
  private audioPlayer: HTMLAudioElement | null = null;

  // Mic
  supported = false;
  isListening = false; // recording
  showActions = false;

  private isBrowser = false;

  private mediaStream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: BlobPart[] = [];
  private uploadInProgress = false;

  isSpeechProcessing = false;

  apiBaseSrc = environment.apiBaseUrl.replace(/\/+$/, '');

  // ✅ Generic playlist state (works for video, audio, detail, story, example)
  private playlist: string[] = [];
  private playlistIndex = 0;
  private playlistOwnerMsgId?: number | null = null;
  private playlistType: PlaylistType | null = null;
  private playlistLoop = false; // set true if you want loop

  constructor(
    private fb: FormBuilder,
    private chatService: ChatLLMService,
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
    // First bot message
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

    // Optional: load all questions (for searching while typing)
    this.loadAllQuestions();

    // Load initial suggestions list (but DO NOT open dropdown unless user clicks input)
    this.loadInitialSuggestionsFromApi();

    requestAnimationFrame(() => this.scrollToLastPair());
  }

  ngAfterViewInit() {
    this.playBlinkVideo();
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

  /* ================= VIDEO HELPERS ================= */

  private safeVideo(): HTMLVideoElement | null {
    try {
      return this.videoRef.nativeElement;
    } catch {
      return null;
    }
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
    video.play().catch(() => {});

    this.currentVideoType = 'blink';
    this.currentResponseVideoUrl = null;
    this.isVideoPlaying = false;
  }

  playIntroVideo() {
    const video = this.safeVideo();
    if (!video) return;

    // Pause audio if any
    if (this.audioPlayer && !this.audioPlayer.paused) {
      this.audioPlayer.pause();
    }

    video.onended = () => this.playBlinkVideo();

    video.src = this.introVideoSrc;
    video.loop = false;
    video.muted = false;
    video.currentTime = 0;

    video
      .play()
      .then(() => {
        this.currentVideoType = 'intro';
        this.currentResponseVideoUrl = null;
        this.isVideoPlaying = true;
      })
      .catch(() => {
        video.muted = true;
        video.play().catch(() => {});
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

    // Stop audio if playing (so video audio is clean)
    if (this.audioPlayer && !this.audioPlayer.paused) {
      this.audioPlayer.pause();
      try {
        this.audioPlayer.currentTime = 0;
      } catch {}
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

    // Note: playlist will overwrite onended when it needs chaining
    video.onended = () => this.playBlinkVideo();

    this.currentVideoType = 'response';
    this.currentResponseVideoUrl = url;

    video
      .play()
      .then(() => {
        this.isVideoPlaying = true;
      })
      .catch(() => {
        video.muted = true;
        video.play().catch(() => {});
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
      if (this.lastResponseVideoUrl) {
        this.playResponseVideo(this.lastResponseVideoUrl);
      }
      return;
    }

    if (video.paused) {
      if (this.audioPlayer && !this.audioPlayer.paused) {
        this.audioPlayer.pause();
        try {
          this.audioPlayer.currentTime = 0;
        } catch {}
      }

      video.play().catch(() => {});
      this.isVideoPlaying = true;
    } else {
      video.pause();
      this.isVideoPlaying = false;
    }
  }

  /* ================= PLAYLIST (ONE-BUTTON PER TYPE) ================= */

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

  private getTextForIndex(botMsg: UiChatMessage, type: 'detail' | 'story' | 'example', idx: number): string {
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

    // stop any previous playlist
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

    // If user started another playlist/message, stop chaining
    if (this.playlistOwnerMsgId !== botMsg.id) {
      this.stopCurrentPlaylist();
      return;
    }

    const idx = Math.max(0, Math.min(this.playlistIndex, this.playlist.length - 1));
    const url = this.playlist[idx];

    // ✅ AUDIO playlist
    if (this.playlistType === 'audio') {
      this.playAudio(url);

      if (this.audioPlayer) {
        this.audioPlayer.onended = () => {
          if (this.playlistOwnerMsgId !== botMsg.id) return;
          this.playNextInPlaylist(botMsg);
        };
      }
      return;
    }

    // ✅ VIDEO playlist (video/detail/story/example)
    const type = this.playlistType;

    const showText = (type === 'detail' || type === 'story' || type === 'example');
    const contentText = showText
      ? this.getTextForIndex(botMsg, type as any, idx)
      : (botMsg?._baseText || botMsg.text);

    this.lastResponseVideoUrl = url;

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
      error: (error) => {
        console.error('Error loading questions:', error);
        this.allQuestions = [];
      },
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
      this.showSuggestions = this.suggestionsOpenedByClick && this.suggestedQuestions.length > 0;
      return;
    }

    const q = (query || '').trim().toLowerCase();
    if (!q) {
      this.showQuestionSuggestions(true);
      return;
    }

    const filtered = this.allQuestions
      .filter((x) => (x.question || '').toLowerCase().includes(q))
      .slice(0, 5);

    this.suggestedQuestions = filtered.map((x) => x.question);
    this.showSuggestions = this.suggestionsOpenedByClick && this.suggestedQuestions.length > 0;
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

  // stop current playlist + audio
  this.stopCurrentPlaylist();
  this.stopAudio();

  // Push user message
  this.messages.push({
    id: this.messages.length + 1,
    text: message,
    sender: 'user',
    timestamp: new Date(),
  });

  this.hasChatStarted = true;
  this.chatForm.reset();
  this.showSuggestions = false;

  // ✅ Add typing placeholder as a BOT message (so it will be visible)
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
      // ✅ Remove typing placeholder
      this.removeTypingPlaceholder();

      const botText = response?.answer
        ? String(response.answer).replace(/\n/g, ' ')
        : String(response?.message || 'Sorry, I could not find an answer.');

      const botMessage: UiChatMessage = {
        id: this.messages.length + 1,
        text: botText,
        sender: 'bot',
        timestamp: new Date(),
        rawData: response,
        _baseText: botText,
        _activeContentType: null,
        _activeContentText: null,
        _activeMediaIndex: 0,
        _mediaType: 'main',
      };

      this.messages.push(botMessage);

      this.rebuildPairs();
      requestAnimationFrame(() => this.scrollToLastPair());

      // OPTIONAL: auto-play main videos playlist
      const hasVideos = (response?.video_urls?.length > 0) || !!response?.video_url;
      if (hasVideos) {
        this.startPlaylist(botMessage, 'video');
      }

      // Followups
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
      // ✅ Remove typing placeholder
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
      // Pause video (if not blink) so audio is clear
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

      // ✅ Important: playlist will set onended when it needs chaining
      this.audioPlayer.onended = null;

      this.audioPlayer.play().catch(() => {});
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
    } catch {}
  }

  /* ================= SCROLL (NO JUMP) ================= */

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

          container.scrollTo({
            top: delta,
            behavior: 'smooth',
          });

          this.currentPairIndex = idx;
        } catch {}
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
    const next = Math.min(this.currentPairIndex + 1, total - 1);
    this.scrollToPair(next);
  }

  showPreviousPair() {
    const total = this.pairedMessagesList.length;
    if (total === 0) return;
    const prev = Math.max(this.currentPairIndex - 1, 0);
    this.scrollToPair(prev);
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
          this.handleTranscriptionError(typeof err?.message === 'string' ? err.message : 'Transcription failed.');
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

  reject() {
    if (this.uploadInProgress) return;

    try {
      this.recorder?.stop();
    } catch {}

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
      try {
        this.mediaStream.getTracks().forEach((t) => t.stop());
      } catch {}
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
      setTimeout(() => {
        this.messageInput?.nativeElement.focus();
      }, 0);
    } catch (e) {
      console.error('handleTranscriptionAccepted error', e);
    }
  }

  private handleTranscriptionRejected() {
    try {
      this.chatForm.get('message')?.setValue('');
    } catch (e) {
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
        timestamp: new Date(),
      });

      this.rebuildPairs();
      requestAnimationFrame(() => this.scrollToLastPair());
    } catch (e) {
      console.error('handleTranscriptionError error', e);
    }
  }

  private removeTypingPlaceholder(): void {
  const idx = this.messages.findIndex((m: any) => m?._isTyping === true);
  if (idx !== -1) {
    this.messages.splice(idx, 1);
  }
  this.rebuildPairs();
}
}