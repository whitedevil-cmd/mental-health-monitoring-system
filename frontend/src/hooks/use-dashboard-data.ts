import { useState, useEffect, useCallback } from 'react';

export type EmotionType =
  | 'happiness'
  | 'sadness'
  | 'anger'
  | 'calm'
  | 'neutral'
  | 'uncertain'
  | 'anxiety';

export interface EmotionDataPoint {
  time: string;
  happiness: number;
  sadness: number;
  anger: number;
  calm: number;
  anxiety: number;
}

export interface DashboardData {
  currentEmotion: EmotionType;
  confidence: number;
  stressLevel: number;
  transcript: string;
  emotionTrend: EmotionDataPoint[];
  aiMessages: AiMessage[];
}

export interface AiMessage {
  id: string;
  text: string;
  timestamp: Date;
  type: 'insight' | 'suggestion' | 'affirmation';
}

interface BackendTrendPoint {
  timestamp: string;
  dominant_emotion: string;
  confidence: number | null;
}

interface BackendInsightsResponse {
  user_id: string;
  trend: BackendTrendPoint[];
  supportive_message: string | null;
  transcript?: string | null;
}

interface BackendTrendResponse {
  stress_level: string;
  pattern: string;
  recommendation: string;
}

const DEFAULT_USER_ID = 'default-user';
const TRANSCRIPT_STORAGE_KEY = 'dashboard-latest-transcript';

const MOCK_TREND: EmotionDataPoint[] = [
  { time: '9 AM', happiness: 65, sadness: 15, anger: 5, calm: 70, anxiety: 20 },
  { time: '10 AM', happiness: 60, sadness: 20, anger: 8, calm: 55, anxiety: 30 },
  { time: '11 AM', happiness: 50, sadness: 30, anger: 12, calm: 45, anxiety: 40 },
  { time: '12 PM', happiness: 55, sadness: 25, anger: 10, calm: 50, anxiety: 35 },
  { time: '1 PM', happiness: 70, sadness: 12, anger: 5, calm: 65, anxiety: 18 },
  { time: '2 PM', happiness: 75, sadness: 10, anger: 3, calm: 72, anxiety: 12 },
  { time: '3 PM', happiness: 68, sadness: 18, anger: 7, calm: 60, anxiety: 25 },
  { time: '4 PM', happiness: 72, sadness: 14, anger: 4, calm: 68, anxiety: 15 },
];

const MOCK_MESSAGES: AiMessage[] = [
  {
    id: '1',
    text: 'Your mood has been trending upward this afternoon. The calm moments after lunch seem to be helping. Keep nurturing those breaks.',
    timestamp: new Date(Date.now() - 1000 * 60 * 5),
    type: 'insight',
  },
  {
    id: '2',
    text: 'Try a 3-minute breathing exercise. Inhale for 4 counts, hold for 4, exhale for 6. This can help reduce the slight anxiety spike I noticed.',
    timestamp: new Date(Date.now() - 1000 * 60 * 20),
    type: 'suggestion',
  },
  {
    id: '3',
    text: "You've maintained positive emotional balance for most of today. That takes real strength. Acknowledge it.",
    timestamp: new Date(Date.now() - 1000 * 60 * 45),
    type: 'affirmation',
  },
];

function normalizeEmotion(rawEmotion?: string): EmotionType {
  switch ((rawEmotion ?? '').toLowerCase()) {
    case 'happy':
    case 'happiness':
      return 'happiness';
    case 'sad':
    case 'sadness':
      return 'sadness';
    case 'angry':
    case 'anger':
      return 'anger';
    case 'anxiety':
    case 'anxious':
    case 'stress':
    case 'stressed':
      return 'anxiety';
    case 'neutral':
      return 'neutral';
    case 'uncertain':
      return 'uncertain';
    case 'calm':
    default:
      return 'calm';
  }
}

function getStoredTranscript(): string {
  try {
    return window.localStorage.getItem(TRANSCRIPT_STORAGE_KEY)?.trim() ?? '';
  } catch {
    return '';
  }
}

function setStoredTranscript(transcript: string): void {
  try {
    window.localStorage.setItem(TRANSCRIPT_STORAGE_KEY, transcript.trim());
  } catch {
    // Ignore storage failures and keep UI responsive.
  }
}

function toChartPoint(point: BackendTrendPoint, index: number): EmotionDataPoint {
  const emotion = normalizeEmotion(point.dominant_emotion);
  const strength = Math.round((point.confidence ?? 0.5) * 100);
  const timestamp = new Date(point.timestamp);

  return {
    time: Number.isNaN(timestamp.getTime())
      ? `Entry ${index + 1}`
      : timestamp.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    happiness: emotion === 'happiness' ? strength : 0,
    sadness: emotion === 'sadness' ? strength : 0,
    anger: emotion === 'anger' ? strength : 0,
    calm: emotion === 'calm' || emotion === 'neutral' ? strength : 0,
    anxiety: emotion === 'anxiety' || emotion === 'uncertain' ? strength : 0,
  };
}

