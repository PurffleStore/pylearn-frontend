import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

// ─── INTERFACES ───
export interface ChatResponse {
  reply: string;
  suggestions: string[];
  session_id: string;
  video_key: string;    // e.g. "greeting", "videos/present_simple_definition.mp4"
  video_url: string;    // direct video path from backend
}

export interface SuggestionsResponse {
  suggestions: string[];
  session_id: string;
}

export interface VideoMap {
  [key: string]: string;  // video_key → video_path
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly apiBaseUrl = environment.apiBaseUrl.replace(/\/+$/, '');
  private readonly apiBase = `${this.apiBaseUrl}/chat_llm`;
 
  private sessionId: string;

  /** Observable stream of current video key — components subscribe to this */
  private videoSubject = new BehaviorSubject<string>('blink');
  public video$ = this.videoSubject.asObservable();

  /** Cached video map from backend */
  public videoMap: VideoMap = {};

  constructor(private http: HttpClient) {
    this.sessionId = localStorage.getItem('speech_tutor_sid') || this.generateId();
    localStorage.setItem('speech_tutor_sid', this.sessionId);
  }

  private generateId(): string {
    return 'sid_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
  }

  /** Load all video mappings on app init */
  loadVideoMap(): Observable<{ videos: VideoMap }> {
    return this.http.get<{ videos: VideoMap }>(`${this.apiBase}/videos`).pipe(
      tap(res => { this.videoMap = res.videos || {}; })
    );
  }

  /** Send chat message — returns response with video_key */
  sendMessage(message: string): Observable<ChatResponse> {
    return this.http.post<ChatResponse>(`${this.apiBase}/chat`, {
      message,
      session_id: this.sessionId
    }).pipe(
      tap(res => {
        this.sessionId = res.session_id || this.sessionId;
        // Emit video key so the video panel reacts
        if (res.video_key) {
          this.videoSubject.next(res.video_key);
        }
      })
    );
  }

  /** Get initial suggestions */
  getSuggestions(): Observable<SuggestionsResponse> {
    return this.http.get<SuggestionsResponse>(
      `${this.apiBase}/suggestions?session_id=${this.sessionId}`
    );
  }

  /** Get topics list */
  getTopics(): Observable<{ topics: { index: number; name: string; id: string }[] }> {
    return this.http.get<any>(`${this.apiBase}/topics`);
  }

  /** Resolve a video_key to a playable URL path */
  resolveVideoUrl(videoKey: string): string {
    // If the key is already a path (contains /), use it directly
    if (videoKey.includes('/')) return videoKey;
    // Otherwise look it up in the video map
    return this.videoMap[videoKey] || this.videoMap['fallback'] || 'assets/staticchat/feedback/blink.mp4';
  }

  /** Tell the video panel to play a specific video */
  playVideo(key: string): void {
    this.videoSubject.next(key);
  }
}
