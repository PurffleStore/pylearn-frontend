// swedish-chat.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
export interface ChatRequest {
  message: string;
}

export interface TavilyResult {
  title: string;
  snippet: string;
  url: string;
}

export type ChatMode = 'static_time' | 'tavily_only' | 'llama_only';

export interface ChatResponse {
  success: boolean;
  original_input?: string;
  corrected_input?: string;

  mode?: ChatMode;
  used_web_search?: boolean;

  // Main answer text
  answer?: string;

  // Only when mode === "tavily_only"
  results?: TavilyResult[];

  // Error fields (when success=false)
  error?: string;
}

export interface TtsRequest {
  text: string;
}

@Injectable({
  providedIn: 'root'
})
export class SwedishChatService {

  private readonly apiBaseSrc = environment.apiBaseUrl.replace(/\/+$/, '');
  private readonly apiUrl = `${this.apiBaseSrc}/swedishchat`;  
  private headers = new HttpHeaders({ 'Content-Type': 'application/json' });

  constructor(private http: HttpClient) { }

  sendMessage(message: string): Observable<ChatResponse> {
    const body: ChatRequest = { message };
    return this.http.post<ChatResponse>(`${this.apiUrl}/chat`, body, { headers: this.headers });
  }

  tts(text: string): Observable<Blob> {
    const body: TtsRequest = { text };

    // IMPORTANT: responseType must be 'blob'
    return this.http.post(`${this.apiUrl}/tts`, body, {
      headers: this.headers,
      responseType: 'blob'
    });
  }
}
