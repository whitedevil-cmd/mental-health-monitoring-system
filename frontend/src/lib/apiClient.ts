export const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? 'http://127.0.0.1:8001' : '');

if (!API_BASE) {
  throw new Error(
    'Missing VITE_API_BASE_URL. Set it in your Vercel project env (and .env for local dev).',
  );
}

export interface AnalyzeAudioResponse {
  transcript: string;
  emotion: string;
  confidence: number;
  probabilities: Record<string, number>;
  response: string;
}

export interface GenerateSupportResponse {
  message: string;
}

export interface HistoryResponseItem {
  timestamp: string;
  emotion: string;
  confidence: number;
  transcript: string | null;
}

export interface DeepgramTokenResponse {
  token: string;
  expires_in: number;
}

export interface AnalyzeTextResponse {
  emotion: string;
  confidence: number;
}

export interface SaveSessionPayload {
  user_id: string;
  text: string;
  emotion: string;
  confidence: number | null;
  timestamp?: string;
}

export interface SaveSessionResponse {
  id: number;
  user_id: string;
  audio_id: string | null;
  emotion_label: string;
  confidence: number | null;
  transcript: string | null;
  created_at: string;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string> || {}),
    };
    if (options.body && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(`${this.baseUrl}${path}`, { ...options, headers });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`API Error: ${res.status} ${res.statusText} ${text}`);
    }
    return res.json();
  }

  async analyzeAudio(file: Blob, userId?: string): Promise<AnalyzeAudioResponse> {
    const form = new FormData();
    form.append('file', file, 'recording.wav');
    if (userId) {
      form.append('user_id', userId);
    }
    return this.request<AnalyzeAudioResponse>('/analyze-audio', {
      method: 'POST',
      body: form,
    });
  }

  async generateSupport(emotion: string, confidence: number): Promise<GenerateSupportResponse> {
    return this.request<GenerateSupportResponse>('/generate-support', {
      method: 'POST',
      body: JSON.stringify({ emotion, confidence }),
    });
  }

  async getHistory(userId?: string): Promise<HistoryResponseItem[]> {
    const query = userId ? `?user_id=${encodeURIComponent(userId)}` : '';
    return this.request<HistoryResponseItem[]>(`/history${query}`);
  }

  async getDeepgramToken(): Promise<DeepgramTokenResponse> {
    return this.request<DeepgramTokenResponse>('/deepgram-token');
  }

  async analyzeText(text: string, signal?: AbortSignal): Promise<AnalyzeTextResponse> {
    return this.request<AnalyzeTextResponse>('/analyze-text', {
      method: 'POST',
      body: JSON.stringify({ text }),
      signal,
    });
  }

  async saveSession(payload: SaveSessionPayload): Promise<SaveSessionResponse> {
    return this.request<SaveSessionResponse>('/api/v1/emotions/analyze', {
      method: 'POST',
      body: JSON.stringify({
        user_id: payload.user_id,
        emotion_label: payload.emotion,
        confidence: payload.confidence,
        transcript: payload.text,
      }),
    });
  }
}

export const apiClient = new ApiClient(API_BASE);
