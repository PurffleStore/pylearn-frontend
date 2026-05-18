import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface PhonemeDetail {
  sound: string;
  said: string;
  correct: boolean;
  tip: string;
}

export interface ScoreResponse {
  score: number;
  feedback: string;
  status?: string;
  videoBlobBase64?: string;
  video_clips_merged?: boolean;
  video_clip_text?: string;   // Teaching sentence from clip 1
  video_clip_text2?: string;  // Teaching sentence from clip 2 (if 2 clips were selected)
  scenario?: string;
  student_phonemes?: string[];
  reference_phonemes?: string[];
  phoneme_details?: PhonemeDetail[];
  word?: string;
}

@Injectable({ providedIn: 'root' })
export class PronunciationService {
  
  private readonly apiBase = environment.apiBaseUrl.replace(/\/+$/, '');
  private readonly scoreEndpoint = `${this.apiBase}/pronunciation/score`;

  // Send audio blob and target word for scoring
  scorePronunciation(audio: Blob, word: string, attemptNumber: number = 1, previousScore: number = -1): Observable<ScoreResponse> {
    const fd = new FormData();
    fd.append('audio', audio, 'student.webm');
    fd.append('word', word.toLowerCase());
    fd.append('attempt_number', String(attemptNumber));
    fd.append('previous_score', String(previousScore));
    return this.http.post<ScoreResponse>(this.scoreEndpoint, fd);
  }

  constructor(private http: HttpClient) { }
}
