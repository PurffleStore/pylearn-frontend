import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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

export interface SearchResponse {
  success: boolean;
  matched_question?: string;
  answer?: string;
  sno?: number;
  audio_url?: string;
  video_url?: string;
  story_url?: string;
  detail_url?: string;
  example_url?: string;
  confidence_score?: number;
  user_question?: string;
  message?: string;
  suggestion?: string;
  sample_questions?: string[];
  total_questions_available?: number;
  matching_method?: string;
  is_follow_up?: boolean;
  enhanced_question?: string;
  scenario?: string;
  context_info?: {
    current_topic: string | null;
    current_intent: string | null;
    has_context: boolean;
    history_length: number;
  };
}

export interface Question {
  sno: number;
  question: string;
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {

  private readonly apiBaseSrc = environment.apiBaseUrl.replace(/\/+$/, '');
  private readonly apiBase = `${this.apiBaseSrc}/staticchat`;

  
  // =====================================================
  // Static user_id: generated once per browser session.
  // Persists across page navigations within the same tab,
  // but resets when the tab/browser is closed.
  //
  // Options:
  //   sessionStorage  — resets when tab closes (recommended)
  //   localStorage    — persists even after browser restart
  // =====================================================
  private userId: string;

  constructor(private http: HttpClient) {
    // Try to restore existing session ID
    const stored = sessionStorage.getItem('chat_user_id');
    if (stored) {
      this.userId = stored;
    } else {
      // Generate a new one for this session
      this.userId = uuidv4();
      sessionStorage.setItem('chat_user_id', this.userId);
    }
    console.log('Chat session user_id:', this.userId);
  }

  /**
   * Get the current user ID (useful for context endpoints)
   */
  getUserId(): string {
    return this.userId;
  }

  /**
   * Reset the session — clears context on backend and generates a new user_id
   */
  resetSession(): Observable<{ success: boolean; message: string }> {
    const oldUserId = this.userId;

    // Generate new user_id
    this.userId = uuidv4();
    sessionStorage.setItem('chat_user_id', this.userId);
    console.log('Session reset. New user_id:', this.userId);

    // Clear old context on the backend
    return this.http.post<{ success: boolean; message: string }>(
      `${this.apiBase}/context/${oldUserId}/clear`, {}
    );
  }

  /**
   * Search — sends user_id with every request for context carry-forward
   */
  searchQuestion(question: string): Observable<SearchResponse> {
    return this.http.post<SearchResponse>(
      `${this.apiBase}/search`,
      {
        question,
        user_id: this.userId   // <-- This is the key fix
      }
    );
  }

  /**
   * Get all questions for reference / autocomplete
   */
  getAllQuestions(): Observable<{ success: boolean; questions: Question[]; count: number }> {
    return this.http.get<{ success: boolean; questions: Question[]; count: number }>(
      `${this.apiBase}/questions`
    );
  }

  /**
   * Get random suggestions
   */
  getRandomSuggestions(count: number = 5): Observable<{ success: boolean; suggestions: string[] }> {
    return this.http.get<{ success: boolean; suggestions: string[] }>(
      `${this.apiBase}/suggestions`,
      { params: { count: count.toString() } }
    );
  }

  /**
   * Get context-aware follow-up suggestions based on conversation history
   */
  getContextSuggestions(): Observable<{ success: boolean; suggestions: string[]; current_topic: string | null }> {
    return this.http.get<{ success: boolean; suggestions: string[]; current_topic: string | null }>(
      `${this.apiBase}/context/suggestions/${this.userId}`
    );
  }

  /**
   * Get current conversation context (for debugging or UI display)
   */
  getContext(): Observable<any> {
    return this.http.get(`${this.apiBase}/context/${this.userId}`);
  }
}
