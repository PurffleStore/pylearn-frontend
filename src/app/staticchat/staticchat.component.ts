// (file header unchanged)
import { Component, OnInit, ViewChild, ElementRef, HostListener, AfterViewInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ChatService, ChatMessage, SearchResponse, Question } from './staticchat.service';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { isPlatformBrowser } from '@angular/common';
import {
  Inject,
  NgZone,
  PLATFORM_ID,
} from '@angular/core';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-staticchat',
  templateUrl: './staticchat.component.html',
  styleUrls: ['./staticchat.component.css']
})
export class StaticChatComponent implements OnInit, AfterViewInit {

  @ViewChild('chatContainer') private chatContainer!: ElementRef;
  @ViewChild('messageInput') private messageInput!: ElementRef;
  @ViewChild('videoPlayer') videoRef!: ElementRef<HTMLVideoElement>;

  chatForm: FormGroup;
  messages: (ChatMessage & { suggestions?: string[] })[] = [];
  isTyping = false;
  suggestedQuestions: string[] = [];
  showSuggestions = false;
  allQuestions: Question[] = [];
  searchQuery = new Subject<string>();
  selectedQuestions: Set<string> = new Set();

  // navigation index for pair view
  currentPairIndex = 0;

  // 🎬 Video sources
  blinkVideoSrc = 'assets/staticchat/blink.mp4';
  introVideoSrc = 'assets/staticchat/intro.mp4';

  // Video state
  // 'blink' | 'intro' | 'response' to indicate currently loaded video type
  currentVideoType: 'blink' | 'intro' | 'response' = 'blink';
  currentResponseVideoUrl: string | null = null;
  // whether the currently loaded non-idle video is playing
  isVideoPlaying = false;

  // audio player for response audio
  private audioPlayer: HTMLAudioElement | null = null;
  hasChatStarted = false;
  lastResponseVideoUrl: string | null = null;

  supported = false;
  isListening = false; // we will treat this as "isRecording"
  showActions = false;

  private isBrowser = false;

  private mediaStream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: BlobPart[] = [];

  private uploadInProgress = false;
  isSpeechProcessing = false;

  constructor(
    private fb: FormBuilder,
    private chatService: ChatService,
    @Inject(PLATFORM_ID) platformId: object, private zone: NgZone
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

    this.loadAllQuestions();

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
    // For blink we show the Play icon, so set isVideoPlaying = false
    this.isVideoPlaying = false;
  }

  // Load and start intro (user intends to watch intro)
  playIntroVideo() {
    const video = this.safeVideo();
    if (!video) return;

    // stop any audio
    if (this.audioPlayer && !this.audioPlayer.paused) { this.audioPlayer.pause(); }

    video.onended = () => {
      this.playBlinkVideo();
    };

    video.src = this.introVideoSrc;
    video.loop = false;
    video.muted = false;
    video.currentTime = 0;
    video.play().catch(() => {
      // fallback muted play if autoplay blocked
      video.muted = true;
      video.play().catch(() => { /* ignore */ });
    });

    this.currentVideoType = 'intro';
    this.currentResponseVideoUrl = null;
    this.isVideoPlaying = true;
  }

