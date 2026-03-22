import type { StructuredConversationInput } from '@/lib/conversationAi';

export type MemoryLayer = 'short_term' | 'mid_term' | 'long_term';
export type MemoryRisk = 'low' | 'guarded';
export type EmotionalTrend = 'stable' | 'rising' | 'falling' | 'mixed';
export type ResponseStyle = 'listening' | 'reflective' | 'gentle_guidance';

export type SessionMemory = {
  session_id: string;
  started_at: string;
  updated_at: string;
  recent_utterances: Array<{
    id: string;
    text: string;
    emotion: string | null;
    confidence: number | null;
    topic: string | null;
    intent_signals: {
      needs_support: boolean;
      uncertainty: boolean;
      distress: boolean;
      reflection: boolean;
      repetitive_thoughts: boolean;
    };
    timestamp: string;
  }>;
  current_emotional_context: {
    latest_emotion: string | null;
    dominant_recent_emotion: string | null;
    trend: EmotionalTrend;
  };
};

export type MidTermMemoryItem = {
  id: string;
  user_id: string;
  layer: 'mid_term';
  topic_key: string;
  topic_summary: string;
  emotional_pattern: {
    primary_emotion: string | null;
    secondary_emotion: string | null;
    trend: EmotionalTrend;
    frequency: number;
  };
  unresolved: boolean;
  support_preference: ResponseStyle;
  last_seen_at: string;
  first_seen_at: string;
  salience: number;
  evidence_count: number;
  risk: MemoryRisk;
};

export type LongTermMemoryItem = {
  id: string;
  user_id: string;
  layer: 'long_term';
  trait_key: string;
  trait_summary: string;
  category: 'preference' | 'recurring_stressor' | 'coping_pattern' | 'life_context';
  emotional_tendency: {
    common_emotion: string | null;
    confidence: number;
  };
  support_preference: ResponseStyle;
  strength: number;
  first_confirmed_at: string;
  last_confirmed_at: string;
  reinforcement_count: number;
  risk: MemoryRisk;
};

export type UserMemoryStore = {
  short_term: SessionMemory;
  mid_term: MidTermMemoryItem[];
  long_term: LongTermMemoryItem[];
};

export type MemoryCandidate = {
  topic_key: string | null;
  topic_summary: string | null;
  trait_key: string | null;
  trait_summary: string | null;
  category: LongTermMemoryItem['category'] | null;
  primary_emotion: string | null;
  support_preference: ResponseStyle;
  unresolved: boolean;
  should_store: boolean;
  risk: MemoryRisk;
};

export type MemoryUpdateInput = {
  user_id: string;
  session_id: string;
  utterance: {
    id: string;
    text: string;
    emotion: string | null;
    confidence: number | null;
    topic: string | null;
    timestamp: string;
  };
  intent_signals: SessionMemory['recent_utterances'][number]['intent_signals'];
  emotion_summary: SessionMemory['current_emotional_context'];
};

export type RetrievedMemoryContext = {
  mid_term: MidTermMemoryItem[];
  long_term: LongTermMemoryItem[];
  personalization: {
    support_style: ResponseStyle;
    recurring_topics: string[];
    emotional_tendency: string | null;
  };
};

export type LlmPersonalizationContext = {
  memory_context: {
    recurring_topics: string[];
    unresolved_concerns: string[];
    support_style: ResponseStyle;
    emotional_tendency: string | null;
    subtle_traits: string[];
  };
};

const MAX_SESSION_UTTERANCES = 8;
const MAX_MEMORY_ITEMS_PER_LAYER = 24;
const MAX_RETRIEVED_MID_TERM = 3;
const MAX_RETRIEVED_LONG_TERM = 2;

const HIGHLY_SENSITIVE_PATTERN =
  /\b(address|phone number|email|ssn|social security|credit card|bank account|passport|insurance|prescription|diagnosis|diagnosed|bipolar|schizophrenia|ptsd|medical record)\b/i;

const normalizeText = (value: string): string => value.replace(/\s+/g, ' ').trim();

const toTopicKey = (value: string | null): string | null => {
  if (!value) {
    return null;
  }

  const normalized = normalizeText(value).toLowerCase();
  return normalized || null;
};

