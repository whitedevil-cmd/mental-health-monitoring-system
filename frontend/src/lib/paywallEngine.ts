export type PaywallReason =
  | 'minute_cap'
  | 'session_count'
  | 'insight_moment'
  | 'memory_limit'
  | null;

export type UserStage = 'new' | 'engaged' | 'habit';

export type EmotionState = {
  label: string | null;
  confidence: number;
};

export type PaywallContext = {
  emotion_state: string | null;
  user_stage: UserStage;
};

export type PaywallDecision = {
  should_show_paywall: boolean;
  reason: PaywallReason;
  context: PaywallContext;
};

export type PaywallEventMap = {
  minutes_updated: {
    total_minutes_used_today?: number;
    minutes_delta?: number;
    emotion_state?: Partial<EmotionState> | null;
  };
  session_completed: {
    sessions_completed_today?: number;
    emotion_state?: Partial<EmotionState> | null;
  };
  insight_generated: {
    generated: boolean;
    emotion_state?: Partial<EmotionState> | null;
  };
  memory_limit_hit: {
    hit: boolean;
    emotion_state?: Partial<EmotionState> | null;
  };
  session_started: {
    emotion_state?: Partial<EmotionState> | null;
  };
};

export type PaywallEventType = keyof PaywallEventMap;

export type PaywallEvent<T extends PaywallEventType = PaywallEventType> = {
  type: T;
  timestamp: number;
  session_id: string;
  payload: PaywallEventMap[T];
};

export type PaywallEngineState = {
  total_minutes_used_today: number;
  sessions_completed_today: number;
  sessions_completed_total: number;
  last_state_updated_at: number | null;
  last_paywall_shown_at: number | null;
  paywall_shown_count_today: number;
  paywall_shown_count_week: number;
  last_paywall_reason: Exclude<PaywallReason, null> | null;
  current_emotion_state: EmotionState;
  user_stage: UserStage;
  active_session_id: string | null;
  first_session_id: string | null;
  pending_reason: Exclude<PaywallReason, null> | null;
  last_meaningful_trigger_at: number | null;
  dismissed_after_trigger_at: number | null;
  processed_event_ids: string[];
};

const DAILY_MS = 24 * 60 * 60 * 1000;
const WEEKLY_MS = 7 * DAILY_MS;
const MAX_TRACKED_EVENT_IDS = 256;
const DISTRESS_EMOTIONS = new Set(['sad', 'anxious', 'fearful', 'overwhelmed']);

export const createInitialPaywallState = (): PaywallEngineState => ({
  total_minutes_used_today: 0,
  sessions_completed_today: 0,
  sessions_completed_total: 0,
  last_state_updated_at: null,
  last_paywall_shown_at: null,
  paywall_shown_count_today: 0,
  paywall_shown_count_week: 0,
  last_paywall_reason: null,
  current_emotion_state: {
    label: null,
    confidence: 0,
  },
  user_stage: 'new',
  active_session_id: null,
  first_session_id: null,
  pending_reason: null,
  last_meaningful_trigger_at: null,
  dismissed_after_trigger_at: null,
  processed_event_ids: [],
});

const normalizeEmotionState = (
  current: EmotionState,
  next: Partial<EmotionState> | null | undefined,
): EmotionState => {
  if (!next) {
    return current;
  }

  return {
    label: next.label === undefined ? current.label : next.label ?? null,
    confidence:
      typeof next.confidence === 'number'
        ? Math.max(0, Math.min(1, next.confidence))
        : current.confidence,
  };
};

const deriveUserStage = (sessionsCompletedTotal: number): UserStage => {
  if (sessionsCompletedTotal >= 8) {
    return 'habit';
  }

  if (sessionsCompletedTotal >= 3) {
    return 'engaged';
  }

  return 'new';
};

const isDistressState = (emotionState: EmotionState): boolean => {
  return Boolean(
    emotionState.label &&
      DISTRESS_EMOTIONS.has(emotionState.label) &&
      emotionState.confidence >= 0.7,
  );
};

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  return `{${entries
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
    .join(',')}}`;
};

const buildEventId = (event: PaywallEvent): string => {
  return `${event.type}:${event.timestamp}:${event.session_id}:${stableStringify(event.payload)}`;
};

const trimProcessedIds = (ids: string[]): string[] => {
  if (ids.length <= MAX_TRACKED_EVENT_IDS) {
    return ids;
  }

  return ids.slice(ids.length - MAX_TRACKED_EVENT_IDS);
};

const getTodayBucket = (timestamp: number): number => Math.floor(timestamp / DAILY_MS);
const getWeekBucket = (timestamp: number): number => Math.floor(timestamp / WEEKLY_MS);