  // Play a response video (from chat) in the same player.
  // After the response ends return to blink.
  playResponseVideo(url?: string) {
    if (!url) return;
    const video = this.safeVideo();
    if (!video) return;

    // stop any audio
    if (this.audioPlayer && !this.audioPlayer.paused) { this.audioPlayer.pause(); }

    video.onended = () => {
      this.playBlinkVideo();
    };

    this.currentResponseVideoUrl = url;
    this.currentVideoType = 'response';

    video.src = url;
    video.loop = false;
    video.muted = false;
    video.currentTime = 0;
    video.play().then(() => {
      this.isVideoPlaying = true;
    }).catch(() => {
      // If autoplay blocked, try muted play as fallback
      video.muted = true;
      video.play().catch(() => { /* ignore */ });
      // set state according to actual playing state
      this.isVideoPlaying = !video.paused;
    });
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

  showQuestionSuggestions() {
    if (this.allQuestions.length === 0) {
      this.loadAllQuestions();
      return;
    }

    if (this.messages.length <= 1) {
      this.suggestedQuestions = this.allQuestions.slice(0, 5).map(q => q.question);
      this.showSuggestions = true;
      return;
    }

    const unselected = this.allQuestions.filter(q => !this.selectedQuestions.has(q.question));

    if (unselected.length === 0) {
      const shuffled = [...this.allQuestions].sort(() => 0.5 - Math.random());
      this.suggestedQuestions = shuffled.slice(0, 5).map(q => q.question);
    } else {
      this.suggestedQuestions = unselected.slice(0, 5).map(q => q.question);
    }

    this.showSuggestions = true;
  }

  searchQuestions(query: string) {
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

  selectQuestion(question: string) {
    this.selectedQuestions.add(question);
    this.chatForm.get('message')?.setValue(question);
    this.showSuggestions = false;
    this.suggestedQuestions = this.suggestedQuestions.filter(q => q !== question);
    this.sendMessage();
  }

  sendMessage() {
    const message = this.chatForm.get('message')?.value.trim();
    if (!message) return;

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

    // show the pair containing this user message (may be a user-only pair until bot replies)
    setTimeout(() => this.scrollToLastPair(), 50);

    this.chatService.searchQuestion(message).subscribe({
      next: (response: SearchResponse) => {
        this.isTyping = false;

        const botText = response.answer
          ? response.answer.replace(/\n/g, ' ')
          : (response.message || 'Sorry, I could not find an answer.');

        this.messages.push({
          id: this.messages.length + 1,
          text: botText,
          sender: 'bot',
          timestamp: new Date(),
          rawData: response
        });

        // scroll to the new pair (user+bot)
        setTimeout(() => this.scrollToLastPair(), 50);

        // Play audio/video returned by the response
        if (response.audio_url) {
          this.playAudio(response.audio_url);
        }
        if (response.video_url) {
          this.lastResponseVideoUrl = response.video_url; // ✅ remember it
          this.playResponseVideo(response.video_url);
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
      }
    });
  }

  // Play audio directly (uses a single HTMLAudioElement instance)
  playAudio(url?: string) {
    if (!url) return;
    try {
      const video = this.safeVideo();
      // If a non-idle video is currently playing, pause it before starting audio
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

  // helper used by template to play video for a chat item
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

    if (response.sample_questions?.length) {
      message += '<br><br><strong>Try asking:</strong><ul>';
      response.sample_questions.forEach(q => message += `<li>${q}</li>`);
      message += '</ul>';
    }

    return message;
  }

  // Build pairs: each pair is { user?: ChatMessage, bot?: ChatMessage }
  get pairedMessages(): Array<{ user?: ChatMessage, bot?: ChatMessage }> {
    const pairs: Array<{ user?: ChatMessage, bot?: ChatMessage }> = [];
    const msgs = this.messages || [];
    let i = 0;
    while (i < msgs.length) {
      const current = msgs[i];
      if (current.sender === 'user') {
        const pair: { user?: ChatMessage, bot?: ChatMessage } = { user: current };
        const next = msgs[i + 1];
        if (next && next.sender === 'bot') {
          pair.bot = next;
          i += 2;
        } else {
          i += 1;
        }
        pairs.push(pair);
      } else if (current.sender === 'bot') {
        // bot message without preceding user (welcome message, errors, etc.)
        pairs.push({ bot: current });
        i += 1;
      } else {
        // fallback: add as single
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
        // fallback: scroll to bottom/top
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
        // Use smooth scroll if supported, otherwise fall back to direct assignment
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

    this.ngOnInit();
    this.playBlinkVideo();
  }


  private pickMimeType(): string {
    const w: any = window;

    // Try in order. Different browsers support different types.
    const types = [
      'audio/webm;codecs=opus', // Chrome/Edge/Firefox (best)
      'audio/webm',
      'audio/mp4',              // Safari (sometimes)
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
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
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

    // We need the blob only after "stop" finishes
    this.recorder.onstop = async () => {
      try {
        const mime = this.recorder?.mimeType || 'audio/webm';
        const blob = new Blob(this.chunks, { type: mime });

        // 🔄 Show loading state in input
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
      // If stop fails, still cleanup
      this.uploadInProgress = false;
      this.cleanupRecorder();
    }
  }

  // ❌ Stop + discard
  reject() {
    if (this.uploadInProgress) return;

    try {
      this.recorder?.stop();
    } catch { }

    this.zone.run(() => {
      this.handleTranscriptionRejected();
      this.showActions = false;
      this.isListening = false;
    });

    this.cleanupRecorder();
  }
  apiBaseSrc = environment.apiBaseUrl.replace(/\/+$/, '');
  private async sendToBackendForTranscription(blob: Blob): Promise<string> {
    // Change this URL if your backend route is different
    //const url = 'http://localhost:5000/api/transcribe';
   

    

    const url = `${this.apiBaseSrc}/staticchat/transcribe`;

    const form = new FormData();
    // Keep extension generic; backend can read mimetype
    form.append('file', blob, 'speech.webm');

    const res = await fetch(url, {
      method: 'POST',
      body: form,
    });

    if (!res.ok) {
      const msg = await res.text().catch(() => '');
      throw new Error(msg || `Transcribe API failed (${res.status}).`);
    }

    const data = await res.json();
    // Expect { text: "..." }
    return (data?.text || '').toString();
  }

  private cleanupRecorder() {
    try {
      this.recorder?.removeEventListener?.('dataavailable', () => { });
    } catch { }

    this.recorder = null;
    this.chunks = [];

    if (this.mediaStream) {
      try {
        this.mediaStream.getTracks().forEach((t) => t.stop());
      } catch { }
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

  /* ========== Internal handlers (replace Outputs) ========== */

  private handleTranscriptionAccepted(text: string) {
    try {
      // Put recognized text into input field ONLY
      this.chatForm.get('message')?.setValue(text);

      // Keep cursor at end (optional but good UX)
      setTimeout(() => {
        this.messageInput?.nativeElement.focus();
      }, 0);

    } catch (e) {
      console.error('handleTranscriptionAccepted error', e);
    }
  }


  private handleTranscriptionRejected() {
    // Clear input and keep UI consistent
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
        timestamp: new Date()
      });
      setTimeout(() => this.scrollToLastPair(), 50);
    } catch (e) {
      console.error('handleTranscriptionError error', e);
    }
  }


}
