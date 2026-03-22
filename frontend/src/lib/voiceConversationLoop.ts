import {
  buildConversationContext,
  buildTherapistMessages,
  classifyRiskLevel,
  postProcessTherapistResponse,
  type ConversationUtteranceRecord,
  type MemoryAwareConversationInput,
  type StructuredConversationInput,
} from '@/lib/conversationAi';
import {
  inferMemoryTopic,
  injectPersonalizationIntoLlmInput,
  resetUserMemoryStore,
  retrieveRelevantMemory,
  updateUserMemoryStore,
  type UserMemoryStore,
} from '@/lib/memoryPersonalization';
import { apiClient } from '@/lib/apiClient';

type EmotionResult = {
  emotion: string | null;
  confidence: number | null;
};

export type AssistantResponseState = 'idle' | 'thinking' | 'speaking';

export type AssistantTurn = ConversationUtteranceRecord & {
  role: 'user' | 'assistant';
  response_to?: string;
};

export type LlmMessage = {
  role: 'system' | 'user';
  content: string;
};

type ConversationState = {
  turn_count: number;
  recent_question_asked: boolean;
  guidance_recently_given: boolean;
};

export type LoopUiCallbacks = {
  onTurnsChanged: (turns: AssistantTurn[]) => void;
  onAssistantStateChanged: (state: AssistantResponseState) => void;
  onAssistantTextStreaming: (text: string) => void;
  onAssistantTextReady: (text: string) => void;
  onAssistantSpeechStarted: () => void;
  onAssistantSpeechEnded: () => void;
  onError: (message: string) => void;
  onLatencyMeasured?: (breakdown: VoiceLatencyBreakdown) => void;
};

export type VoiceLatencyBreakdown = {
  utterance_id: string;
  speech_to_final_transcript_ms: number | null;
  transcript_to_emotion_ms: number | null;
  transcript_to_llm_first_token_ms: number | null;
  transcript_to_llm_complete_ms: number | null;
  llm_to_tts_first_request_ms: number | null;
  tts_first_audio_ready_ms: number | null;
  tts_to_playback_start_ms: number | null;
  final_transcript_to_playback_start_ms: number | null;
  final_transcript_to_assistant_text_ms: number | null;
  total_end_to_end_ms: number | null;
  tts_cache_hit: boolean;
  bottleneck_stage:
    | 'speech_to_final_transcript'
    | 'transcript_to_emotion'
    | 'transcript_to_llm_first_token'
    | 'transcript_to_llm_complete'
    | 'llm_to_tts_first_request'
    | 'tts_first_audio_ready'
    | 'tts_to_playback_start'
    | 'final_transcript_to_assistant_text'
    | 'unknown';
};

export interface EmotionClient {
  analyzeText(text: string, signal?: AbortSignal): Promise<EmotionResult>;
}

export interface LlmClient {
  streamResponse(messages: LlmMessage[], signal?: AbortSignal): Promise<AsyncIterable<string>>;
}

export interface TtsClient {
  synthesize(text: string, signal?: AbortSignal): Promise<ArrayBuffer>;
}

export interface SessionPersistenceClient {
  saveSession(payload: {
    user_id: string;
    text: string;
    emotion: string;
    confidence: number | null;
    timestamp?: string;
  }): Promise<{
    id?: number;
    created_at?: string;
  }>;
}

type AudioContextFactory = () => AudioContext;
type NowProvider = () => number;

const EMOTION_WAIT_BUDGET_MS = 300;
const TTS_CHUNK_MAX_CHARS = 220;
const TTS_CHUNK_FALLBACK_CHARS = 140;
const FIRST_TTS_CHUNK_MIN_CHARS = 72;
const FIRST_TTS_CHUNK_MIN_WORDS = 10;
const MAX_TTS_CACHE_ITEMS = 24;
const LLM_STREAM_IDLE_TIMEOUT_MS = 1_000;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => window.setTimeout(resolve, ms));

const createAbortError = (): Error => {
  return new DOMException('The operation was aborted.', 'AbortError');
};

