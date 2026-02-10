// (full file content with only one small change: send kdtalker flag when calling explainGrammar)
import { Component, Inject, OnDestroy, PLATFORM_ID, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { ApiService } from './api.service';
import { FormsModule } from '@angular/forms';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { lastValueFrom } from 'rxjs';
import { HeaderComponent } from '../shared/header/header.component';
import { ActivatedRoute } from '@angular/router';

declare global {
  interface Window {
    SpeechRecognition?: new () => ISpeechRecognition;
    webkitSpeechRecognition?: new () => ISpeechRecognition;
    AudioContext?: { new(): AudioContext };
    webkitAudioContext?: { new(): AudioContext };
  }
}

/* Minimal Web Speech API typings to avoid lib issues */
interface ISpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives?: number;
  onstart?: (this: ISpeechRecognition, ev: Event) => void;
  onspeechstart?: (this: ISpeechRecognition, ev: Event) => void;
  onspeechend?: (this: ISpeechRecognition, ev: Event) => void;
  onresult?: (this: ISpeechRecognition, ev: ISpeechRecognitionEvent) => void;
  onerror?: (this: ISpeechRecognitionErrorEvent) => void;
  onend?: (this: ISpeechRecognition, ev: Event) => void;
  onnomatch?: (this: ISpeechRecognition, ev: Event) => void;
  start(): void;
  stop(): void;
  abort(): void;
}
interface ISpeechRecognitionAlternative { transcript: string; confidence: number; }
interface ISpeechRecognitionResult {
  length: number;
  isFinal: boolean;
  0: ISpeechRecognitionAlternative;
  [index: number]: ISpeechRecognitionAlternative;
}
interface ISpeechRecognitionResultList {
  length: number;
  item(index: number): ISpeechRecognitionResult;
  [index: number]: ISpeechRecognitionResult;
}
interface ISpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: ISpeechRecognitionResultList;
}
interface ISpeechRecognitionErrorEvent extends Event {
  error:
  | 'no-speech'
  | 'aborted'
  | 'audio-capture'
  | 'network'
  | 'not-allowed'
  | 'service-not-allowed'
  | 'bad-grammar'
  | 'language-not-supported';
  message?: string;
}

interface ChatMessage {
  from: 'user' | 'ai';
  text: string;
  timestamp: string;
  isPlaying?: boolean;
  suggestions?: string[];
  source_ids?: string[];
  videoUrl?: string;
  audioUrl?: string;
  playingVideoUrl?: string;
  pending?: boolean;
  isSynthesizing?: boolean;
  isVideoSynthesizing?: boolean;
}

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [FormsModule, CommonModule, HeaderComponent],
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.css']
})
export class ChatComponent implements OnDestroy {
  @ViewChild('waveformCanvas') waveformCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('chatContent') chatBox!: ElementRef<HTMLDivElement>;

  isRecording = false;
  showMicPopup = false;
  popupTranscript = '';
  errorMessage = '';

  private recognition: any;
  private _recordingFinalBuffer = '';
  private _recordingInterimBuffer = '';

  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array | null = null;
  private mediaStream: MediaStream | null = null;
  private animationFrameId: number | null = null;

  private _recognitionActive = false;
  private _restartTimer: ReturnType<typeof setTimeout> | null = null;
  private _restartAttempts = 0;
  private _maxRestartDelay = 1500;

  showQuestions = false;
  pdfQuestions: string[] = [];
  pdfLoading = false;

  userInput = '';
  messages: ChatMessage[] = [];
  isTyping = false;

  isListening = false;
  isSpeaking = false;
  isAudioPaused = false;

  currentFollowups: string[] = [];
  videoUrl = '';
  aiResponseInterval: ReturnType<typeof setInterval> | null = null;
  isAiResponding = false;
  isVideoEnabledIndex: boolean[] = [];

  serverAudio: HTMLAudioElement | null = null;
  serverAudioMessageIndex: number | null = null;
  isReadingIndex: number | null = null;
  isVideoPlayingIndex: number | null = null;

  copySuccessIndex: number | null = null;

  isVoiceEnabled = false;
  isTutorEnabled = false;
  isSyllabusEnabled = true;
  isBreadcrumbEnabled = false;

  private shouldAutoScroll = true;

  private lastQuestion: string | null = null;
  private lastAnswer: string | null = null;
  private lastSourceIds: string[] = [];
  private lastAnswerHasContext = false;
  chatId: string | null = null;

  // Initialize SpeechRecognition and handlers
  constructor(
    private apiService: ApiService,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
    @Inject(PLATFORM_ID) private platformId: object
  ) {
    if (!isPlatformBrowser(this.platformId)) return;

    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) return;

    this.recognition = new SR();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';
    try { (this.recognition as { maxAlternatives?: number }).maxAlternatives = 1; } catch { }

    this.recognition.onstart = () => { this._recognitionActive = true; this._restartAttempts = 0; };
    this.recognition.onspeechstart = () => { this._recognitionActive = true; };
    this.recognition.onspeechend = () => { this._recognitionActive = false; };