export const inferMemoryTopic = (text: string): string | null => {
  const normalized = normalizeText(text).toLowerCase();
  if (!normalized) {
    return null;
  }

  const topicMatchers: Array<[string, RegExp]> = [
    ['work', /\b(work|career|job|boss|coworker|office|deadline|promotion)\b/],
    ['family', /\b(family|parent|mother|father|sister|brother|home)\b/],
    ['relationship', /\b(relationship|partner|boyfriend|girlfriend|marriage|dating|breakup)\b/],
    ['sleep', /\b(sleep|slept|insomnia|tired|exhausted|rest)\b/],
    ['money', /\b(money|finance|rent|bills|debt|salary)\b/],
    ['health', /\b(health|body|pain|sick|illness|doctor)\b/],
    ['school', /\b(school|college|study|exam|class|university)\b/],
    ['self-worth', /\b(confidence|self-esteem|worthless|failure|not good enough)\b/],
  ];

  for (const [topic, pattern] of topicMatchers) {
    if (pattern.test(normalized)) {
      return topic;
    }
  }

  return null;
};

const scoreSupportPreference = (
  text: string,
  signals: MemoryUpdateInput['intent_signals'],
): ResponseStyle => {
  const normalized = normalizeText(text).toLowerCase();

  if (signals.needs_support || /\b(what should i do|help me|i need help|how do i)\b/.test(normalized)) {
    return 'gentle_guidance';
  }

  if (signals.reflection || /\b(i feel|i've been|i have been|i keep thinking)\b/.test(normalized)) {
    return 'reflective';
  }

  return 'listening';
};

const inferLongTermCategory = (
  topicKey: string | null,
  text: string,
): LongTermMemoryItem['category'] | null => {
  const normalized = normalizeText(text).toLowerCase();

  if (/\b(work|career|job|school|study|exam|family|relationship|money|sleep)\b/.test(normalized)) {
    return 'recurring_stressor';
  }

  if (/\b(walk|journal|breathing|music|exercise|talking to a friend|rest)\b/.test(normalized)) {
    return 'coping_pattern';
  }

  if (/\b(prefer|helps me when|i like when|please be direct|please go slow)\b/.test(normalized)) {
    return 'preference';
  }

  if (topicKey) {
    return 'life_context';
  }

  return null;
};

export const buildMemoryCandidate = (input: MemoryUpdateInput): MemoryCandidate => {
  const text = normalizeText(input.utterance.text);
  const topicKey = toTopicKey(input.utterance.topic) ?? inferMemoryTopic(text);
  const supportPreference = scoreSupportPreference(text, input.intent_signals);
  const sensitive = HIGHLY_SENSITIVE_PATTERN.test(text);

  const shouldStoreTopic =
    Boolean(topicKey) &&
    text.length >= 20 &&
    !sensitive &&
    !input.intent_signals.repetitive_thoughts;

  const longTermCategory = inferLongTermCategory(topicKey, text);
  const shouldStoreTrait =
    Boolean(longTermCategory) &&
    !sensitive &&
    (input.intent_signals.needs_support ||
      input.intent_signals.reflection ||
      input.emotion_summary.trend !== 'stable');

  return {
    topic_key: shouldStoreTopic ? topicKey : null,
    topic_summary: shouldStoreTopic
      ? `User often discusses ${topicKey} with a ${input.utterance.emotion ?? 'mixed'} emotional tone.`
      : null,
    trait_key: shouldStoreTrait && topicKey ? `${longTermCategory}:${topicKey}` : null,
    trait_summary:
      shouldStoreTrait && topicKey
        ? `User frequently returns to ${topicKey} and responds best to ${supportPreference.replace('_', ' ')} support.`
        : null,
    category: shouldStoreTrait ? longTermCategory : null,
    primary_emotion: input.utterance.emotion,
    support_preference: supportPreference,
    unresolved:
      input.intent_signals.uncertainty ||
      input.intent_signals.repetitive_thoughts ||
      ['sad', 'anxious', 'fearful', 'overwhelmed'].includes(input.utterance.emotion ?? ''),
    should_store: shouldStoreTopic || shouldStoreTrait,
    risk: sensitive ? 'guarded' : 'low',
  };
};

export const updateSessionMemory = (
  session: SessionMemory,
  input: MemoryUpdateInput,
): SessionMemory => {
  const nextUtterance = {
    id: input.utterance.id,
    text: normalizeText(input.utterance.text),
    emotion: input.utterance.emotion,
    confidence: input.utterance.confidence,
    topic: input.utterance.topic,
    intent_signals: input.intent_signals,
    timestamp: input.utterance.timestamp,
  };

  return {
    ...session,
    updated_at: input.utterance.timestamp,
    recent_utterances: [...session.recent_utterances, nextUtterance].slice(-MAX_SESSION_UTTERANCES),
    current_emotional_context: input.emotion_summary,
  };
};

export const updateMidTermMemory = (
  memories: MidTermMemoryItem[],
  input: MemoryUpdateInput,
): MidTermMemoryItem[] => {
  const candidate = buildMemoryCandidate(input);
  if (!candidate.should_store || !candidate.topic_key || !candidate.topic_summary) {
    return memories;
  }

  const existing = memories.find((memory) => memory.topic_key === candidate.topic_key);
  const updatedAt = input.utterance.timestamp;

  if (existing) {
    return memories
      .map((memory) =>
        memory.id !== existing.id
          ? memory
          : {
              ...memory,
              topic_summary: candidate.topic_summary ?? memory.topic_summary,
              emotional_pattern: {
                primary_emotion: candidate.primary_emotion ?? memory.emotional_pattern.primary_emotion,
                secondary_emotion: memory.emotional_pattern.secondary_emotion,
                trend: input.emotion_summary.trend,
                frequency: memory.emotional_pattern.frequency + 1,
              },
              unresolved: candidate.unresolved || memory.unresolved,
              support_preference: candidate.support_preference,
              last_seen_at: updatedAt,
              salience: Math.min(1, memory.salience + 0.08),
              evidence_count: memory.evidence_count + 1,
            },
      )
      .sort((a, b) => b.last_seen_at.localeCompare(a.last_seen_at))
      .slice(0, MAX_MEMORY_ITEMS_PER_LAYER);
  }

  const created: MidTermMemoryItem = {
    id: `mid-${input.user_id}-${candidate.topic_key}`,
    user_id: input.user_id,
    layer: 'mid_term',
    topic_key: candidate.topic_key,
    topic_summary: candidate.topic_summary,
    emotional_pattern: {
      primary_emotion: candidate.primary_emotion,
      secondary_emotion: null,
      trend: input.emotion_summary.trend,
      frequency: 1,
    },
    unresolved: candidate.unresolved,
    support_preference: candidate.support_preference,
    first_seen_at: updatedAt,
    last_seen_at: updatedAt,
    salience: 0.55,
    evidence_count: 1,
    risk: candidate.risk,
  };

  return [created, ...memories]
    .sort((a, b) => b.last_seen_at.localeCompare(a.last_seen_at))
    .slice(0, MAX_MEMORY_ITEMS_PER_LAYER);
};

export const updateLongTermMemory = (
  memories: LongTermMemoryItem[],
  input: MemoryUpdateInput,
): LongTermMemoryItem[] => {
  const candidate = buildMemoryCandidate(input);
  if (!candidate.should_store || !candidate.trait_key || !candidate.trait_summary || !candidate.category) {
    return memories;
  }

  const existing = memories.find((memory) => memory.trait_key === candidate.trait_key);
  const updatedAt = input.utterance.timestamp;

  if (existing) {
    return memories
      .map((memory) =>
        memory.id !== existing.id
          ? memory
          : {
              ...memory,
              trait_summary: candidate.trait_summary ?? memory.trait_summary,
              emotional_tendency: {
                common_emotion: candidate.primary_emotion ?? memory.emotional_tendency.common_emotion,
                confidence: Math.min(1, memory.emotional_tendency.confidence + 0.05),
              },
              support_preference: candidate.support_preference,
              strength: Math.min(1, memory.strength + 0.06),
              last_confirmed_at: updatedAt,
              reinforcement_count: memory.reinforcement_count + 1,
            },
      )
      .sort((a, b) => b.last_confirmed_at.localeCompare(a.last_confirmed_at))
      .slice(0, MAX_MEMORY_ITEMS_PER_LAYER);
  }

  const created: LongTermMemoryItem = {
    id: `long-${input.user_id}-${candidate.trait_key}`,
    user_id: input.user_id,
    layer: 'long_term',
    trait_key: candidate.trait_key,
    trait_summary: candidate.trait_summary,
    category: candidate.category,
    emotional_tendency: {
      common_emotion: candidate.primary_emotion,
      confidence: 0.58,
    },
    support_preference: candidate.support_preference,
    strength: 0.55,
    first_confirmed_at: updatedAt,
    last_confirmed_at: updatedAt,
    reinforcement_count: 1,
    risk: candidate.risk,
  };

  return [created, ...memories]
    .sort((a, b) => b.last_confirmed_at.localeCompare(a.last_confirmed_at))
    .slice(0, MAX_MEMORY_ITEMS_PER_LAYER);
};

export const updateUserMemoryStore = (
  store: UserMemoryStore,
  input: MemoryUpdateInput,
): UserMemoryStore => {
  return {
    short_term: updateSessionMemory(store.short_term, input),
    mid_term: updateMidTermMemory(store.mid_term, input),
    long_term: updateLongTermMemory(store.long_term, input),
  };
};

const scoreMidTermMemory = (
  memory: MidTermMemoryItem,
  currentTopic: string | null,
  currentEmotion: string | null,
): number => {
  let score = memory.salience;

  if (currentTopic && memory.topic_key === currentTopic.toLowerCase()) {
    score += 1.1;
  }

  if (currentEmotion && memory.emotional_pattern.primary_emotion === currentEmotion) {
    score += 0.45;
  }

  if (memory.unresolved) {
    score += 0.35;
  }

  return score;
};

const scoreLongTermMemory = (
  memory: LongTermMemoryItem,
  currentTopic: string | null,
  currentEmotion: string | null,
): number => {
  let score = memory.strength;

  if (currentTopic && memory.trait_key.includes(currentTopic.toLowerCase())) {
    score += 0.9;
  }

  if (currentEmotion && memory.emotional_tendency.common_emotion === currentEmotion) {
    score += 0.35;
  }

  return score;
};

export const retrieveRelevantMemory = (
  store: UserMemoryStore,
  current: {
    topic: string | null;
    emotion: string | null;
  },
): RetrievedMemoryContext => {
  const midTerm = [...store.mid_term]
    .filter((memory) => memory.risk === 'low')
    .sort(
      (a, b) =>
        scoreMidTermMemory(b, current.topic, current.emotion) -
        scoreMidTermMemory(a, current.topic, current.emotion),
    )
    .slice(0, MAX_RETRIEVED_MID_TERM);

  const longTerm = [...store.long_term]
    .filter((memory) => memory.risk === 'low')
    .sort(
      (a, b) =>
        scoreLongTermMemory(b, current.topic, current.emotion) -
        scoreLongTermMemory(a, current.topic, current.emotion),
    )
    .slice(0, MAX_RETRIEVED_LONG_TERM);

  const supportPreferenceCounts = [...midTerm, ...longTerm].reduce<Record<ResponseStyle, number>>(
    (accumulator, memory) => {
      accumulator[memory.support_preference] += 1;
      return accumulator;
    },
    {
      listening: 0,
      reflective: 0,
      gentle_guidance: 0,
    },
  );

  const supportStyle = (Object.entries(supportPreferenceCounts).sort(
    (a, b) => b[1] - a[1],
  )[0]?.[0] ?? 'listening') as ResponseStyle;

  return {
    mid_term: midTerm,
    long_term: longTerm,
    personalization: {
      support_style: supportStyle,
      recurring_topics: midTerm.map((memory) => memory.topic_key),
      emotional_tendency: longTerm[0]?.emotional_tendency.common_emotion ?? null,
    },
  };
};

export const injectPersonalizationIntoLlmInput = <
  TBase extends {
    current_input: StructuredConversationInput['current_input'];
    context_window: StructuredConversationInput['context_window'];
    emotion_summary: StructuredConversationInput['emotion_summary'];
    intent_signals: StructuredConversationInput['intent_signals'];
    conversation_state: StructuredConversationInput['conversation_state'];
  },
>(
  baseInput: TBase,
  retrieved: RetrievedMemoryContext,
): TBase & LlmPersonalizationContext => {
  return {
    ...baseInput,
    memory_context: {
      recurring_topics: retrieved.personalization.recurring_topics,
      unresolved_concerns: retrieved.mid_term
        .filter((memory) => memory.unresolved)
        .map((memory) => memory.topic_summary)
        .slice(0, 2),
      support_style: retrieved.personalization.support_style,
      emotional_tendency: retrieved.personalization.emotional_tendency,
      subtle_traits: retrieved.long_term.map((memory) => memory.trait_summary).slice(0, 2),
    },
  };
};

export const resetUserMemoryStore = (
  userId: string,
  sessionId: string,
  nowIso: string,
): UserMemoryStore => {
  void userId;

  return {
    short_term: {
      session_id: sessionId,
      started_at: nowIso,
      updated_at: nowIso,
      recent_utterances: [],
      current_emotional_context: {
        latest_emotion: null,
        dominant_recent_emotion: null,
        trend: 'stable',
      },
    },
    mid_term: [],
    long_term: [],
  };
};
