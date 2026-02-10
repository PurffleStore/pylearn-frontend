import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

type Grade = 'lowergrade' | 'midgrade' | 'highergrade';
type DbLevel = 'low' | 'mid' | 'high';

function resolveBaseUrl(): string {
  const isHF = location.hostname.endsWith('hf.space');
  if (isHF) return 'https://majemaai-mj-learn-backend.hf.space/rag';
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return 'http://localhost:5000/rag';
  return 'https://pylearn-backend-production.up.railway.app/rag';
}

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

  // FIX: include headers, db_level and model
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

  // FIX: include headers, db_level and model
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

  //KD Talker setup

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
