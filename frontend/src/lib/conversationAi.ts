export type ResponseRiskLevel = 'low' | 'moderate' | 'high';

export type ConversationEmotion = {
  label: string | null;
  confidence: number | null;
};

export type ConversationUtteranceRecord = {
  id: string;
  text: string;
  emotion: string | null;
  confidence: number | null;
  timestamp?: string;
  status?: 'resolved' | 'failed' | 'skipped' | 'interrupted' | 'pending';
};

export type ConversationHistoryTurn = {
  text: string;
  emotion: string | null;
  confidence: number | null;
  timestamp?: string;
};

export type ConversationIntentSignals = {
  needs_support: boolean;
  uncertainty: boolean;
  distress: boolean;
  reflection: boolean;
  repetitive_thoughts: boolean;
};

export type ConversationState = {
  turn_count: number;
  recent_question_asked: boolean;
  guidance_recently_given: boolean;
};

export type StructuredConversationInput = {
  current_input: {
    text: string;
    emotion: string | null;
    confidence: number | null;
    timestamp?: string;
  };
  context_window: ConversationHistoryTurn[];
  emotion_summary: {
    latest: string | null;
    dominant_recent: string | null;
    trend: 'stable' | 'rising' | 'falling' | 'mixed';
  };
  intent_signals: ConversationIntentSignals;
  conversation_state: ConversationState;
};

export type MemoryAwareConversationInput = StructuredConversationInput & {
  memory_context?: {
    recurring_topics: string[];
    unresolved_concerns: string[];
    support_style: 'listening' | 'reflective' | 'gentle_guidance';
    emotional_tendency: string | null;
    subtle_traits: string[];
  };
};

export type BuiltConversationContext = {
  session_id: string;
  current_input: StructuredConversationInput['current_input'];
  context_window: ConversationHistoryTurn[];
  emotion_summary: StructuredConversationInput['emotion_summary'];
  intent_signals: ConversationIntentSignals;
  conversation_state: ConversationState;
};

const MAX_CONTEXT_TURNS = 6;
const HIGH_RISK_PATTERN =
  /\b(kill myself|suicide|suicidal|end my life|don't want to live|do not want to live|hurt myself|self harm|self-harm|better off dead|want to die|can't go on|cannot go on)\b/i;