function buildMessages(
  insights: BackendInsightsResponse,
  trend: BackendTrendResponse,
): AiMessage[] {
  const messages: AiMessage[] = [];

  if (insights.supportive_message) {
    messages.push({
      id: 'supportive-message',
      text: insights.supportive_message,
      timestamp: new Date(),
      type: 'affirmation',
    });
  }

  if (trend.recommendation) {
    messages.push({
      id: 'trend-recommendation',
      text: trend.recommendation,
      timestamp: new Date(),
      type: 'suggestion',
    });
  }

  if (trend.pattern && trend.pattern !== 'stable') {
    messages.push({
      id: 'trend-pattern',
      text: `Recent pattern: ${trend.pattern}.`,
      timestamp: new Date(),
      type: 'insight',
    });
  }

  return messages.length > 0 ? messages : MOCK_MESSAGES;
}

export function useDashboardData() {
  const [data, setData] = useState<DashboardData>({
    currentEmotion: 'calm',
    confidence: 82,
    stressLevel: 32,
    transcript: getStoredTranscript(),
    emotionTrend: MOCK_TREND,
    aiMessages: MOCK_MESSAGES,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTrend = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [trendRes, insightsRes] = await Promise.all([
        fetch(`/api/v1/insights/emotion-trend?user_id=${DEFAULT_USER_ID}`),
        fetch(`/api/v1/insights/${DEFAULT_USER_ID}`),
      ]);

      if (!trendRes.ok || !insightsRes.ok) {
        throw new Error('Dashboard endpoints returned an error.');
      }

      const trendResult = (await trendRes.json()) as BackendTrendResponse;
      const insightsResult = (await insightsRes.json()) as BackendInsightsResponse;
      const stressMap: Record<string, number> = { low: 20, moderate: 50, high: 85, unknown: 0 };
      const stressValue = stressMap[trendResult.stress_level] ?? 32;
      const emotionTrend = insightsResult.trend.map(toChartPoint);
      const latestPoint = insightsResult.trend[insightsResult.trend.length - 1];
      const transcript = (insightsResult.transcript ?? getStoredTranscript()).trim();

      if (transcript) {
        setStoredTranscript(transcript);
      }

      setData({
        currentEmotion: normalizeEmotion(latestPoint?.dominant_emotion),
        confidence: Math.round((latestPoint?.confidence ?? 0.82) * 100),
        stressLevel: stressValue,
        transcript,
        emotionTrend: emotionTrend.length > 0 ? emotionTrend : MOCK_TREND,
        aiMessages: buildMessages(insightsResult, trendResult),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load dashboard data.');
      setData((prev) => ({
        ...prev,
        transcript: prev.transcript || getStoredTranscript(),
        emotionTrend: prev.emotionTrend.length > 0 ? prev.emotionTrend : MOCK_TREND,
        aiMessages: prev.aiMessages.length > 0 ? prev.aiMessages : MOCK_MESSAGES,
      }));
    } finally {
      setLoading(false);
    }
  }, []);

  const detectEmotion = useCallback(async (audioPath?: string) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/detect-emotion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio_path: audioPath ?? 'audio_storage/recording.wav' }),
      });

      if (!res.ok) {
        throw new Error('Could not detect emotion');
      }

      const result = await res.json();
      const scores = result.scores || {};
      const transcript = typeof result.transcript === 'string' ? result.transcript.trim() : '';
      const maxScore = Math.max(...Object.values(scores).map(Number), 0);

      if (transcript) {
        setStoredTranscript(transcript);
      }

      setData((prev) => ({
        ...prev,
        currentEmotion: normalizeEmotion(result.dominant_emotion),
        confidence: Math.round(maxScore * 100),
        transcript: transcript || prev.transcript,
      }));
    } catch {
      setError('Could not detect emotion. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTrend();
  }, [fetchTrend]);

  useEffect(() => {
    const refreshDashboard = (event: Event) => {
      if (event instanceof CustomEvent && typeof event.detail?.transcript === 'string') {
        const transcript = event.detail.transcript.trim();
        if (transcript) {
          setStoredTranscript(transcript);
          setData((prev) => ({ ...prev, transcript }));
        }
      }
      void fetchTrend();
    };

    window.addEventListener('emotion-updated', refreshDashboard as EventListener);
    return () => window.removeEventListener('emotion-updated', refreshDashboard as EventListener);
  }, [fetchTrend]);

  return { data, loading, error, detectEmotion, fetchTrend };
}
