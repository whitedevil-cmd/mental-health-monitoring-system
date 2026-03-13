import { useState, useEffect, useCallback } from 'react';

export type EmotionType = 'happiness' | 'sadness' | 'anger' | 'calm' | 'anxiety';

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
  emotionTrend: EmotionDataPoint[];
  aiMessages: AiMessage[];
}

export interface AiMessage {
  id: string;
  text: string;
  timestamp: Date;
  type: 'insight' | 'suggestion' | 'affirmation';
}

// Mock data for demo — used as fallback when backend is unreachable
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
    text: "Your mood has been trending upward this afternoon. The calm moments after lunch seem to be helping — keep nurturing those breaks.",
    timestamp: new Date(Date.now() - 1000 * 60 * 5),
    type: 'insight',
  },
  {
    id: '2',
    text: "Try a 3-minute breathing exercise. Inhale for 4 counts, hold for 4, exhale for 6. This can help reduce the slight anxiety spike I noticed.",
    timestamp: new Date(Date.now() - 1000 * 60 * 20),
    type: 'suggestion',
  },
  {
    id: '3',
    text: "You've maintained positive emotional balance for most of today. That takes real strength — acknowledge it.",
    timestamp: new Date(Date.now() - 1000 * 60 * 45),
    type: 'affirmation',
  },
];

export function useDashboardData() {
  const [data, setData] = useState<DashboardData>({
    currentEmotion: 'calm',
    confidence: 82,
    stressLevel: 32,
    emotionTrend: MOCK_TREND,
    aiMessages: MOCK_MESSAGES,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTrend = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/insights/emotion-trend?user_id=default-user');
      if (res.ok) {
        const result = await res.json();
        // Map backend response to dashboard state
        const stressMap: Record<string, number> = { low: 20, moderate: 50, high: 85, unknown: 0 };
        const stressValue = stressMap[result.stress_level] ?? 32;

        // Add the recommendation as an AI message
        if (result.recommendation) {
          setData(prev => ({
            ...prev,
            stressLevel: stressValue,
            aiMessages: [
              {
                id: Date.now().toString(),
                text: result.recommendation,
                timestamp: new Date(),
                type: 'insight' as const,
              },
              ...prev.aiMessages.slice(0, 2),
            ],
          }));
        } else {
          setData(prev => ({ ...prev, stressLevel: stressValue }));
        }
      }
      // If not ok, fall through and keep mock data
    } catch {
      // Use mock data on failure — UI never breaks
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
      if (res.ok) {
        const result = await res.json();
        // Map the dominant emotion to our EmotionType
        const emotion = (result.dominant_emotion || 'calm').toLowerCase() as EmotionType;
        // Use the highest score as confidence
        const scores = result.scores || {};
        const maxScore = Math.max(...Object.values(scores).map(Number), 0);
        setData(prev => ({
          ...prev,
          currentEmotion: emotion,
          confidence: Math.round(maxScore * 100),
        }));
      } else {
        setError('Could not detect emotion');
      }
    } catch {
      setError('Could not detect emotion. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrend();
  }, [fetchTrend]);

  return { data, loading, error, detectEmotion, fetchTrend };
}

