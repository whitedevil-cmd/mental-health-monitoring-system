export interface EmotionScore {
  emotion: string;
  score: number;
  color: string;
}

export interface ConversationEntry {
  id: string;
  user_id: string;
  date: string;
  transcript: string;
  emotions: EmotionScore[];
  dominant_emotion: string;
  ai_response: string;
  audio_url?: string;
}

export interface EmotionTrend {
  date: string;
  joy: number;
  sadness: number;
  anger: number;
  fear: number;
  surprise: number;
  calm: number;
}

export interface VoiceSessionState {
  status: 'idle' | 'connecting' | 'listening' | 'processing' | 'responding';
  transcript: string;
  emotions: EmotionScore[];
  aiResponse: string;
  duration: number;
}

export interface UserInsight {
  id: string;
  title: string;
  description: string;
  type: 'positive' | 'neutral' | 'attention';
  date: string;
}

export const EMOTION_COLORS: Record<string, string> = {
  joy: 'hsl(160, 64%, 52%)',
  sadness: 'hsl(235, 82%, 75%)',
  anger: 'hsl(25, 90%, 60%)',
  fear: 'hsl(263, 70%, 71%)',
  surprise: 'hsl(45, 90%, 55%)',
  calm: 'hsl(190, 60%, 55%)',
  love: 'hsl(340, 65%, 65%)',
  neutral: 'hsl(215, 16%, 47%)',
};