    this.recognition.onresult = (event: ISpeechRecognitionEvent) => {
      if (!this.isRecording) return;
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const t = res[0]?.transcript ?? '';
        if (res.isFinal) final += t + ' ';
        else interim += t + ' ';
      }
      if (final) {
        this._recordingFinalBuffer += final;
        this._recordingInterimBuffer = '';
      } else {
        this._recordingInterimBuffer = interim;
      }
      this.cdr.detectChanges();
    };

    this.recognition.onerror = (e: ISpeechRecognitionErrorEvent) => {
      if ((e as ISpeechRecognitionErrorEvent)?.error === 'not-allowed') {
        this.errorMessage = 'Microphone access denied';
        this.isRecording = false;
      } else {
        const err = (e as ISpeechRecognitionErrorEvent)?.error ?? 'unknown';
        this.errorMessage = `Error: ${err}`;
      }
      const code = (e as ISpeechRecognitionErrorEvent)?.error;
      if (this.isRecording && (code === 'no-speech' || code === 'aborted' || code === 'network')) {
        if (this._restartTimer) clearTimeout(this._restartTimer);
        const delay = Math.min(400 * (this._restartAttempts + 1), this._maxRestartDelay);
        this._restartTimer = setTimeout(() => {
          try { if (this.recognition && !this._recognitionActive) this.recognition!.start(); } catch { this._restartAttempts++; }
        }, delay);
      } else {
        if (code !== 'not-allowed') this._recognitionActive = false;
      }
      this.cdr.detectChanges();
    };

    this.recognition.onend = () => {
      this._recognitionActive = false;
      if (this.isRecording && this.showMicPopup) {
        if (this._restartTimer) clearTimeout(this._restartTimer);
        const delay = Math.min(250 + (this._restartAttempts * 200), this._maxRestartDelay);
        this._restartTimer = setTimeout(() => {
          try { if (this.recognition && !this._recognitionActive) this.recognition!.start(); } catch { this._restartAttempts++; }
        }, delay);
      }
    };

    this.recognition.onnomatch = () => { };
  }

  ngOnInit(): void {
    // initial value (snapshot)
    const snapId = this.route.snapshot.paramMap.get('id');
    if (snapId) {
      this.chatId = snapId;
      this.cdr.detectChanges();
    }
  }

  // Cleanup synth and audio
  ngOnDestroy(): void {
    if (isPlatformBrowser(this.platformId)) {
      try { window.speechSynthesis?.cancel(); } catch { }
    }
    this.stopServerAudio();
    try { window.speechSynthesis?.cancel(); } catch { }
  }

  // Hook scroll to maintain auto-scroll
  ngAfterViewInit(): void {
    this.chatBox.nativeElement.addEventListener('scroll', () => {
      const el = this.chatBox.nativeElement;
      const atBottom = el.scrollHeight - el.clientHeight - el.scrollTop < 50;
      this.shouldAutoScroll = atBottom;
    });
  }

  // Scroll to latest message; pass force = true to ignore shouldAutoScroll
  scrollToBottom(force: boolean = false): void {
    // If not forced and auto-scroll disabled, do nothing
    if (!force && !this.shouldAutoScroll) return;

    // Try smooth scrolling on the chat container
    try {
      const el = this.chatBox && this.chatBox.nativeElement;
      if (el && typeof el.scrollTo === 'function') {
        // Perform scroll inside a rAF to ensure layout is stable
        requestAnimationFrame(() => {
          try {
            el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
          } catch {
            // fallback to immediate assignment
            try { el.scrollTop = el.scrollHeight; } catch { }
          }
        });
        return;
      }
    } catch { /* ignore and fall through */ }

    // Fallback: try to scroll the last message element into view
    try {
      const last = document.querySelector('[id^="message-"]:last-of-type, .chat-message:last-child') as HTMLElement | null;
      if (last) {
        last.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    } catch { }
  }

  // Select a suggested question
  selectHardcodedQuestion(question: string): void {
    this.showQuestions = false;
    this.sendMessage(question);
    this.userInput = '';
  }

  // Show questions on focus
  showHardcodedQuestions(): void {
    setTimeout(() => {
      this.showQuestions = true;
      if (this.lastAnswer && this.lastAnswerHasContext) this.fetchFollowupQuestions();
      else this.fetchInitialQuestions();
    }, 100);
  }

  // Hide questions after blur
  hideHardcodedQuestions(): void {
    setTimeout(() => { this.showQuestions = false; }, 200);
  }

  // Fetch initial open questions
  private fetchInitialQuestions(n: number = 5): void {
    this.pdfLoading = true;
    this.pdfQuestions = [];
    this.apiService.generateOpenQuestions({ qtype: 'OPEN', n, topic: '' }).subscribe({
      next: (resp: { questions?: Array<string | { question?: string }> }) => {
        const items = Array.isArray(resp?.questions) ? resp.questions : [];
        this.pdfQuestions = items.map(q => typeof q === 'string' ? q : (q?.question || '')).filter(Boolean);
        this.pdfLoading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.pdfLoading = false; this.pdfQuestions = []; this.cdr.detectChanges(); }
    });
  }

  // Fetch follow-up questions
  private fetchFollowupQuestions(n: number = 5): void {
    if (!this.lastQuestion || !this.lastAnswer || !this.lastAnswerHasContext || !this.lastSourceIds.length) {
      this.fetchInitialQuestions(n);
      return;
    }
    this.pdfLoading = true;
    this.pdfQuestions = [];
    this.apiService.suggestFollowups({
      last_question: this.lastQuestion,
      last_answer: this.lastAnswer,
      n,
      source_ids: this.lastSourceIds
    }).subscribe({
      next: (resp: { suggestions?: string[] }) => {
        const list = Array.isArray(resp?.suggestions) ? resp.suggestions : [];
        this.pdfQuestions = list.filter((s: unknown): s is string => typeof s === 'string' && s.length > 0);
        this.pdfLoading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.pdfLoading = false; this.pdfQuestions = []; this.cdr.detectChanges(); }
    });
  }

  // Send message to backend
  sendMessage(inputText?: string): void {
    const message = inputText ? inputText.trim() : this.userInput.trim();
    if (!message) return;

    const timestamp = new Date().toLocaleTimeString();
    this.messages.push({ from: 'user', text: message, timestamp });
    this.userInput = '';
    this.isTyping = true;
    this.cdr.detectChanges();
    this.shouldAutoScroll = true;
    this.scrollToBottom();

    this.apiService.explainGrammar({
      question: message,
      synthesize_audio: Boolean(this.isVoiceEnabled),
      synthesize_video: Boolean(this.isTutorEnabled),
      // Added flag so server picks KD Talker pipeline when this chatId === '2'
      kdtalker: this.chatId === '2'
    }).subscribe({
      next: (response: {
        answer?: string;
        response?: string;
        text?: string;
        source_ids?: string[];
        audio_url?: string;
        audioUrl?: string;
        video_url?: string;
        videoUrl?: string;
      }) => {
        this.isTyping = false;
        const explanation = (response?.answer || response?.response || response?.text || 'No explanation available.').trim();

        const sourceIds: string[] = Array.isArray(response?.source_ids)
          ? (response.source_ids as unknown[]).filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
          : [];

        const audioUrl = typeof response?.audio_url === 'string'
          ? response.audio_url
          : (typeof response?.audioUrl === 'string' ? response.audioUrl : '');

        const videoUrl = typeof response?.video_url === 'string'
          ? response.video_url
          : (typeof response?.videoUrl === 'string' ? response.videoUrl : '');

        this.lastQuestion = message;
        this.lastSourceIds = sourceIds;

        const notFound = /No information available in the provided textbook content/i.test(explanation);
        const hasContext = sourceIds.length > 0 && !notFound;

        this.streamAiAnswer(explanation, sourceIds, hasContext, audioUrl || undefined, videoUrl || undefined);
      },
      error: () => {
        this.isTyping = false;
        this.streamAiAnswer('Error: Could not get a response from the server.', [], false);
      }
    });
  }

  // Stream answer text and autoplay media
  private streamAiAnswer(explanation: string, sourceIds: string[], hasContext: boolean, audioUrl?: string, videoUrl?: string): void {
    const text = (explanation || '').trim() || 'No explanation available.';
    const timestamp = new Date().toLocaleTimeString();

    const aiIndex = this.messages.push({
      from: 'ai',
      text: '',
      timestamp,
      source_ids: sourceIds,
      pending: true,
      audioUrl: audioUrl || '',
      videoUrl: videoUrl || '',
      playingVideoUrl: ''
    }) - 1;

    if (this.isVideoEnabledIndex.length <= aiIndex) this.isVideoEnabledIndex[aiIndex] = false;

    this.isAiResponding = true;
    this.shouldAutoScroll = true;
    this.cdr.detectChanges();

    this.animateAiResponse(text, aiIndex, () => {
      this.lastAnswer = text;
      this.lastAnswerHasContext = hasContext;
      this.autoPlayMediaForMessage(aiIndex);
    });

    if (!audioUrl && this.isVoiceEnabled) this.speakResponse(text);
  }

  // Choose between audio/video autoplay
  private autoPlayMediaForMessage(index: number): void {
    const msg = this.messages[index];
    if (!msg) return;

    const hasVideo = !!(msg.videoUrl && msg.videoUrl.trim());
    const hasAudio = !!(msg.audioUrl && msg.audioUrl.trim());

    if (hasVideo && this.isTutorEnabled) {
      try { this.stopServerAudio(); } catch { }
      try { window.speechSynthesis?.cancel(); } catch { }
      this.openMessageVideo(index, true);
      return;
    }

    if (hasAudio && this.isVoiceEnabled) {
      try { this.stopAllVideo(); } catch { }
      this.playServerAudioForMessage(index);
    }
  }

  // Transform text into basic HTML formatting
  formatStructuredResponse(text: string): string {
    return text
      .replace(/\n/g, '<br>')
      .replace(/(\d+)\.\s/g, '<b>$1.</b> ')
      .replace(/\•\s/g, '✔️ ')
      .replace(/\-\s/g, '🔹 ')
      .replace(/(\*\*)(.*?)\1/g, '<b>$2</b>');
  }

  // Animate AI response word-by-word
  animateAiResponse(responseText: string, targetIndex?: number, onDone?: () => void): void {
    if (!responseText) { this.isAiResponding = false; return; }

    let aiIndex: number | null = null;
    if (typeof targetIndex === 'number' && this.messages[targetIndex]?.from === 'ai') aiIndex = targetIndex;
    else for (let i = this.messages.length - 1; i >= 0; i--) { if (this.messages[i].from === 'ai') { aiIndex = i; break; } }

    if (aiIndex === null || aiIndex < 0 || !this.messages[aiIndex]) {
      this.messages.push({ from: 'ai', text: '', timestamp: new Date().toLocaleTimeString() });
      aiIndex = this.messages.length - 1;
      this.isVideoEnabledIndex.push(false);
    }

    const aiMsg = this.messages[aiIndex];
    if (this.aiResponseInterval) { clearInterval(this.aiResponseInterval); this.aiResponseInterval = null; }

    aiMsg.text = '';
    aiMsg.pending = true;
    this.isAiResponding = true;
    this.cdr.detectChanges();

    const words = responseText.split(/\s+/).filter(w => w.length);
    let idx = 0;
    const speedMs = 200;

    this.aiResponseInterval = setInterval(() => {
      if (idx < words.length) {
        aiMsg.text = words.slice(0, idx + 1).join(' ');
        idx++;
        this.cdr.detectChanges();
        this.scrollToBottom();
      } else {
        if (this.aiResponseInterval) clearInterval(this.aiResponseInterval);
        this.aiResponseInterval = null;
        aiMsg.text = responseText;
        aiMsg.pending = false;
        this.isAiResponding = false;
        if (onDone) onDone();
        this.cdr.detectChanges();
        this.scrollToBottom();
      }
    }, speedMs);
  }

  // Stop streaming and media
  stopAiResponse(): void {
    if (this.aiResponseInterval) { clearInterval(this.aiResponseInterval); this.aiResponseInterval = null; }

    this.stopServerAudio();
    try { window.speechSynthesis?.cancel(); } catch { }

    const revIndex = [...this.messages].reverse().findIndex(m => m.from === 'ai');
    if (revIndex !== -1) {
      const actualIndex = this.messages.length - 1 - revIndex;
      const msg = this.messages[actualIndex];
      msg.text = 'Response cancelled.';
      msg.timestamp = new Date().toLocaleTimeString();
      msg.suggestions = [];
      msg.audioUrl = '';
      msg.videoUrl = '';
      msg.playingVideoUrl = '';
      msg.pending = false;
      if (this.isVideoEnabledIndex.length > actualIndex) this.isVideoEnabledIndex[actualIndex] = false;
    } else {
      this.messages.push({ from: 'ai', text: 'Response cancelled.', timestamp: new Date().toLocaleTimeString() });
      this.isVideoEnabledIndex.push(false);
    }

    this.isAiResponding = false;
    this.isTyping = false;
    this.isSpeaking = false;
    this.isReadingIndex = null;
    this.cdr.detectChanges();
  }

  // Client-side speech synthesis
  speakResponse(responseText: string): void {
    if (!responseText || !this.isVoiceEnabled) return;

    this.stopAllVideo();

    const speech = new SpeechSynthesisUtterance();
    speech.text = responseText;
    speech.lang = 'en-US';
    speech.pitch = 1;
    speech.rate = 1;
    this.isSpeaking = true;

    const voices = window.speechSynthesis.getVoices();
    const preferred = [
      'Google UK English Female',
      'Google US English Female',
      'Microsoft Zira - English (United States)',
      'Microsoft Hazel - English (United Kingdom)',
      'Google en-GB Female',
      'Google en-US Female'
    ];
    for (const n of preferred) {
      const found = voices.find(v => v.name === n);
      if (found) { speech.voice = found; break; }
    }
    if (!speech.voice && voices.length) speech.voice = voices[0];

    speech.onend = () => { this.isSpeaking = false; this.cdr.detectChanges(); };

    try { window.speechSynthesis.speak(speech); } catch { this.isSpeaking = false; }
  }

  // Resume audio (TTS or server audio)
  resumeAudio(): void {
    if (this.serverAudio && this.serverAudio.paused) {
      this.serverAudio.play().catch(() => { });
      this.isAudioPaused = false;
      if (this.serverAudioMessageIndex !== null) this.messages[this.serverAudioMessageIndex].isPlaying = true;
      this.cdr.detectChanges();
      return;
    }
    if (window.speechSynthesis && window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      this.isAudioPaused = false;
      this.cdr.detectChanges();
    }
  }

  // Pause Web Speech
  pauseAudio(): void {
    if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
      window.speechSynthesis.pause();
      this.isAudioPaused = true;
      this.cdr.detectChanges();
    }
  }

  // Play server audio for a message
  playServerAudioForMessage(index: number): void {
    const msg = this.messages[index];
    if (!msg || !msg.audioUrl) return;

    if (this.serverAudio && this.serverAudioMessageIndex === index) {
      if (!this.serverAudio.paused) {
        this.serverAudio.pause();
        this.isAudioPaused = true;
        msg.isPlaying = false;
      } else {
        this.serverAudio.play().catch(() => { });
        this.isAudioPaused = false;
        msg.isPlaying = true;
      }
      this.cdr.detectChanges();
      return;
    }

    this.stopAllVideo();
    this.stopServerAudio();
    try { window.speechSynthesis?.cancel(); } catch { }

    this.serverAudio = new Audio(msg.audioUrl);
    this.serverAudioMessageIndex = index;
    try { this.serverAudio.volume = 1; } catch { }

    this.isReadingIndex = index;
    this.isAudioPaused = false;
    msg.isPlaying = true;
    this.isSpeaking = true;
    this.cdr.detectChanges();

    this.serverAudio.onended = () => {
      try { msg.isPlaying = false; } catch { }
      this.isReadingIndex = null;
      this.serverAudio = null;
      this.serverAudioMessageIndex = null;
      this.isSpeaking = false;
      this.cdr.detectChanges();
    };

    this.serverAudio.onerror = () => {
      try { msg.isPlaying = false; } catch { }
      this.isReadingIndex = null;
      this.serverAudio = null;
      this.serverAudioMessageIndex = null;
      this.isSpeaking = false;
      this.cdr.detectChanges();
    };

    this.serverAudio.play().catch(() => {
      try { msg.isPlaying = false; } catch { }
      this.isReadingIndex = null;
      this.serverAudio = null;
      this.serverAudioMessageIndex = null;
      this.isSpeaking = false;
      this.cdr.detectChanges();
    });
  }

  // Stop server audio
  private stopServerAudio(): void {
    if (this.serverAudio) {
      try { this.serverAudio.pause(); this.serverAudio.currentTime = 0; } catch { }
      this.serverAudio = null;
      if (this.serverAudioMessageIndex !== null && this.messages[this.serverAudioMessageIndex]) {
        this.messages[this.serverAudioMessageIndex].isPlaying = false;
      }
      this.serverAudioMessageIndex = null;
    }
    this.isReadingIndex = null;
  }

  // Synthesize audio then play
  synthesizeAudioAndPlay(index: number): void {
    const msg = this.messages[index];
    if (!msg || !msg.text) return;
    if (msg.audioUrl) { this.playServerAudioForMessage(index); return; }
    if (msg.isSynthesizing) return;

    msg.isSynthesizing = true;
    this.cdr.detectChanges();

    this.apiService.synthesizeAudio(msg.text).subscribe({
      next: (res: { audio_url?: string }) => {
        msg.isSynthesizing = false;
        if (res?.audio_url) { msg.audioUrl = res.audio_url; this.playServerAudioForMessage(index); }
        else { this.errorMessage = 'Audio generation failed.'; }
        this.cdr.detectChanges();
      },
      error: () => { msg.isSynthesizing = false; this.errorMessage = 'Audio generation failed.'; this.cdr.detectChanges(); }
    });
  }

  // Synthesize video then open
  synthesizeVideoAndPlay(index: number): void {
    const msg = this.messages[index];
    if (!msg || !msg.text) return;

    if (msg.videoUrl) { this.openMessageVideo(index); return; }
    if (msg.isVideoSynthesizing) return;

    msg.isVideoSynthesizing = true;
    this.cdr.detectChanges();

    this.apiService.synthesizeVideo(msg.text).subscribe({
      next: (res: { video_url?: string }) => {
        msg.isVideoSynthesizing = false;
        if (res?.video_url) { msg.videoUrl = res.video_url; this.openMessageVideo(index); }
        else { this.errorMessage = 'Video generation failed.'; }
        this.cdr.detectChanges();
      },
      error: () => { msg.isVideoSynthesizing = false; this.errorMessage = 'Video generation failed. Try again.'; this.cdr.detectChanges(); }
    });
  }

  //KD Talker setup

  generateTutorVideoFromText(index: number, inputText?: string): void {
    const msg = this.messages[index];
    if (!msg) return;

    // Reuse existing video
    if (msg.videoUrl) {
      this.openMessageVideo(index);
      return;
    }

    // Prevent duplicate calls
    if (msg.isVideoSynthesizing) return;

    // Select text source
    const sourceText =
      (msg.text && msg.text.trim()) ||
      (inputText && inputText.trim()) ||
      '';

    if (!sourceText) {
      this.errorMessage = 'No text available to generate a video.';
      this.cdr.detectChanges();
      return;
    }

    msg.isVideoSynthesizing = true;
    this.cdr.detectChanges();

    this.apiService.generateVideoFromText(sourceText).subscribe({
      next: (res: { video_url?: string }) => {
        msg.isVideoSynthesizing = false;

        if (res?.video_url) {
          msg.videoUrl = res.video_url;
          this.openMessageVideo(index);
        } else {
          this.errorMessage = 'Video URL not returned from server.';
        }

        this.cdr.detectChanges();
      },
      error: () => {
        msg.isVideoSynthesizing = false;
        this.errorMessage = 'Could not generate video.';
        this.cdr.detectChanges();
      }
    });
  }

  // Open inline video for a message
  openMessageVideo(i: number, autoPlay: boolean = false): void {
    const msg = this.messages[i];
    if (!msg?.videoUrl) return;

    if (this.isVideoPlayingIndex === i) {
      this.stopInlineVideo(i);
      return;
    }

    this.stopServerAudio();
    try { window.speechSynthesis?.cancel(); } catch { }
    this.stopAllVideo();

    msg.playingVideoUrl = msg.videoUrl;
    this.isVideoEnabledIndex[i] = true;
    this.cdr.detectChanges();

    setTimeout(() => {
      const vid = document.getElementById(`inline-video-${i}`) as HTMLVideoElement | null;
      if (!vid) { this.isVideoPlayingIndex = null; this.cdr.detectChanges(); return; }

      if (autoPlay) { try { vid.muted = true; } catch { } } else { try { vid.muted = false; } catch { } }

      vid.onplay = () => { this.isVideoPlayingIndex = i; this.cdr.detectChanges(); };
      vid.onpause = () => { this.cdr.detectChanges(); };
      vid.onended = () => { this.onMessageVideoEnded(i); };

      vid.play().catch(() => {
        this.isVideoPlayingIndex = null;
        msg.playingVideoUrl = '';
        this.isVideoEnabledIndex[i] = false;
        this.cdr.detectChanges();
      });
    }, 50);
  }

  // Toggle inline video for a message
  toggleMessageVideo(i: number): void {
    const msg = this.messages[i];
    if (!msg || !msg.videoUrl) return;
    if (!this.isVideoEnabledIndex[i]) this.openMessageVideo(i);
    else this.stopInlineVideo(i);
  }

  // Stop inline video
  stopInlineVideo(index: number): void {
    const vid = document.getElementById(`inline-video-${index}`) as HTMLVideoElement | null;
    if (vid) { try { vid.pause(); vid.currentTime = 0; } catch { } }

    const msg = this.messages[index];
    if (msg) msg.playingVideoUrl = '';
    this.isVideoEnabledIndex[index] = false;
    if (this.isVideoPlayingIndex === index) this.isVideoPlayingIndex = null;
    this.cdr.detectChanges();
  }

  // Inline video ended
  onMessageVideoEnded(i: number): void {
    const msg = this.messages[i];
    if (msg) msg.playingVideoUrl = '';
    this.isVideoEnabledIndex[i] = false;
    if (this.isVideoPlayingIndex === i) this.isVideoPlayingIndex = null;
    this.cdr.detectChanges();
  }

  // Toggle voice narration
  toggleVoice(): void {
    this.isVoiceEnabled = !this.isVoiceEnabled;
  }

  // Toggle tutor video
  toggleTutor(): void {
    this.isTutorEnabled = !this.isTutorEnabled;
  }

  // Toggle syllabus (persist)
  toggleSyllabus(): void {
    this.isSyllabusEnabled = !this.isSyllabusEnabled;
    this.saveToggleStates();
  }

  // Toggle breadcrumb (persist)
  toggleBreadcrumb(): void {
    this.isBreadcrumbEnabled = !this.isBreadcrumbEnabled;
    this.saveToggleStates();
  }

  // Save toggle states
  private saveToggleStates(): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('voiceEnabled', String(this.isVoiceEnabled));
      localStorage.setItem('tutorEnabled', String(this.isTutorEnabled));
      localStorage.setItem('syllabusEnabled', String(this.isSyllabusEnabled));
      localStorage.setItem('breadcrumbEnabled', String(this.isBreadcrumbEnabled));
    }
  }

  // Clear global tutor video
  clearVideoUrl(): void {
    this.videoUrl = '';
    if (this.isTutorEnabled) {
      this.isTutorEnabled = false;
      this.saveToggleStates();
    }
    this.cdr.detectChanges();
  }

  // Stop all inline videos
  private stopAllVideo(): void {
    this.videoUrl = '';
    try {
      const vids = Array.from(document.querySelectorAll<HTMLVideoElement>('[id^="inline-video-"]'));
      vids.forEach(v => { try { v.pause(); v.currentTime = 0; } catch { } });
    } catch { }
    this.messages.forEach((m, idx) => {
      m.playingVideoUrl = '';
      this.isVideoEnabledIndex[idx] = false;
    });
    this.cdr.detectChanges();
  }

  // Main action button icon
  getButtonIcon(): string {
    if (this.isAiResponding) return 'assets/images/chat/stop.png';
    if (this.serverAudio && !this.serverAudio.paused) return 'assets/images/chat/microphone-icon.png';
    if (this.userInput.trim().length > 0) return 'assets/images/chat/send-icon.png';
    if (this.isSpeaking && !this.serverAudio) return 'assets/images/chat/pause-icon.png';
    if (this.isAudioPaused) return 'assets/images/chat/resume-icon.png';
    return 'assets/images/chat/microphone-icon.png';
  }

  // Open user guide
  openUserGuide(): void { this.showUserGuide = true; }

  // Close user guide
  closeUserGuide(): void { this.showUserGuide = false; }

  showUserGuide = false;

  // Stop reading aloud (server audio)
  stopReadAloud(): void {
    try { this.stopServerAudio(); } catch { }
    this.isReadingIndex = null;
    this.isSpeaking = false;
    this.cdr.detectChanges();
  }

  // Open mic popup and start recording
  openMicrophonePopup(): void {
    this._recordingFinalBuffer = '';
    this._recordingInterimBuffer = '';
    this.popupTranscript = '';
    this.errorMessage = '';
    this.showMicPopup = true;
    setTimeout(() => this.startRecording(), 200);
  }

  // Close mic popup and stop recording
  closeMicrophonePopup(): void {
    this.stopRecording();
    this.showMicPopup = false;
    this.popupTranscript = '';
    this._recordingFinalBuffer = '';
    this._recordingInterimBuffer = '';
    this.errorMessage = '';
    this.cdr.detectChanges();
  }

  // Start recognition and waveform
  async startRecording(): Promise<void> {
    if (!this.recognition) { this.errorMessage = 'Speech recognition not supported.'; return; }

    this._recordingFinalBuffer = '';
    this._recordingInterimBuffer = '';
    this.popupTranscript = '';
    this.errorMessage = '';
    this.isRecording = true;

    try { this.recognition.interimResults = true; } catch { }
    try { this.recognition.start(); } catch {
      if (!this._recognitionActive) setTimeout(() => { try { this.recognition?.start(); } catch { } }, 300);
    }

    try { await this.startAnalyzer(); } catch { }
    this.cdr.detectChanges();
  }

  // Stop recognition, punctuate/normalize transcript
  async stopRecording(): Promise<void> {
    if (this._restartTimer) { clearTimeout(this._restartTimer); this._restartTimer = null; }
    if (this.recognition && this.isRecording) { try { this.recognition.stop(); } catch { } }
    try { this.stopAnalyzer(); } catch { }
    this.isRecording = false;

    const finalText = (this._recordingFinalBuffer || '').trim();
    const interimText = (this._recordingInterimBuffer || '').trim();
    const combinedRaw = (finalText + ' ' + interimText).trim();

    if (!combinedRaw) {
      this.popupTranscript = '';
      this.cdr.detectChanges();
      return;
    }

    this.popupTranscript = 'Processing…';
    this.cdr.detectChanges();

    let punctuated = combinedRaw;
    try {
      const resp$ = this.apiService.punctuate(combinedRaw);
      const res: { punctuated?: string } = await lastValueFrom(resp$);
      if (res && typeof res.punctuated === 'string' && res.punctuated.trim().length) {
        const p = res.punctuated.trim();
        punctuated = this.extractAssistantContent(p) || p;
      }
    } catch {
      punctuated = combinedRaw;
    }

    let normalized = this.normalizeTranscript(punctuated);
    const hasTerminalPunctuation = /[.?!]$/.test(normalized);
    const questionPattern = /^(who|what|when|where|why|how|which|whom|whose|is|are|am|was|were|do|does|did|can|could|would|will|shall|should|have|has|had)\b/i;
    if (!hasTerminalPunctuation && questionPattern.test(combinedRaw)) normalized = normalized + '?';

    this.popupTranscript = normalized;
    this.cdr.detectChanges();
  }

  // Extract assistant content from wrapped strings
  private extractAssistantContent(raw: string): string {
    if (!raw) return raw;
    try {
      const re1 = /message=ChatCompletionMessage\(\s*content=(['"])((?:\\.|(?!\1).)*)\1/;
      const m1 = raw.match(re1);
      if (m1 && m1[2]) return m1[2].replace(/\\'/g, "'").replace(/\\"/g, '"').trim();

      const re2 = /ChatCompletionMessage\(\s*content=(['"])((?:\\.|(?!\1).)*)\1/;
      const m2 = raw.match(re2);
      if (m2 && m2[2]) return m2[2].replace(/\\'/g, "'").replace(/\\"/g, '"').trim();

      const re3 = /content=(['"])((?:\\.|(?!\1).)*)\1/;
      const m3 = raw.match(re3);
      if (m3 && m3[2]) return m3[2].replace(/\\'/g, "'").replace(/\\"/g, '"').trim();
    } catch { }
    return raw.trim();
  }

  // Confirm and send transcript
  confirmAndSendTranscript(): void {
    let text = (this.popupTranscript || '').trim();
    if (!text) { this.errorMessage = 'No speech captured'; return; }

    text = this.normalizeTranscript(text);
    try { this.sendMessage(text); } catch { }
    this._recordingFinalBuffer = '';
    this._recordingInterimBuffer = '';
    this.showMicPopup = false;
    this.isRecording = false;
    if (this._restartTimer) { clearTimeout(this._restartTimer); this._restartTimer = null; }
    this.popupTranscript = '';
    this.cdr.detectChanges();
  }

  // Copy message text
  copyToClipboard(text: string, index: number): void {
    navigator.clipboard.writeText(text).then(() => {
      this.copySuccessIndex = index;
      setTimeout(() => { this.copySuccessIndex = null; }, 2000);
    }).catch(() => { });
  }

  // Auto-grow textarea height
  adjustTextareaHeight(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }

  // Handle Enter press (send or newline)
  handleEnterPress(event: KeyboardEvent): void {
    if (this.isSpeaking && !this.serverAudio) { event.preventDefault(); return; }
    if (event.key === 'Enter') {
      if (!event.shiftKey) {
        event.preventDefault();
        this.handleButtonClick();
      } else {
        event.preventDefault();
        this.userInput += '\n';
      }
    }
  }

  // Main input button action
  handleButtonClick(): void {
    if (this.isAiResponding) { this.stopAiResponse(); return; }

    if (this.userInput.trim().length > 0) {
      this.showQuestions = false;
      const msg = this.userInput;
      this.userInput = '';
      this.sendMessage(msg);
    } else if (this.isSpeaking && !this.serverAudio) {
      this.pauseAudio();
    } else if (this.isAudioPaused) {
      this.resumeAudio();
    } else {
      this.openMicrophonePopup();
    }
  }

  // Normalize dictated text
  private normalizeTranscript(text: string): string {
    if (!text) return text;
    let t = text.trim();
    const mappings: Array<[RegExp, string]> = [
      [/\b(full stop|period|dot)\b/gi, '.'],
      [/\b(question mark|question)\b/gi, '?'],
      [/\b(exclamation mark|exclamation|exclaim)\b/gi, '!'],
      [/\b(comma)\b/gi, ','],
      [/\b(colon)\b/gi, ':'],
      [/\b(semicolon)\b/gi, ';'],
      [/\b(ellipsis|dot dot dot|three dots)\b/gi, '...'],
      [/\b(new line|newline|new paragraph|line break)\b/gi, '\n'],
      [/\b(open parenthesis|open bracket)\b/gi, '('],
      [/\b(close parenthesis|close bracket)\b/gi, ')'],
      [/\b(double quote|quote|quotation)\b/gi, '"'],
      [/\b(single quote|apostrophe)\b/gi, "'"],
      [/\b(dash|hyphen)\b/gi, '-'],
      [/\b(percent|percent sign)\b/gi, '%'],
      [/\b(and sign|ampersand)\b/gi, '&'],
      [/\b(at sign)\b/gi, '@'],
      [/\b(forward slash|slash)\b/gi, '/'],
      [/\b(backslash)\b/gi, '\\\\']
    ];
    for (const [re, rep] of mappings) t = t.replace(re, rep);
    t = t.replace(/\s+([,.:;?!%'\)\]\}])/g, '$1');
    t = t.replace(/\s+([\(\[\{"'`])/g, '$1');
    t = t.replace(/([.?!:;,%\)\]'"-]{1,3})(?!\s|\n|$)/g, '$1 ');
    t = t.replace(/[ \t]{2,}/g, ' ');
    t = t.split('\n').map(line => line.trim()).join('\n');
    t = t.replace(/(^|[\n\.!\?]\s+)([a-z])/g, (m, p1, p2) => p1 + p2.toUpperCase());
    return t.trim();
  }

  // Start mic analyzer and waveform
  private async startAnalyzer(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

    if (!this.waveformCanvas || !this.waveformCanvas.nativeElement) {
      await new Promise(r => setTimeout(r, 80));
      if (!this.waveformCanvas || !this.waveformCanvas.nativeElement) return;
    }

    try {
      const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
      if (!this.audioContext || (this.audioContext && this.audioContext.state === 'closed')) {
        this.audioContext = new AudioContextClass!();
      } else if (this.audioContext.state === 'suspended') {
        try { await this.audioContext.resume(); } catch { }
      }

      if (this.mediaStream) {
        try { this.mediaStream.getTracks().forEach(t => t.stop()); } catch { }
        this.mediaStream = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaStream = stream;

      const source = this.audioContext.createMediaStreamSource(stream);

      try { if (this.analyser) { try { this.analyser.disconnect(); } catch { } } } catch { }

      const analyser = this.audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.85;
      source.connect(analyser);

      this.analyser = analyser;
      const bufferLength = analyser.fftSize;
      this.dataArray = new Uint8Array(bufferLength);

      this.drawWaveform();
    } catch (err) {
      try { if (this.mediaStream) { this.mediaStream.getTracks().forEach(t => t.stop()); this.mediaStream = null; } } catch { }
      try { if (this.analyser) { this.analyser.disconnect(); this.analyser = null; } } catch { }
      this.dataArray = null;
      throw err;
    }
  }

  // Stop analyzer and release audio/canvas
  private stopAnalyzer(): void {
    try {
      if (this.animationFrameId) { cancelAnimationFrame(this.animationFrameId); this.animationFrameId = null; }
      if (this.analyser) { try { this.analyser.disconnect(); } catch { } this.analyser = null; }
      if (this.mediaStream) { try { this.mediaStream.getTracks().forEach(t => t.stop()); } catch { } this.mediaStream = null; }

      try {
        if (this.audioContext && typeof this.audioContext.close === 'function') {
          this.audioContext.close().catch(() => { }).finally(() => { this.audioContext = null; });
        } else {
          this.audioContext = null;
        }
      } catch { this.audioContext = null; }

      this.dataArray = null;

      if (this.waveformCanvas && this.waveformCanvas.nativeElement) {
        const c = this.waveformCanvas.nativeElement;
        const ctx = c.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, c.width, c.height);
      }
    } catch { }
  }

  // Draw waveform loop
  private drawWaveform(): void {
    if (!this.waveformCanvas || !this.waveformCanvas.nativeElement || !this.analyser || !this.dataArray) return;
    const canvas = this.waveformCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;

    const resize = (): void => {
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width * dpr));
      const h = Math.max(1, Math.floor(rect.height * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    };

    const render = (): void => {
      if (!this.waveformCanvas || !this.waveformCanvas.nativeElement || !this.analyser || !this.dataArray) {
        if (this.animationFrameId) { cancelAnimationFrame(this.animationFrameId); this.animationFrameId = null; }
        return;
      }

      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0 || !canvas.offsetParent) {
        if (this.animationFrameId) { cancelAnimationFrame(this.animationFrameId); this.animationFrameId = null; }
        return;
      }

      resize();

      try { this.analyser.getByteTimeDomainData(this.dataArray); } catch {
        if (this.animationFrameId) { cancelAnimationFrame(this.animationFrameId); this.animationFrameId = null; }
        return;
      }

      let sum = 0;
      for (let i = 0; i < this.dataArray.length; i++) {
        const v = this.dataArray[i] - 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / this.dataArray.length) / 128;
      const level = Math.min(1, Math.max(0, rms));

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const baselineY = canvas.height / 2;

      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = '#666';
      ctx.lineWidth = Math.max(1, 1 * dpr);
      ctx.setLineDash([2 * dpr, 3 * dpr]);
      ctx.beginPath();
      ctx.moveTo(0, baselineY);
      ctx.lineTo(canvas.width, baselineY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      ctx.lineWidth = Math.max(1, 1 * dpr);
      ctx.strokeStyle = 'rgba(37,168,90,0.95)';
      ctx.beginPath();
      const slice = canvas.width / this.dataArray.length;
      let x = 0;
      for (let i = 0; i < this.dataArray.length; i++) {
        const v = this.dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;
        const drawY = baselineY - (y - canvas.height / 2) * 0.6;
        if (i === 0) ctx.moveTo(x, drawY); else ctx.lineTo(x, drawY);
        x += slice;
      }
      ctx.stroke();

      const highlightMaxW = canvas.width * 0.7;
      const highlightW = Math.max(2 * dpr, highlightMaxW * (0.05 + level * 0.95));
      const hh = Math.max(4 * dpr, 6 * dpr);
      const hx = (canvas.width - highlightW) / 2;
      const hy = baselineY - hh / 2;
      ctx.save();
      ctx.globalAlpha = 0.18 + level * 0.3;
      ctx.fillStyle = '#25a85a';
      ctx.fillRect(hx - 6 * dpr, hy - 6 * dpr, highlightW + 12 * dpr, hh + 12 * dpr);
      ctx.restore();

      ctx.fillStyle = '#25a85a';
      ctx.globalAlpha = 1;
      ctx.fillRect(hx, hy, highlightW, hh);

      this.animationFrameId = requestAnimationFrame(render);
    };

    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId = requestAnimationFrame(render);
  }
}