const resetCountersIfNeeded = (
  state: PaywallEngineState,
  timestamp: number,
): PaywallEngineState => {
  if (state.last_state_updated_at !== null && timestamp < state.last_state_updated_at) {
    return state;
  }

  let nextState = state;

  if (
    state.last_state_updated_at !== null &&
    getTodayBucket(state.last_state_updated_at) !== getTodayBucket(timestamp)
  ) {
    nextState = {
      ...nextState,
      total_minutes_used_today: 0,
      sessions_completed_today: 0,
      paywall_shown_count_today: 0,
    };
  }

  if (
    state.last_state_updated_at !== null &&
    getWeekBucket(state.last_state_updated_at) !== getWeekBucket(timestamp)
  ) {
    nextState = {
      ...nextState,
      paywall_shown_count_week: 0,
    };
  }

  return nextState;
};

const recordMeaningfulTrigger = (
  state: PaywallEngineState,
  reason: Exclude<PaywallReason, null>,
  timestamp: number,
): PaywallEngineState => {
  return {
    ...state,
    pending_reason: reason,
    last_meaningful_trigger_at: timestamp,
  };
};

const shouldBlockForFrequency = (
  state: PaywallEngineState,
  timestamp: number,
): boolean => {
  const sameDay =
    state.last_paywall_shown_at !== null &&
    getTodayBucket(state.last_paywall_shown_at) === getTodayBucket(timestamp);
  const sameWeek =
    state.last_paywall_shown_at !== null &&
    getWeekBucket(state.last_paywall_shown_at) === getWeekBucket(timestamp);

  if (sameDay && state.paywall_shown_count_today >= 1) {
    return true;
  }

  if (sameWeek && state.paywall_shown_count_week >= 3) {
    return true;
  }

  return false;
};

const shouldBlockForDismissal = (
  state: PaywallEngineState,
  timestamp: number,
): boolean => {
  if (state.dismissed_after_trigger_at === null || state.last_meaningful_trigger_at === null) {
    return false;
  }

  return (
    state.dismissed_after_trigger_at >= state.last_meaningful_trigger_at &&
    state.last_meaningful_trigger_at <= timestamp
  );
};

const defaultDecision = (state: PaywallEngineState): PaywallDecision => ({
  should_show_paywall: false,
  reason: null,
  context: {
    emotion_state: state.current_emotion_state.label,
    user_stage: state.user_stage,
  },
});

const finalizeDecision = (
  state: PaywallEngineState,
  timestamp: number,
  reason: Exclude<PaywallReason, null>,
): { state: PaywallEngineState; decision: PaywallDecision } => {
  if (shouldBlockForFrequency(state, timestamp) || shouldBlockForDismissal(state, timestamp)) {
    return {
      state,
      decision: defaultDecision(state),
    };
  }

  const sameDay =
    state.last_paywall_shown_at !== null &&
    getTodayBucket(state.last_paywall_shown_at) === getTodayBucket(timestamp);
  const sameWeek =
    state.last_paywall_shown_at !== null &&
    getWeekBucket(state.last_paywall_shown_at) === getWeekBucket(timestamp);

  const nextState: PaywallEngineState = {
    ...state,
    last_paywall_shown_at: timestamp,
    paywall_shown_count_today: sameDay ? state.paywall_shown_count_today + 1 : 1,
    paywall_shown_count_week: sameWeek ? state.paywall_shown_count_week + 1 : 1,
    last_paywall_reason: reason,
    pending_reason: null,
    dismissed_after_trigger_at: null,
  };

  return {
    state: nextState,
    decision: {
      should_show_paywall: true,
      reason,
      context: {
        emotion_state: nextState.current_emotion_state.label,
        user_stage: nextState.user_stage,
      },
    },
  };
};

