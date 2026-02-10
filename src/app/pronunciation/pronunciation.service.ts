import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ScoreResponse {
  score: number;
  feedback: string;
  status?: string;
  videoBlobBase64?: string;
}

@Injectable({ providedIn: 'root' })
export class PronunciationService {
  
  private readonly apiBase = environment.apiBaseUrl.replace(/\/+$/, '');
  private readonly scoreEndpoint = `${this.apiBase}/pronunciation/score`;

  // Send audio blob and target word for scoring
  scorePronunciation(audio: Blob, word: string): Observable<ScoreResponse> {
    const fd = new FormData();
    fd.append('audio', audio, 'student.webm');
    fd.append('word', word.toLowerCase());
    return this.http.post<ScoreResponse>(this.scoreEndpoint, fd);
  }

  constructor(private http: HttpClient) { }
}