const MODERATE_RISK_PATTERN =
  /\b(hopeless|breaking down|falling apart|can't cope|cannot cope|panic|worthless|trapped|numb|exhausted|burned out|overwhelmed)\b/i;
const SUPPORT_PATTERN =
  /\b(help|support|what should i do|what do i do|i need someone|i need help|can you help)\b/i;
const UNCERTAINTY_PATTERN =
  /\b(i think|maybe|not sure|don't know|do not know|i guess|perhaps|probably)\b/i;
const REFLECTION_PATTERN =
  /\b(i feel|i felt|i've been|i have been|i realize|i noticed|i think)\b/i;
const REPETITIVE_PATTERN =
  /\b(keep thinking|again and again|over and over|can't stop thinking|cannot stop thinking|stuck on|looping)\b/i;

const normalizeText = (value: string): string => value.replace(/\s+/g, ' ').trim();

const compactTurn = (turn: ConversationHistoryTurn) => ({
  t: turn.text,
  e: turn.emotion,
  c: turn.confidence,
  ts: turn.timestamp,
});

const dedupeTurns = (turns: ConversationUtteranceRecord[]): ConversationUtteranceRecord[] => {
  const deduped: ConversationUtteranceRecord[] = [];

  for (const turn of turns) {
    const normalized = normalizeText(turn.text);
    if (!normalized) {
      continue;
    }

    const previous = deduped[deduped.length - 1];
    if (previous && normalizeText(previous.text).toLowerCase() === normalized.toLowerCase()) {
      deduped[deduped.length - 1] = {
        ...previous,
        ...turn,
        text: normalized,
      };
      continue;
    }

    deduped.push({
      ...turn,
      text: normalized,
    });
  }

  return deduped;
};

const inferIntentSignals = (turns: ConversationHistoryTurn[]): ConversationIntentSignals => {
  const combined = turns.map((turn) => normalizeText(turn.text).toLowerCase()).join(' ');
  const emotions = turns.map((turn) => turn.emotion).filter(Boolean) as string[];

  return {
    needs_support:
      SUPPORT_PATTERN.test(combined) ||
      emotions.some((emotion) => ['sad', 'anxious', 'fearful', 'angry', 'overwhelmed'].includes(emotion)),
    uncertainty: UNCERTAINTY_PATTERN.test(combined),
    distress:
      MODERATE_RISK_PATTERN.test(combined) ||
      emotions.some((emotion) => ['sad', 'anxious', 'fearful', 'angry', 'overwhelmed'].includes(emotion)),
    reflection: REFLECTION_PATTERN.test(combined),
    repetitive_thoughts: REPETITIVE_PATTERN.test(combined),
  };
};

const getDominantRecentEmotion = (turns: ConversationHistoryTurn[]): string | null => {
  const counts = new Map<string, number>();

  for (const turn of turns) {
    if (!turn.emotion) {
      continue;
    }

    counts.set(turn.emotion, (counts.get(turn.emotion) ?? 0) + 1);
  }

  let dominant: string | null = null;
  let highest = 0;

  for (const [emotion, count] of counts.entries()) {
    if (count > highest) {
      highest = count;
      dominant = emotion;
    }
  }

  return dominant;
};

const getEmotionalTrend = (turns: ConversationHistoryTurn[]): 'stable' | 'rising' | 'falling' | 'mixed' => {
  const recent = turns.map((turn) => turn.emotion).filter(Boolean) as string[];
  if (recent.length < 2) {
    return 'stable';
  }

  const unique = new Set(recent);
  if (unique.size === 1) {
    return 'stable';
  }

  const lastThree = recent.slice(-3);
  if (lastThree.every((emotion) => ['sad', 'anxious', 'fearful', 'angry', 'overwhelmed'].includes(emotion))) {
    return 'rising';
  }

  if (lastThree.every((emotion) => ['calm', 'happy', 'relieved', 'focused', 'neutral'].includes(emotion))) {
    return 'falling';
  }

  return 'mixed';
};

export const buildConversationContext = (
  sessionId: string,
  utterances: ConversationUtteranceRecord[],
  conversationState: Partial<ConversationState> = {},
): BuiltConversationContext | null => {
  const usableTurns = dedupeTurns(
    utterances.filter((utterance) => utterance.status !== 'failed' && utterance.status !== 'pending'),
  );

  if (usableTurns.length === 0) {
    return null;
  }

  const sliced = usableTurns.slice(-MAX_CONTEXT_TURNS);
  const mapped = sliced.map<ConversationHistoryTurn>((turn) => ({
    text: normalizeText(turn.text),
    emotion: turn.emotion,
    confidence: turn.confidence,
    timestamp: turn.timestamp,
  }));

  const current = mapped[mapped.length - 1];
  const contextWindow = mapped.slice(0, -1);
  const allTurns = [...contextWindow, current];
  const intentSignals = inferIntentSignals(allTurns);

  return {
    session_id: sessionId,
    current_input: current,
    context_window: contextWindow,
    emotion_summary: {
      latest: current.emotion,
      dominant_recent: getDominantRecentEmotion(allTurns),
      trend: getEmotionalTrend(allTurns),
    },
    intent_signals: intentSignals,
    conversation_state: {
      turn_count: usableTurns.length,
      recent_question_asked: Boolean(conversationState.recent_question_asked),
      guidance_recently_given: Boolean(conversationState.guidance_recently_given),
    },
  };
};

export const THERAPIST_SYSTEM_PROMPT = `
You are a warm, emotionally attuned conversational support assistant for real-time mental health check-ins.

Your job:
- respond to the user's latest message with emotional alignment first
- sound natural, calm, brief, and human
- reflect the user's emotional state without sounding clinical or scripted
- offer gentle guidance only when it fits
- ask at most one follow-up question
- never ask multiple questions in one response
- never diagnose mental health conditions
- never claim to be a therapist, doctor, or crisis professional
- never give long lists unless safety requires it
- never sound robotic, preachy, or overly cheerful

Tone rules:
- keep replies between 1 and 4 short sentences
- start with validation or reflection when emotion is negative, uncertain, or distressed
- if the user sounds neutral, respond more lightly and conversationally
- if the user sounds reflective, mirror that reflection before guiding
- if the user sounds overwhelmed, reduce complexity and slow the tone down
- avoid repeating the user's exact words unless it improves empathy
- avoid filler phrases like "I understand" or "as an AI"
- do not overuse emotion labels
- do not stack multiple coping suggestions in one reply

Behavior rules:
- prioritize emotional alignment over problem-solving
- prefer one small next step over broad advice
- if guidance is given, make it gentle and optional
- if a follow-up question is used, ask only one simple open question
- if the user appears to want space, do not push with questions
- if the user repeats the same worry, acknowledge the loop and gently ground them in the present
- if memory context is present, use it subtly to stay consistent with past conversations without sounding repetitive or intrusive
- do not restate stored memory unless it is directly relevant and natural in the reply

Safety rules:
- if the user shows high distress, hopelessness, self-harm language, or danger signals:
  - respond calmly and directly
  - validate distress without dramatizing
  - encourage immediate human support
  - suggest contacting local emergency services or a trusted person if they may be in immediate danger
  - keep the response short and grounded
- do not provide harmful instructions
- do not minimize pain
- do not escalate unless risk signals are meaningfully present

Output rules:
- return plain text only
- no markdown
- no labels
- no bullet points
- no JSON
`.trim();

export const classifyRiskLevel = (input: StructuredConversationInput): ResponseRiskLevel => {
  const latestText = input.current_input.text.toLowerCase();
  const recentText = input.context_window.map((turn) => turn.text.toLowerCase()).join(' ');
  const combined = `${latestText} ${recentText}`;

  if (HIGH_RISK_PATTERN.test(combined)) {
    return 'high';
  }

  if (
    input.intent_signals.distress ||
    MODERATE_RISK_PATTERN.test(combined) ||
    input.emotion_summary.trend === 'rising' ||
    ['sad', 'anxious', 'fearful', 'angry', 'overwhelmed'].includes(input.current_input.emotion ?? '')
  ) {
    return 'moderate';
  }

  return 'low';
};

export const buildTherapistMessages = <TInput extends MemoryAwareConversationInput>(input: TInput) => {
  const risk = classifyRiskLevel(input);

  const payload: Record<string, unknown> = {
    risk_level: risk,
    current_input: compactTurn(input.current_input),
    context_window: input.context_window.slice(-MAX_CONTEXT_TURNS).map(compactTurn),
    emotion_summary: input.emotion_summary,
    intent_signals: input.intent_signals,
    conversation_state: input.conversation_state,
    response_rules: {
      max_sentences: risk === 'high' ? 3 : 4,
      ask_follow_up_question: !input.conversation_state.recent_question_asked && risk !== 'high',
      allow_guidance:
        !input.conversation_state.guidance_recently_given || input.intent_signals.needs_support,
      prioritize_validation: true,
      prioritize_reflection:
        input.intent_signals.reflection ||
        input.intent_signals.uncertainty ||
        ['sad', 'anxious', 'fearful', 'overwhelmed'].includes(input.current_input.emotion ?? ''),
    },
  };

  if (input.memory_context) {
    payload.memory_context = input.memory_context;
  }

  return [
    {
      role: 'system' as const,
      content: THERAPIST_SYSTEM_PROMPT,
    },
    {
      role: 'user' as const,
      content: JSON.stringify(payload),
    },
  ];
};

export const postProcessTherapistResponse = (
  raw: string,
  input: StructuredConversationInput,
): string => {
  const risk = classifyRiskLevel(input);
  const cleaned = raw
    .replace(/\s+/g, ' ')
    .replace(/\*\*/g, '')
    .replace(/^["'\s]+|["'\s]+$/g, '')
    .trim();

  const sentences =
    cleaned.match(/[^.!?]+[.!?]?/g)?.map((sentence) => sentence.trim()).filter(Boolean) ?? [];
  const limited = sentences.slice(0, risk === 'high' ? 3 : 4).join(' ').trim();

  if (risk === 'high') {
    const lower = limited.toLowerCase();
    const hasSupportDirection =
      /\b(trusted person|someone you trust|local emergency|emergency services|crisis|call|text)\b/.test(lower);

    if (!hasSupportDirection) {
      return `${limited} If you might act on these feelings or feel unsafe, please contact local emergency services or reach out to someone you trust right now.`.trim();
    }
  }

  return limited;
};

export const generateTherapistResponse = async (
  input: StructuredConversationInput,
  createCompletion: (
    messages: Array<{ role: 'system' | 'user'; content: string }>,
  ) => Promise<string>,
): Promise<{ text: string; risk_level: ResponseRiskLevel }> => {
  const riskLevel = classifyRiskLevel(input);
  const messages = buildTherapistMessages(input);
  const raw = await createCompletion(messages);

  return {
    text: postProcessTherapistResponse(raw, input),
    risk_level: riskLevel,
  };
};