const applyEventState = (
  state: PaywallEngineState,
  event: PaywallEvent,
): PaywallEngineState => {
  const baseState = resetCountersIfNeeded(state, event.timestamp);
  const emotionState = normalizeEmotionState(
    baseState.current_emotion_state,
    (event.payload as { emotion_state?: Partial<EmotionState> | null }).emotion_state,
  );

  switch (event.type) {
    case 'session_started': {
      return {
        ...baseState,
        last_state_updated_at: Math.max(baseState.last_state_updated_at ?? 0, event.timestamp),
        current_emotion_state: emotionState,
        active_session_id: event.session_id,
        first_session_id: baseState.first_session_id ?? event.session_id,
      };
    }

    case 'minutes_updated': {
      const payload = event.payload;
      const totalMinutes =
        typeof payload.total_minutes_used_today === 'number'
          ? Math.max(baseState.total_minutes_used_today, payload.total_minutes_used_today)
          : baseState.total_minutes_used_today + Math.max(0, payload.minutes_delta ?? 0);

      return {
        ...baseState,
        last_state_updated_at: Math.max(baseState.last_state_updated_at ?? 0, event.timestamp),
        current_emotion_state: emotionState,
        total_minutes_used_today: totalMinutes,
      };
    }

    case 'session_completed': {
      const sessionsCompletedToday =
        typeof event.payload.sessions_completed_today === 'number'
          ? Math.max(baseState.sessions_completed_today, event.payload.sessions_completed_today)
          : baseState.sessions_completed_today + 1;
      const sessionsCompletedTotal = baseState.sessions_completed_total + 1;

      return {
        ...baseState,
        last_state_updated_at: Math.max(baseState.last_state_updated_at ?? 0, event.timestamp),
        current_emotion_state: emotionState,
        active_session_id:
          baseState.active_session_id === event.session_id ? null : baseState.active_session_id,
        sessions_completed_today: sessionsCompletedToday,
        sessions_completed_total: sessionsCompletedTotal,
        user_stage: deriveUserStage(sessionsCompletedTotal),
      };
    }

    case 'insight_generated': {
      return {
        ...baseState,
        last_state_updated_at: Math.max(baseState.last_state_updated_at ?? 0, event.timestamp),
        current_emotion_state: emotionState,
      };
    }

    case 'memory_limit_hit': {
      return {
        ...baseState,
        last_state_updated_at: Math.max(baseState.last_state_updated_at ?? 0, event.timestamp),
        current_emotion_state: emotionState,
      };
    }

    default: {
      return baseState;
    }
  }
};

const deriveTriggerReason = (
  state: PaywallEngineState,
  event: PaywallEvent,
): Exclude<PaywallReason, null> | null => {
  if (event.type === 'memory_limit_hit' && event.payload.hit) {
    return 'memory_limit';
  }

  if (event.type === 'insight_generated' && event.payload.generated) {
    return 'insight_moment';
  }

  if (state.total_minutes_used_today >= 12) {
    return 'minute_cap';
  }

  if (state.sessions_completed_total >= 3) {
    return 'session_count';
  }

  return null;
};

export const reducePaywallState = (
  state: PaywallEngineState,
  event: PaywallEvent,
): { state: PaywallEngineState; decision: PaywallDecision } => {
  const eventId = buildEventId(event);
  if (state.processed_event_ids.includes(eventId)) {
    return {
      state,
      decision: defaultDecision(state),
    };
  }

  let nextState = applyEventState(state, event);
  nextState = {
    ...nextState,
    processed_event_ids: trimProcessedIds([...nextState.processed_event_ids, eventId]),
  };

  const isFirstSession =
    nextState.first_session_id !== null &&
    event.session_id === nextState.first_session_id &&
    nextState.sessions_completed_total <= 1;
  if (isFirstSession) {
    return {
      state: nextState,
      decision: defaultDecision(nextState),
    };
  }

  const pendingSessionEndTrigger =
    event.type === 'session_completed' ? nextState.pending_reason : null;
  const triggerReason = pendingSessionEndTrigger ?? deriveTriggerReason(nextState, event);

  if (!triggerReason) {
    return {
      state: nextState,
      decision: defaultDecision(nextState),
    };
  }

  nextState = recordMeaningfulTrigger(nextState, triggerReason, event.timestamp);

  if (
    event.type !== 'session_completed' &&
    nextState.active_session_id === event.session_id &&
    isDistressState(nextState.current_emotion_state)
  ) {
    return {
      state: nextState,
      decision: defaultDecision(nextState),
    };
  }

  return finalizeDecision(nextState, event.timestamp, triggerReason);
};

export const recordPaywallDismissed = (
  state: PaywallEngineState,
  timestamp: number,
): PaywallEngineState => {
  return {
    ...state,
    dismissed_after_trigger_at: timestamp,
  };
};

export const createPaywallEngine = (initialState?: Partial<PaywallEngineState>) => {
  let state: PaywallEngineState = {
    ...createInitialPaywallState(),
    ...initialState,
  };

  return {
    evaluatePaywall(event: PaywallEvent): PaywallDecision {
      const result = reducePaywallState(state, event);
      state = result.state;
      return result.decision;
    },
    dismissPaywall(timestamp: number): void {
      state = recordPaywallDismissed(state, timestamp);
    },
    getState(): PaywallEngineState {
      return {
        ...state,
        current_emotion_state: { ...state.current_emotion_state },
        processed_event_ids: [...state.processed_event_ids],
      };
    },
    reset(nextState?: Partial<PaywallEngineState>): void {
      state = {
        ...createInitialPaywallState(),
        ...nextState,
      };
    },
  };
};
