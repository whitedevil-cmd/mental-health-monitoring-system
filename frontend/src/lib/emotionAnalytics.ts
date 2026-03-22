import { HistoryResponseItem } from '@/lib/apiClient';

export type EmotionDistributionItem = {
  name: string;
  value: number;
  color: string;
};

export type DailyEmotionTrend = {
  day: string;
  calm: number;
  joy: number;
  sadness: number;
  anger: number;
  fear: number;
  surprise: number;
  neutral: number;
  stress: number;
};

export type InsightCard = {
  type: 'positive' | 'attention' | 'neutral';
  title: string;
  desc: string;
};

const DAY_FORMATTER = new Intl.DateTimeFormat('en-US', { weekday: 'short' });

export const EMOTION_TO_COLOR: Record<string, string> = {
  calm: 'hsl(190, 60%, 55%)',
  joy: 'hsl(160, 64%, 52%)',
  sadness: 'hsl(235, 82%, 75%)',
  fear: 'hsl(263, 70%, 71%)',
  anger: 'hsl(25, 90%, 60%)',
  surprise: 'hsl(45, 90%, 55%)',
  neutral: 'hsl(215, 16%, 47%)',
};

const POSITIVE_EMOTIONS = new Set(['joy', 'calm', 'love']);
const DISTRESS_EMOTIONS = new Set(['sadness', 'fear', 'anger']);
const TRACKED_EMOTIONS = ['calm', 'joy', 'sadness', 'anger', 'fear', 'surprise', 'neutral'] as const;

const normalizeEmotion = (emotion: string): string => {
  const normalized = emotion.trim().toLowerCase();
  if (normalized === 'happy') return 'joy';
  if (normalized === 'sad') return 'sadness';
  if (normalized === 'angry') return 'anger';
  return normalized || 'neutral';
};

const createEmptyDay = (date: Date): DailyEmotionTrend => ({
  day: DAY_FORMATTER.format(date),
  calm: 0,
  joy: 0,
  sadness: 0,
  anger: 0,
  fear: 0,
  surprise: 0,
  neutral: 0,
  stress: 0,
});

export const buildEmotionDistribution = (entries: HistoryResponseItem[]): EmotionDistributionItem[] => {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    const emotion = normalizeEmotion(entry.emotion);
    counts.set(emotion, (counts.get(emotion) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([emotion, value]) => ({
      name: emotion.charAt(0).toUpperCase() + emotion.slice(1),
      value,
      color: EMOTION_TO_COLOR[emotion] ?? EMOTION_TO_COLOR.neutral,
    }));
};

export const buildWeeklyTrend = (entries: HistoryResponseItem[]): DailyEmotionTrend[] => {
  const days: DailyEmotionTrend[] = [];
  const dayMap = new Map<string, DailyEmotionTrend>();

  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - offset);
    const key = date.toISOString().slice(0, 10);
    const emptyDay = createEmptyDay(date);
    days.push(emptyDay);
    dayMap.set(key, emptyDay);
  }

  for (const entry of entries) {
    const date = new Date(entry.timestamp);
    if (Number.isNaN(date.getTime())) {
      continue;
    }
    const key = date.toISOString().slice(0, 10);
    const bucket = dayMap.get(key);
    if (!bucket) {
      continue;
    }

    const emotion = normalizeEmotion(entry.emotion) as keyof DailyEmotionTrend;
    if (TRACKED_EMOTIONS.includes(emotion as (typeof TRACKED_EMOTIONS)[number])) {
      bucket[emotion] += 1;
    } else {
      bucket.neutral += 1;
    }

    bucket.stress += DISTRESS_EMOTIONS.has(emotion) ? 1 : 0;
  }

  return days;
};

export const summarizeSessions = (entries: HistoryResponseItem[]) => {
  const recent = entries.slice(0, 7);
  const positiveCount = recent.filter((entry) => POSITIVE_EMOTIONS.has(normalizeEmotion(entry.emotion))).length;
  const distressCount = recent.filter((entry) => DISTRESS_EMOTIONS.has(normalizeEmotion(entry.emotion))).length;
  const topEmotion = buildEmotionDistribution(entries)[0]?.name ?? 'Neutral';
  const todayMood = entries[0] ? normalizeEmotion(entries[0].emotion) : 'neutral';

  return {
    todayMood: todayMood.charAt(0).toUpperCase() + todayMood.slice(1),
    weeklyTrendLabel:
      positiveCount > distressCount
        ? 'Steadier this week'
        : distressCount > positiveCount
          ? 'Needs support'
          : 'Mixed but stable',
    sessionsThisWeek: recent.length,
    topEmotion,
  };
};

export const buildInsightCards = (entries: HistoryResponseItem[]): InsightCard[] => {
  if (entries.length === 0) {
    return [
      {
        type: 'neutral',
        title: 'No session data yet',
        desc: 'Complete a few voice sessions and Emoiva will start showing meaningful patterns here.',
      },
    ];
  }

  const recent = entries.slice(0, 10);
  const distribution = buildEmotionDistribution(recent);
  const topEmotion = distribution[0]?.name ?? 'Neutral';
  const distressCount = recent.filter((entry) => DISTRESS_EMOTIONS.has(normalizeEmotion(entry.emotion))).length;
  const positiveCount = recent.filter((entry) => POSITIVE_EMOTIONS.has(normalizeEmotion(entry.emotion))).length;

  const cards: InsightCard[] = [
    {
      type: positiveCount >= distressCount ? 'positive' : 'neutral',
      title: 'Dominant emotional pattern',
      desc: `${topEmotion} has appeared most often in your recent sessions.`,
    },
    {
      type: 'neutral',
      title: 'Session consistency',
      desc: `You have ${recent.length} saved session${recent.length === 1 ? '' : 's'} in the recent window.`,
    },
  ];

  if (distressCount > positiveCount) {
    cards.push({
      type: 'attention',
      title: 'More distress signals recently',
      desc: 'Sadness, anger, or fear have appeared more often than positive states in recent sessions.',
    });
  } else {
    cards.push({
      type: 'positive',
      title: 'More grounded moments recently',
      desc: 'Calm or positive states are showing up more often in your recent sessions.',
    });
  }

  return cards;
};
