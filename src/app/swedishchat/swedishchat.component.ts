// swedish-chat.component.ts
import { Component, AfterViewChecked, ElementRef, ViewChild } from '@angular/core';
import { SwedishChatService, ChatResponse, TavilyResult } from './swedishchat.service';

export interface Message {
  role: 'user' | 'bot' | 'error';
  text: string;
  time: string;
  // Optional: show Tavily list under a bot message
  results?: TavilyResult[];
  mode?: string;
  ttsLoading?: boolean;
}

@Component({
  selector: 'app-swedishchat',
  templateUrl: './swedishchat.component.html',
  styleUrls: ['./swedishchat.component.css']
})
export class SwedishchatComponent implements AfterViewChecked {
  @ViewChild('chatWindow') chatWindow!: ElementRef;

  messages: Message[] = [];
  userInput = '';
  isLoading = false;
  isTtsLoading = false;
  private currentAudio: HTMLAudioElement | null = null;
  private currentAudioUrl: string | null = null;

  constructor(private chatService: SwedishChatService) {
    this.pushBotMessage('Hej! Skriv din fråga på svenska.');
  }

  ngAfterViewChecked(): void {
    this.scrollToBottom();
  }

  sendMessage(): void {
    const text = this.userInput.trim();
    if (!text || this.isLoading) return;

    this.pushUserMessage(text);
    this.userInput = '';
    this.isLoading = true;

    this.chatService.sendMessage(text).subscribe({
      next: (res: ChatResponse) => {
        this.isLoading = false;

        if (!res.success) {
          this.pushErrorMessage(res.error || 'Något gick fel.');
          return;
        }

        // Mode-based handling
        if (res.mode === 'tavily_only') {
          // Show answer + results list
          const msgText = res.answer || 'Resultat från webbsökning.';
          this.pushBotMessage(msgText, res.mode, res.results || []);
        } else {
          // static_time or llama_only
          this.pushBotMessage(res.answer || '(Inget svar)', res.mode);
        }
      },
      error: (err) => {
        this.isLoading = false;
        const errMsg = err?.error?.error || err?.error?.answer || 'Något gick fel. Försök igen.';
        this.pushErrorMessage(errMsg);
      }
    });
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  clearChat(): void {
    this.stopCurrentAudio();
    this.messages = [];
    this.pushBotMessage('Hej igen! Skriv din fråga på svenska.');
  }

  private pushUserMessage(text: string): void {
    this.messages.push({ role: 'user', text, time: this.getTime() });
  }

  private pushBotMessage(text: string, mode?: string, results?: TavilyResult[]): void {
    this.messages.push({ role: 'bot', text, time: this.getTime(), mode, results });
  }

  private pushErrorMessage(text: string): void {
    this.messages.push({ role: 'error', text, time: this.getTime() });
  }

  private getTime(): string {
    return new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
  }

  private scrollToBottom(): void {
    try {
      this.chatWindow.nativeElement.scrollTop = this.chatWindow.nativeElement.scrollHeight;
    } catch { }
  }

  playTTS(msg: Message): void {
    if (msg.role === 'user') return;

    const text = (msg.text || '').trim();
    if (!text || msg.ttsLoading) return;

    msg.ttsLoading = true;

    // Stop previous audio (optional)
    this.stopCurrentAudio();

    this.chatService.tts(text).subscribe({
      next: (blob: Blob) => {
        msg.ttsLoading = false;

        const url = URL.createObjectURL(blob);
        this.currentAudioUrl = url;

        const audio = new Audio(url);
        this.currentAudio = audio;

        audio.muted = false;
        audio.volume = 1.0;

        audio.onended = () => this.cleanupAudioUrl();
        audio.onerror = () => this.cleanupAudioUrl();

        audio.play().catch(() => this.cleanupAudioUrl());
      },
      error: () => {
        msg.ttsLoading = false;
        this.pushErrorMessage('Kunde inte spela upp ljud. Försök igen.');
      }
    });
  }

  private stopCurrentAudio(): void {
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch { }
    }
    this.cleanupAudioUrl();
  }

  private cleanupAudioUrl(): void {
    if (this.currentAudioUrl) {
      try { URL.revokeObjectURL(this.currentAudioUrl); } catch { }
    }
    this.currentAudioUrl = null;
    this.currentAudio = null;
  }

  trackByIndex(index: number): number {
    return index;
  }
}
