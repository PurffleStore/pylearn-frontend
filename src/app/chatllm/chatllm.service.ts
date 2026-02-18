import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { environment } from '../../environments/environment';

export interface ChatMessage {
  id?: number;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  isTyping?: boolean;
  rawData?: any;
}

export interface Question {
  sno: number;
  question: string;
}

export type SuggestionsResponse = {
  suggestions: { sno: number; question: string }[];
};

export interface SearchResponse {
  scenario?: string;
  question?: string;
  answer?: string;
  matches?: any[];
  session_id?: string;

  // backend followups
  followups?: { sno: number; question: string; score?: number }[];

  // optional (keep if you use)
  audio_url?: string;
  video_url?: string;

  message?: string;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class ChatLLMService {

 private readonly apiBaseSrc = environment.apiBaseUrl.replace(/\/+$/, '');
private readonly apiBase = `${this.apiBaseSrc}/chat_llm`;

  // ✅ Backend session_id
  private sessionId: string;

  constructor(private http: HttpClient) {
    const stored = sessionStorage.getItem('chat_session_id');
    if (stored) {
      this.sessionId = stored;
    } else {
      this.sessionId = uuidv4();
      sessionStorage.setItem('chat_session_id', this.sessionId);
    }
  }

  getSessionId(): string {
    return this.sessionId;
  }

  // ✅ GET /api/suggestions
  getSuggestions(): Observable<SuggestionsResponse> {
    return this.http.get<SuggestionsResponse>(`${this.apiBase}/suggestions`);
  }

  // ✅ POST /api/ask with session_id + X-Session-Id
  searchQuestion(question: string): Observable<SearchResponse> {
    const headers = new HttpHeaders({ 'X-Session-Id': this.sessionId });

    return this.http.post<SearchResponse>(
      `${this.apiBase}/ask`,
      { question, session_id: this.sessionId },
      { headers }
    );
  }

  // ✅ GET /api/questions (matches your backend output)
  getAllQuestions(): Observable<{ success: boolean; questions: Question[]; count: number }> {
    return this.http.get<{ success: boolean; questions: Question[]; count: number }>(
      `${this.apiBase}/questions`
    );
  }

  // optional: clear backend context
  clearContext(): Observable<{ status: string; session_id: string }> {
    const headers = new HttpHeaders({ 'X-Session-Id': this.sessionId });
    return this.http.post<{ status: string; session_id: string }>(
      `${this.apiBase}/clear_context`,
      { session_id: this.sessionId },
      { headers }
    );
  }

  // optional: reset session locally
  resetSession(): void {
    this.sessionId = uuidv4();
    sessionStorage.setItem('chat_session_id', this.sessionId);
  }
}