const createIdleTimeoutError = (): Error => {
  return new Error('LlmStreamIdleTimeout');
};

const isAbortError = (error: unknown): boolean => {
  return error instanceof DOMException
    ? error.name === 'AbortError'
    : error instanceof Error && error.name === 'AbortError';
};

const isIdleTimeoutError = (error: unknown): boolean => {
  return error instanceof Error && error.message === 'LlmStreamIdleTimeout';
};

const waitForAbort = (signal: AbortSignal): Promise<never> => {
  if (signal.aborted) {
    return Promise.reject(createAbortError());
  }

  return new Promise<never>((_, reject) => {
    const handleAbort = () => {
      signal.removeEventListener('abort', handleAbort);
      reject(createAbortError());
    };

    signal.addEventListener('abort', handleAbort, { once: true });
  });
};

const waitForIdleTimeout = (timeoutMs: number): Promise<never> => {
  return new Promise<never>((_, reject) => {
    window.setTimeout(() => reject(createIdleTimeoutError()), timeoutMs);
  });
};

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number): Promise<T | null> => {
  let timer = 0;
  try {
    return await Promise.race<T | null>([
      promise,
      new Promise<null>((resolve) => {
        timer = window.setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      window.clearTimeout(timer);
    }
  }
};

const normalizeText = (value: string): string => value.replace(/\s+/g, ' ').trim();
const countWords = (value: string): number => normalizeText(value).split(' ').filter(Boolean).length;

const endsWithQuestion = (value: string): boolean => /\?\s*$/.test(value.trim());
const containsGuidance = (value: string): boolean =>
  /\b(try|consider|maybe you could|it might help|one small step|for now)\b/i.test(value);

type PendingLatencyTrace = {
  utteranceId: string;
  speechStartedAt: number | null;
  finalTranscriptAt: number;
  emotionCompletedAt: number | null;
  llmRequestStartedAt: number | null;
  llmFirstTokenAt: number | null;
  llmCompletedAt: number | null;
  firstTtsRequestAt: number | null;
  firstAudioReadyAt: number | null;
  playbackStartedAt: number | null;
  assistantTextReadyAt: number | null;
  ttsCacheHit: boolean;
};

const duration = (start: number | null, end: number | null): number | null => {
  if (start === null || end === null) {
    return null;
  }

  return Math.max(0, Math.round(end - start));
};

const determineBottleneckStage = (
  metrics: Omit<VoiceLatencyBreakdown, 'utterance_id' | 'tts_cache_hit' | 'bottleneck_stage'>,
): VoiceLatencyBreakdown['bottleneck_stage'] => {
  const stages: Array<[VoiceLatencyBreakdown['bottleneck_stage'], number | null]> = [
    ['speech_to_final_transcript', metrics.speech_to_final_transcript_ms],
    ['transcript_to_emotion', metrics.transcript_to_emotion_ms],
    ['transcript_to_llm_first_token', metrics.transcript_to_llm_first_token_ms],
    ['transcript_to_llm_complete', metrics.transcript_to_llm_complete_ms],
    ['llm_to_tts_first_request', metrics.llm_to_tts_first_request_ms],
    ['tts_first_audio_ready', metrics.tts_first_audio_ready_ms],
    ['tts_to_playback_start', metrics.tts_to_playback_start_ms],
    ['final_transcript_to_assistant_text', metrics.final_transcript_to_assistant_text_ms],
  ];

  const winner = stages.reduce<[VoiceLatencyBreakdown['bottleneck_stage'], number] | null>(
    (current, candidate) => {
      const [name, value] = candidate;
      if (value === null) {
        return current;
      }

      if (!current || value > current[1]) {
        return [name, value];
      }

      return current;
    },
    null,
  );

  return winner?.[0] ?? 'unknown';
};

class SentenceChunker {
  private buffer = '';
  private hasFlushedOnce = false;

  push(token: string): string[] {
    this.buffer += token;
    return this.flushReady(false);
  }

  finish(): string[] {
    return this.flushReady(true);
  }

  private flushReady(force: boolean): string[] {
    const out: string[] = [];
    let working = this.buffer;

    while (working.length > 0) {
      if (!this.hasFlushedOnce && !force) {
        const normalized = normalizeText(working);
        if (
          normalized.length >= FIRST_TTS_CHUNK_MIN_CHARS &&
          countWords(normalized) >= FIRST_TTS_CHUNK_MIN_WORDS
        ) {
          const splitIndex = this.findSoftBoundary(
            working,
            Math.min(TTS_CHUNK_MAX_CHARS, normalized.length),
          );
          const chunk = normalizeText(working.slice(0, splitIndex));
          if (chunk) {
            out.push(chunk);
            this.hasFlushedOnce = true;
          }
          working = working.slice(splitIndex);
          continue;
        }
      }

      const sentenceMatch = working.match(/^([\s\S]*?[.!?])(\s|$)/);
      if (sentenceMatch) {
        const sentence = normalizeText(sentenceMatch[1]);
        if (sentence) {
          out.push(sentence);
          this.hasFlushedOnce = true;
        }
        working = working.slice(sentenceMatch[0].length);
        continue;
      }

      if (working.length >= TTS_CHUNK_MAX_CHARS) {
        const splitIndex = this.findSoftBoundary(working, TTS_CHUNK_MAX_CHARS);
        const chunk = normalizeText(working.slice(0, splitIndex));
        if (chunk) {
          out.push(chunk);
          this.hasFlushedOnce = true;
        }
        working = working.slice(splitIndex);
        continue;
      }

      if (force) {
        const finalChunk = normalizeText(working);
        if (finalChunk) {
          out.push(finalChunk);
          this.hasFlushedOnce = true;
        }
        working = '';
        continue;
      }

      break;
    }

    this.buffer = working;
    return out;
  }

  private findSoftBoundary(value: string, preferredLimit: number): number {
    const preferred = Math.max(
      value.lastIndexOf(',', preferredLimit),
      value.lastIndexOf(';', preferredLimit),
      value.lastIndexOf(':', preferredLimit),
    );

    if (preferred >= TTS_CHUNK_FALLBACK_CHARS) {
      return preferred + 1;
    }

    const spaceIndex = value.lastIndexOf(' ', preferredLimit);
    if (spaceIndex >= TTS_CHUNK_FALLBACK_CHARS) {
      return spaceIndex + 1;
    }

    return preferredLimit;
  }
}

class AudioPlaybackQueue {
  private readonly audioContext: AudioContext;
  private readonly onStarted: (generation: number) => void;
  private readonly onEnded: (generation: number) => void;
  private queue: Array<{ buffer: AudioBuffer; generation: number }> = [];
  private currentSource: AudioBufferSourceNode | null = null;
  private currentGeneration = 0;
  private started = false;

  constructor(
    audioContextFactory: AudioContextFactory,
    onStarted: (generation: number) => void,
    onEnded: (generation: number) => void,
  ) {
    this.audioContext = audioContextFactory();
    this.onStarted = onStarted;
    this.onEnded = onEnded;

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.audioContext.state === 'suspended') {
        void this.audioContext.resume();
      }
    });
  }

  async enqueue(audioBytes: ArrayBuffer, generation: number): Promise<void> {
    if (generation !== this.currentGeneration) {
      return;
    }

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    const decoded = await this.audioContext.decodeAudioData(audioBytes.slice(0));
    if (generation !== this.currentGeneration) {
      return;
    }

    this.queue.push({ buffer: decoded, generation });
    this.playNext();
  }

  interrupt(): void {
    this.currentGeneration += 1;
    this.queue = [];

    if (this.currentSource) {
      this.currentSource.onended = null;
      try {
        this.currentSource.stop(0);
      } catch {
        // no-op
      }
      this.currentSource.disconnect();
      this.currentSource = null;
    }

    if (this.started) {
      this.started = false;
      this.onEnded(this.currentGeneration);
    }
  }

  nextGeneration(): number {
    this.currentGeneration += 1;
    return this.currentGeneration;
  }

  private playNext(): void {
    if (this.currentSource || this.queue.length === 0) {
      return;
    }

    const item = this.queue.shift();
    if (!item || item.generation !== this.currentGeneration) {
      this.playNext();
      return;
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = item.buffer;
    source.connect(this.audioContext.destination);
    source.onended = () => {
      source.disconnect();
      this.currentSource = null;
      if (this.queue.length === 0 && this.started) {
        this.started = false;
        this.onEnded(item.generation);
      }
      this.playNext();
    };

    this.currentSource = source;
    if (!this.started) {
      this.started = true;
      this.onStarted(item.generation);
    }
    source.start(0);
  }
}

export class RealTimeVoiceAssistantLoop {
  private readonly sessionId: string;
  private readonly userId: string | null;
  private readonly emotionClient: EmotionClient;
  private readonly llmClient: LlmClient;
  private readonly ttsClient: TtsClient;
  private readonly persistenceClient: SessionPersistenceClient;
  private readonly callbacks: LoopUiCallbacks;
  private readonly audioQueue: AudioPlaybackQueue;
  private readonly now: NowProvider;

  private turns: AssistantTurn[] = [];
  private conversationState: ConversationState = {
    turn_count: 0,
    recent_question_asked: false,
    guidance_recently_given: false,
  };
  private memoryStore: UserMemoryStore;
  private storedUserTurnIds = new Set<string>();
  private savedUserTurnIds = new Set<string>();
  private activeSpeechStartedAt: number | null = null;
  private pendingLatencyByGeneration = new Map<number, PendingLatencyTrace>();
  private ttsCache = new Map<string, ArrayBuffer>();

  private requestEpoch = 0;
  private activeAbortController: AbortController | null = null;

  constructor(args: {
    sessionId: string;
    userId?: string;
    emotionClient: EmotionClient;
    llmClient: LlmClient;
    ttsClient: TtsClient;
    persistenceClient?: SessionPersistenceClient;
    callbacks: LoopUiCallbacks;
    audioContextFactory?: AudioContextFactory;
    nowProvider?: NowProvider;
  }) {
    this.sessionId = args.sessionId;
    this.userId = args.userId ?? null;
    this.emotionClient = args.emotionClient;
    this.llmClient = args.llmClient;
    this.ttsClient = args.ttsClient;
    this.persistenceClient = args.persistenceClient ?? apiClient;
    this.callbacks = args.callbacks;
    this.now = args.nowProvider ?? (() => performance.now());
    this.memoryStore = resetUserMemoryStore(
      this.userId ?? this.sessionId,
      this.sessionId,
      new Date().toISOString(),
    );

    this.audioQueue = new AudioPlaybackQueue(
      args.audioContextFactory ?? (() => new AudioContext()),
      (generation) => {
        const trace = this.pendingLatencyByGeneration.get(generation);
        if (trace && trace.playbackStartedAt === null) {
          trace.playbackStartedAt = this.now();
          if (trace.assistantTextReadyAt !== null) {
            this.emitLatency(trace);
          }
        }
        this.callbacks.onAssistantStateChanged('speaking');
        this.callbacks.onAssistantSpeechStarted();
      },
      (generation) => {
        this.pendingLatencyByGeneration.delete(generation);
        this.callbacks.onAssistantStateChanged('idle');
        this.callbacks.onAssistantSpeechEnded();
      },
    );
  }

  getTurns(): AssistantTurn[] {
    return [...this.turns];
  }

  handleUserSpeechStart(): void {
    this.activeSpeechStartedAt = this.now();
    this.interruptAssistantOutput();
  }

  async handleFinalizedUtterance(args: {
    id: string;
    text: string;
    timestamp?: string;
  }): Promise<void> {
    const text = normalizeText(args.text);
    if (!text) {
      return;
    }

    this.interruptAssistantOutput();

    const userTurn: AssistantTurn = {
      id: args.id,
      role: 'user',
      text,
      emotion: null,
      confidence: null,
      timestamp: args.timestamp,
      status: 'resolved',
    };

    this.turns = [...this.turns, userTurn];
    this.conversationState.turn_count += 1;
    this.callbacks.onTurnsChanged(this.turns);
    this.callbacks.onAssistantStateChanged('thinking');

    const epoch = ++this.requestEpoch;
    const abortController = new AbortController();
    this.activeAbortController = abortController;
    const trace: PendingLatencyTrace = {
      utteranceId: userTurn.id,
      speechStartedAt: this.activeSpeechStartedAt,
      finalTranscriptAt: this.now(),
      emotionCompletedAt: null,
      llmRequestStartedAt: null,
      llmFirstTokenAt: null,
      llmCompletedAt: null,
      firstTtsRequestAt: null,
      firstAudioReadyAt: null,
      playbackStartedAt: null,
      assistantTextReadyAt: null,
      ttsCacheHit: false,
    };
    this.activeSpeechStartedAt = null;

    const emotionPromise = this.emotionClient
      .analyzeText(text, abortController.signal)
      .then((emotion) => {
        trace.emotionCompletedAt = this.now();
        if (this.hasTurn(userTurn.id)) {
          this.patchTurn(userTurn.id, {
            emotion: emotion.emotion,
            confidence: emotion.confidence,
          });
        }
        void this.saveSessionForTurn({
          turnId: userTurn.id,
          text: userTurn.text,
          emotion: emotion.emotion,
          confidence: emotion.confidence,
          timestamp: userTurn.timestamp,
        });
        return emotion;
      })
      .catch(() => null);

    void emotionPromise.finally(() => {
      this.captureMemoryForTurn(userTurn.id);
    });

    const earlyEmotion = await withTimeout(emotionPromise, EMOTION_WAIT_BUDGET_MS);
    if (!this.isCurrentEpoch(epoch)) {
      return;
    }

    try {
      const input = this.buildStructuredInput(userTurn.id, earlyEmotion);
      const risk = classifyRiskLevel(input);
      trace.llmRequestStartedAt = this.now();
      const llmStream = await Promise.race([
        this.llmClient.streamResponse(
          buildTherapistMessages(input),
          abortController.signal,
        ),
        waitForAbort(abortController.signal),
      ]);

      if (!this.isCurrentEpoch(epoch)) {
        return;
      }

      const allowProgressiveSpeech = risk !== 'high';
      const chunker = new SentenceChunker();
      const audioGeneration = this.audioQueue.nextGeneration();
      this.pendingLatencyByGeneration.set(audioGeneration, trace);
      let streamedText = '';
      let ttsChain = Promise.resolve();
      let synthesizedAnyAudio = false;

      await this.consumeLlmStream(llmStream, abortController.signal, async (token) => {
        if (!this.isCurrentEpoch(epoch)) {
          return;
        }

        if (trace.llmFirstTokenAt === null) {
          trace.llmFirstTokenAt = this.now();
        }
        streamedText += token;
        this.callbacks.onAssistantTextStreaming(normalizeText(streamedText));

        if (!allowProgressiveSpeech) {
          return;
        }

        const readyChunks = chunker.push(token);
        for (const chunk of readyChunks) {
          ttsChain = ttsChain.then(async () => {
            if (!this.isCurrentEpoch(epoch)) {
              return;
            }

            const audioBytes = await this.synthesizeWithRetry(chunk, abortController.signal, trace);
            if (!audioBytes || !this.isCurrentEpoch(epoch)) {
              return;
            }

            synthesizedAnyAudio = true;
            await this.audioQueue.enqueue(audioBytes, audioGeneration);
          });
        }
      });

      if (!this.isCurrentEpoch(epoch)) {
        return;
      }
      trace.llmCompletedAt = this.now();

      const tailChunks = chunker.finish();
      for (const chunk of tailChunks) {
        ttsChain = ttsChain.then(async () => {
          if (!this.isCurrentEpoch(epoch)) {
            return;
          }

          const audioBytes = await this.synthesizeWithRetry(chunk, abortController.signal, trace);
          if (!audioBytes || !this.isCurrentEpoch(epoch)) {
            return;
          }

          synthesizedAnyAudio = true;
          await this.audioQueue.enqueue(audioBytes, audioGeneration);
        });
      }

      await ttsChain;
      if (!this.isCurrentEpoch(epoch)) {
        return;
      }

      const finalText = postProcessTherapistResponse(streamedText, input);
      trace.assistantTextReadyAt = this.now();
      if (trace.playbackStartedAt !== null) {
        this.emitLatency(trace);
      }
      this.callbacks.onAssistantTextReady(finalText);

      const assistantTurn: AssistantTurn = {
        id: `assistant-${userTurn.id}`,
        role: 'assistant',
        text: finalText,
        emotion: null,
        confidence: null,
        timestamp: new Date().toISOString(),
        status: 'resolved',
        response_to: userTurn.id,
      };

      this.turns = [...this.turns, assistantTurn];
      this.callbacks.onTurnsChanged(this.turns);

      if (!synthesizedAnyAudio) {
        const fullAudio = await this.synthesizeWithRetry(finalText, abortController.signal, trace);
        if (!this.isCurrentEpoch(epoch)) {
          return;
        }

        if (fullAudio) {
          synthesizedAnyAudio = true;
          await this.audioQueue.enqueue(fullAudio, audioGeneration);
        } else {
          this.callbacks.onError('Voice playback unavailable. Showing text response only.');
          this.callbacks.onAssistantStateChanged('idle');
        }
      }

      this.conversationState.recent_question_asked = endsWithQuestion(finalText);
      this.conversationState.guidance_recently_given = containsGuidance(finalText);

      if (!synthesizedAnyAudio) {
        this.callbacks.onAssistantStateChanged('idle');
      }
    } catch (error) {
      if (isAbortError(error) || !this.isCurrentEpoch(epoch)) {
        return;
      }

      this.callbacks.onError('Assistant response failed. Please try again.');
      this.callbacks.onAssistantStateChanged('idle');
    }
  }

  private async synthesizeWithRetry(
    text: string,
    signal: AbortSignal,
    trace: PendingLatencyTrace,
  ): Promise<ArrayBuffer | null> {
    const normalizedText = normalizeText(text);
    const cached = this.ttsCache.get(normalizedText);
    if (cached) {
      trace.ttsCacheHit = true;
      if (trace.firstTtsRequestAt === null) {
        trace.firstTtsRequestAt = this.now();
      }
      if (trace.firstAudioReadyAt === null) {
        trace.firstAudioReadyAt = this.now();
      }
      return cached.slice(0);
    }

    if (trace.firstTtsRequestAt === null) {
      trace.firstTtsRequestAt = this.now();
    }

    try {
      const result = await this.ttsClient.synthesize(text, signal);
      this.rememberTts(normalizedText, result);
      if (trace.firstAudioReadyAt === null) {
        trace.firstAudioReadyAt = this.now();
      }
      return result.slice(0);
    } catch {
      if (signal.aborted) {
        return null;
      }

      await sleep(120);
      try {
        const retryResult = await this.ttsClient.synthesize(text, signal);
        this.rememberTts(normalizedText, retryResult);
        if (trace.firstAudioReadyAt === null) {
          trace.firstAudioReadyAt = this.now();
        }
        return retryResult.slice(0);
      } catch {
        return null;
      }
    }
  }

  private buildStructuredInput(
    currentTurnId: string,
    immediateEmotion: EmotionResult | null,
  ): MemoryAwareConversationInput {
    const records: ConversationUtteranceRecord[] = this.turns
      .filter((turn) => turn.role === 'user')
      .map((turn) => {
        if (turn.id !== currentTurnId) {
          return turn;
        }

        return {
          ...turn,
          emotion: immediateEmotion?.emotion ?? turn.emotion,
          confidence: immediateEmotion?.confidence ?? turn.confidence,
        };
      });

    const context = buildConversationContext(this.sessionId, records, this.conversationState);
    if (!context) {
      return {
        current_input: {
          text: records[records.length - 1]?.text ?? '',
          emotion: immediateEmotion?.emotion ?? null,
          confidence: immediateEmotion?.confidence ?? null,
        },
        context_window: [],
        emotion_summary: {
          latest: immediateEmotion?.emotion ?? null,
          dominant_recent: immediateEmotion?.emotion ?? null,
          trend: 'stable',
        },
        intent_signals: {
          needs_support: false,
          uncertainty: false,
          distress: false,
          reflection: false,
          repetitive_thoughts: false,
        },
        conversation_state: this.conversationState,
      };
    }

    const baseInput: StructuredConversationInput = {
      current_input: context.current_input,
      context_window: context.context_window,
      emotion_summary: context.emotion_summary,
      intent_signals: context.intent_signals,
      conversation_state: context.conversation_state,
    };

    const retrieved = retrieveRelevantMemory(this.memoryStore, {
      topic: inferMemoryTopic(context.current_input.text),
      emotion: context.current_input.emotion,
    });

    return injectPersonalizationIntoLlmInput(baseInput, retrieved);
  }

  private captureMemoryForTurn(turnId: string): void {
    if (this.storedUserTurnIds.has(turnId)) {
      return;
    }

    const records = this.turns
      .filter((turn): turn is AssistantTurn & { role: 'user' } => turn.role === 'user')
      .map<ConversationUtteranceRecord>((turn) => ({
        id: turn.id,
        text: turn.text,
        emotion: turn.emotion,
        confidence: turn.confidence,
        timestamp: turn.timestamp,
        status: turn.status,
      }));

    const context = buildConversationContext(this.sessionId, records, this.conversationState);
    const currentTurn = records.find((record) => record.id === turnId);
    if (!context || !currentTurn) {
      return;
    }

    this.memoryStore = updateUserMemoryStore(this.memoryStore, {
      user_id: this.userId,
      session_id: this.sessionId,
      utterance: {
        id: currentTurn.id,
        text: currentTurn.text,
        emotion: currentTurn.emotion,
        confidence: currentTurn.confidence,
        topic: inferMemoryTopic(currentTurn.text),
        timestamp: currentTurn.timestamp ?? new Date().toISOString(),
      },
      intent_signals: context.intent_signals,
      emotion_summary: {
        latest_emotion: context.emotion_summary.latest,
        dominant_recent_emotion: context.emotion_summary.dominant_recent,
        trend: context.emotion_summary.trend,
      },
    });
    this.storedUserTurnIds.add(turnId);
  }

  private async saveSessionForTurn(args: {
    turnId: string;
    text: string;
    emotion: string | null;
    confidence: number | null;
    timestamp?: string;
  }): Promise<void> {
    if (!this.userId || !args.emotion || this.savedUserTurnIds.has(args.turnId)) {
      return;
    }

    const payload = {
      user_id: this.userId,
      text: args.text,
      emotion: args.emotion,
      confidence: args.confidence,
      timestamp: args.timestamp,
    };

    this.savedUserTurnIds.add(args.turnId);
    console.info('Saving session...');
    console.info('Session payload:', payload);

    try {
      const response = await this.persistenceClient.saveSession(payload);
      console.info('Save session response status:', 201);
      console.info('Save session response:', response);
    } catch (error) {
      this.savedUserTurnIds.delete(args.turnId);
      console.error('Save session failed:', error);
    }
  }

  private async consumeLlmStream(
    llmStream: AsyncIterable<string>,
    signal: AbortSignal,
    onToken: (token: string) => Promise<void> | void,
  ): Promise<void> {
    const iterator = llmStream[Symbol.asyncIterator]();
    let sawToken = false;

    try {
      while (true) {
        let result: IteratorResult<string>;
        try {
          result = await Promise.race([
            iterator.next(),
            waitForAbort(signal),
            waitForIdleTimeout(LLM_STREAM_IDLE_TIMEOUT_MS),
          ]);
        } catch (error) {
          if (isIdleTimeoutError(error) && sawToken) {
            return;
          }

          throw error;
        }

        if (result.done) {
          return;
        }

        sawToken = true;
        await onToken(result.value);
      }
    } finally {
      if (typeof iterator.return === 'function') {
        try {
          await iterator.return();
        } catch {
          // no-op
        }
      }
    }
  }

  private patchTurn(turnId: string, patch: Partial<AssistantTurn>): void {
    this.turns = this.turns.map((turn) => (turn.id === turnId ? { ...turn, ...patch } : turn));
    this.callbacks.onTurnsChanged(this.turns);
  }

  private hasTurn(turnId: string): boolean {
    return this.turns.some((turn) => turn.id === turnId);
  }

  private isCurrentEpoch(epoch: number): boolean {
    return this.requestEpoch === epoch;
  }

  private interruptAssistantOutput(): void {
    this.requestEpoch += 1;

    if (this.activeAbortController) {
      this.activeAbortController.abort();
      this.activeAbortController = null;
    }

    this.pendingLatencyByGeneration.clear();
    this.audioQueue.interrupt();
    this.callbacks.onAssistantStateChanged('idle');
  }

  private rememberTts(text: string, audio: ArrayBuffer): void {
    if (!text) {
      return;
    }

    if (this.ttsCache.size >= MAX_TTS_CACHE_ITEMS) {
      const firstKey = this.ttsCache.keys().next().value;
      if (firstKey) {
        this.ttsCache.delete(firstKey);
      }
    }

    this.ttsCache.set(text, audio.slice(0));
  }

  private emitLatency(trace: PendingLatencyTrace): void {
    const metricsBase = {
      speech_to_final_transcript_ms: duration(trace.speechStartedAt, trace.finalTranscriptAt),
      transcript_to_emotion_ms: duration(trace.finalTranscriptAt, trace.emotionCompletedAt),
      transcript_to_llm_first_token_ms: duration(trace.finalTranscriptAt, trace.llmFirstTokenAt),
      transcript_to_llm_complete_ms: duration(trace.finalTranscriptAt, trace.llmCompletedAt),
      llm_to_tts_first_request_ms: duration(trace.llmFirstTokenAt, trace.firstTtsRequestAt),
      tts_first_audio_ready_ms: duration(trace.firstTtsRequestAt, trace.firstAudioReadyAt),
      tts_to_playback_start_ms: duration(trace.firstAudioReadyAt, trace.playbackStartedAt),
      final_transcript_to_playback_start_ms: duration(trace.finalTranscriptAt, trace.playbackStartedAt),
      final_transcript_to_assistant_text_ms: duration(trace.finalTranscriptAt, trace.assistantTextReadyAt),
      total_end_to_end_ms: duration(trace.speechStartedAt, trace.playbackStartedAt),
    };

    const breakdown: VoiceLatencyBreakdown = {
      utterance_id: trace.utteranceId,
      ...metricsBase,
      tts_cache_hit: trace.ttsCacheHit,
      bottleneck_stage: determineBottleneckStage(metricsBase),
    };

    this.callbacks.onLatencyMeasured?.(breakdown);

    if (import.meta.env.DEV) {
      console.debug('[voice-latency]', breakdown);
    }
  }
}

export const createVoiceAudioLoop = (args: {
  emotionClient: EmotionClient;
  llmClient: LlmClient;
  ttsClient: TtsClient;
  callbacks: LoopUiCallbacks;
  sessionId: string;
  audioContextFactory?: AudioContextFactory;
  nowProvider?: NowProvider;
}) => {
  return new RealTimeVoiceAssistantLoop(args);
};

export const bindVoiceLoopInterruptionHandlers = (loop: RealTimeVoiceAssistantLoop) => {
  return {
    onSpeechStart: () => {
      loop.handleUserSpeechStart();
    },
    onFinalUtterance: async (utterance: {
      id: string;
      text: string;
      timestamp?: string;
    }) => {
      await loop.handleFinalizedUtterance(utterance);
    },
  };
};
