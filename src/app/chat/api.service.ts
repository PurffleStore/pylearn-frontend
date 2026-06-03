import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

type Grade = 'lowergrade' | 'midgrade' | 'highergrade';
type DbLevel = 'low' | 'mid' | 'high';

/**
 * Resolves the correct RAG API base URL based on the current hostname.
 * Hugging Face deployments use a dedicated space URL; all other production
 * and local environments fall back to the configured environment URL.
 */
function resolveBaseUrl(): string {
  const isHuggingFaceEnvironment = location.hostname.endsWith('hf.space');
  if (isHuggingFaceEnvironment) return `${environment.apiBaseUrlHuggingFace}/rag`;
  return `${environment.apiBaseUrl}/rag`;
}

/**
 * HTTP client service for the English Chat Tutor AI backend.
 *
 * Provides methods to generate grammar explanations, follow-up suggestions,
 * audio and video synthesis, and text punctuation via the RAG API.
 * The base URL is resolved at startup from the current environment configuration.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly baseUrl = resolveBaseUrl();
  private readonly defaultModel = 'gpt-4o-mini';

  constructor(private http: HttpClient) { }

  private getGrade(): Grade {
    const g = (localStorage.getItem('gradeLevel') || 'midgrade').toLowerCase();
    return (g === 'lowergrade' || g === 'midgrade' || g === 'highergrade') ? (g as Grade) : 'midgrade';
  }

  private toDbLevel(g: Grade): DbLevel {
    return g === 'lowergrade' ? 'low' : g === 'midgrade' ? 'mid' : 'high';
  }

  private makeHeaders(g: Grade): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'X-User': g
    });
  }

  generateOpenQuestions(payload: { qtype: 'OPEN'; n?: number; topic?: string }): Observable<any> {
    const grade = this.getGrade();
    const headers = this.makeHeaders(grade);
    const body = {
      qtype: 'OPEN',
      n: payload.n ?? 5,
      topic: payload.topic ?? '',
      model: this.defaultModel,
      db_level: this.toDbLevel(grade)
    };
    return this.http.post<any>(`${this.baseUrl}/generate-questions`, body, { headers });
  }

  explainGrammar(payload: string | Record<string, unknown>): Observable<any> {
    const grade = this.getGrade();
    const headers = this.makeHeaders(grade);
    const body = typeof payload === 'string' ? { question: payload } : { ...payload };
    if (!('db_level' in body)) (body as any).db_level = this.toDbLevel(grade);
    if (!('model' in body)) (body as any).model = this.defaultModel;
    return this.http.post<any>(`${this.baseUrl}/explain-grammar`, body, { headers });
  }

  suggestFollowups(payload: {
    last_question: string;
    last_answer: string;
    n?: number;
    source_ids?: string[];
  }): Observable<any> {
    const grade = this.getGrade();
    const headers = this.makeHeaders(grade);
    const body = {
      last_question: payload.last_question,
      last_answer: payload.last_answer,
      n: payload.n ?? 5,
      model: this.defaultModel,
      db_level: this.toDbLevel(grade),
      source_ids: payload.source_ids ?? []
    };
    return this.http.post<any>(`${this.baseUrl}/suggest-followups`, body, { headers });
  }

  synthesizeAudio(text: string, language = 'en', referenceFiles?: string[]) {
    const grade = this.getGrade();
    const headers = this.makeHeaders(grade);
    const body: any = {
      text,
      language,
      db_level: this.toDbLevel(grade),
      model: this.defaultModel
    };
    if (referenceFiles?.length) body.reference_files = referenceFiles;
    return this.http.post<{ audio_url: string }>(`${this.baseUrl}/synthesize-audio`, body, { headers });
  }

  synthesizeVideo(text: string, language = 'en') {
    const grade = this.getGrade();
    const headers = this.makeHeaders(grade);
    const body: any = {
      text,
      language,
      db_level: this.toDbLevel(grade),
      model: this.defaultModel
    };
    return this.http.post<{ video_url: string }>(`${this.baseUrl}/synthesize-video`, body, { headers });
  }

  generateVideoFromText(text: string, language = 'en') {    
    const grade = this.getGrade();
    const headers = this.makeHeaders(grade);
    return this.http.post<{ video_url: string }>(
      `${this.baseUrl}/generate-video-from-text`,
      { text, language, db_level: this.toDbLevel(grade), model: this.defaultModel },
      { headers }
    );
  }

  punctuate(text: string): Observable<any> {
    const grade = this.getGrade();
    const headers = this.makeHeaders(grade);
    return this.http.post<any>(`${this.baseUrl}/punctuate`, { text }, { headers });
  }

}
