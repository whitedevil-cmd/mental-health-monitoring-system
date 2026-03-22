import { describe, expect, it, vi } from 'vitest';
import {
  RealTimeVoiceAssistantLoop,
  type EmotionClient,
  type LlmClient,
  type LoopUiCallbacks,
  type SessionPersistenceClient,
  type TtsClient,
  type VoiceLatencyBreakdown,
} from '@/lib/voiceConversationLoop';

class FakeBufferSource {
  buffer: AudioBuffer | null = null;
  onended: (() => void) | null = null;

  connect() {}

  disconnect() {}

  start() {
    queueMicrotask(() => {
      this.onended?.();
    });
  }

  stop() {
    this.onended?.();
  }
}

class FakeAudioContext {
  state: AudioContextState = 'running';
  destination = {};

  resume = vi.fn().mockResolvedValue(undefined);

  decodeAudioData = vi.fn(async (audio: ArrayBuffer) => {
    return { byteLength: audio.byteLength } as unknown as AudioBuffer;
  });

  createBufferSource() {
    return new FakeBufferSource() as unknown as AudioBufferSourceNode;
  }
}

const createCallbacks = (): LoopUiCallbacks & {
  turns: Array<unknown>;
  states: string[];
  streamed: string[];
  ready: string[];
  errors: string[];
  latencies: VoiceLatencyBreakdown[];
} => {
  const turns: Array<unknown> = [];
  const states: string[] = [];
  const streamed: string[] = [];
  const ready: string[] = [];
  const errors: string[] = [];
  const latencies: VoiceLatencyBreakdown[] = [];

  return {
    turns,
    states,
    streamed,
    ready,
    errors,
    latencies,
    onTurnsChanged: (nextTurns) => {
      turns.push(nextTurns);
    },
    onAssistantStateChanged: (state) => {
      states.push(state);
    },
    onAssistantTextStreaming: (text) => {
      streamed.push(text);
    },
    onAssistantTextReady: (text) => {
      ready.push(text);
    },
    onAssistantSpeechStarted: vi.fn(),
    onAssistantSpeechEnded: vi.fn(),
    onError: (message) => {
      errors.push(message);
    },
    onLatencyMeasured: (breakdown) => {
      latencies.push(breakdown);
    },
  };
};

const createTokenStream = async function* (tokens: string[], pauseMs = 0): AsyncIterable<string> {
  for (const token of tokens) {
    if (pauseMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, pauseMs));
    }
    yield token;
  }
};

const createPersistenceClient = (): SessionPersistenceClient & {
  saveSession: ReturnType<typeof vi.fn>;
} => ({
  saveSession: vi.fn().mockResolvedValue({
    id: 1,
    created_at: '2026-03-22T12:00:00Z',
  }),
});

describe('voiceConversationLoop', () => {
  it('runs the full user -> emotion -> llm -> tts loop and appends assistant output', async () => {
    const callbacks = createCallbacks();
    const emotionClient: EmotionClient = {
      analyzeText: vi.fn().mockResolvedValue({ emotion: 'sad', confidence: 0.84 }),
    };
    const llmClient: LlmClient = {
      streamResponse: vi.fn().mockResolvedValue(
        createTokenStream(['That sounds heavy. ', 'What feels most difficult right now?']),
      ),
    };
    const ttsClient: TtsClient = {
      synthesize: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    };

    const loop = new RealTimeVoiceAssistantLoop({
      sessionId: 'session-1',
      emotionClient,
      llmClient,
      ttsClient,
      callbacks,
      audioContextFactory: () => new FakeAudioContext() as unknown as AudioContext,
    });

    await loop.handleFinalizedUtterance({
      id: 'user-1',
      text: 'I feel really low today.',
      timestamp: '2026-03-22T12:00:00Z',
    });

    const turns = loop.getTurns();
    expect(turns).toHaveLength(2);
    expect(turns[0]).toMatchObject({
      role: 'user',
      text: 'I feel really low today.',
      emotion: 'sad',
    });
    expect(turns[1]).toMatchObject({
      role: 'assistant',
      response_to: 'user-1',
    });
    expect(callbacks.ready.at(-1)).toContain('What feels most difficult right now?');
    expect(ttsClient.synthesize).toHaveBeenCalled();
  });

  it('interrupts active generation and audio when the user starts speaking again', async () => {
    let releaseStream: (() => void) | null = null;
    const callbacks = createCallbacks();
    const emotionClient: EmotionClient = {
      analyzeText: vi.fn().mockResolvedValue({ emotion: 'anxious', confidence: 0.79 }),
    };
    const llmClient: LlmClient = {
      streamResponse: vi.fn().mockImplementation(async (_messages, signal?: AbortSignal) => {
        return (async function* () {
          yield 'Let us slow down ';
          await new Promise<void>((resolve, reject) => {
            releaseStream = resolve;
            signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
          });
          yield 'together.';
        })();
      }),
    };
    const ttsClient: TtsClient = {
      synthesize: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    };

    const loop = new RealTimeVoiceAssistantLoop({
      sessionId: 'session-2',
      emotionClient,
      llmClient,
      ttsClient,
      callbacks,
      audioContextFactory: () => new FakeAudioContext() as unknown as AudioContext,
    });

    const pending = loop.handleFinalizedUtterance({
      id: 'user-1',
      text: 'I am spiraling a bit.',
    });

    await Promise.resolve();
    await Promise.resolve();
    loop.handleUserSpeechStart();
    releaseStream?.();
    await pending.catch(() => undefined);

    const turns = loop.getTurns();
    expect(turns).toHaveLength(1);
    expect(turns[0]).toMatchObject({ role: 'user' });
    expect(callbacks.ready).toHaveLength(0);
    expect(callbacks.states.at(-1)).toBe('idle');
  });

  it('falls back to text when tts synthesis fails', async () => {
    const callbacks = createCallbacks();
    const emotionClient: EmotionClient = {
      analyzeText: vi.fn().mockResolvedValue({ emotion: 'neutral', confidence: 0.51 }),
    };
    const llmClient: LlmClient = {
      streamResponse: vi.fn().mockResolvedValue(createTokenStream(['I hear you.'])),
    };
    const ttsClient: TtsClient = {
      synthesize: vi.fn().mockRejectedValue(new Error('tts down')),
    };

    const loop = new RealTimeVoiceAssistantLoop({
      sessionId: 'session-3',
      emotionClient,
      llmClient,
      ttsClient,
      callbacks,
      audioContextFactory: () => new FakeAudioContext() as unknown as AudioContext,
    });

    await loop.handleFinalizedUtterance({
      id: 'user-1',
      text: 'Hello there.',
    });

    expect(loop.getTurns()).toHaveLength(2);
    expect(callbacks.ready.at(-1)).toBe('I hear you.');
    expect(callbacks.errors.at(-1)).toContain('Voice playback unavailable');
    expect(callbacks.states.at(-1)).toBe('idle');
  });

  it('skips empty tts chunks without issuing a tts request', async () => {
    const callbacks = createCallbacks();
    const emotionClient: EmotionClient = {
      analyzeText: vi.fn().mockResolvedValue({ emotion: 'neutral', confidence: 0.51 }),
    };
    const llmClient: LlmClient = {
      streamResponse: vi.fn().mockResolvedValue(createTokenStream(['   '])),
    };
    const ttsClient: TtsClient = {
      synthesize: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    };

    const loop = new RealTimeVoiceAssistantLoop({
      sessionId: 'session-empty-tts',
      emotionClient,
      llmClient,
      ttsClient,
      callbacks,
      audioContextFactory: () => new FakeAudioContext() as unknown as AudioContext,
    });

    await loop.handleFinalizedUtterance({
      id: 'user-empty-tts',
      text: 'Hello there.',
    });

    expect(ttsClient.synthesize).not.toHaveBeenCalled();
    expect(callbacks.errors.at(-1)).toContain('Voice playback unavailable');
  });

  it('ignores stale assistant output when a newer utterance starts before the older response finishes', async () => {
    const callbacks = createCallbacks();
    const emotionClient: EmotionClient = {
      analyzeText: vi
        .fn()
        .mockResolvedValue({ emotion: 'sad', confidence: 0.71 }),
    };
    const llmClient: LlmClient = {
      streamResponse: vi
        .fn()
        .mockImplementationOnce(async () => {
          return createTokenStream(['First response ', 'should disappear.'], 80);
        })
        .mockImplementationOnce(async () => {
          return createTokenStream(['Second response.']);
        }),
    };
    const ttsClient: TtsClient = {
      synthesize: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    };

    const loop = new RealTimeVoiceAssistantLoop({
      sessionId: 'session-4',
      emotionClient,
      llmClient,
      ttsClient,
      callbacks,
      audioContextFactory: () => new FakeAudioContext() as unknown as AudioContext,
    });

    const first = loop.handleFinalizedUtterance({
      id: 'user-1',
      text: 'First thought.',
    });

    await new Promise((resolve) => setTimeout(resolve, 10));

    const second = loop.handleFinalizedUtterance({
      id: 'user-2',
      text: 'Second thought.',
    });

    await first.catch(() => undefined);
    await second;

    const turns = loop.getTurns();
    expect(turns.map((turn) => turn.text)).toEqual([
      'First thought.',
      'Second thought.',
      'Second response.',
    ]);
  });

  it('injects compact memory context into later LLM turns after prior user patterns are stored', async () => {
    const callbacks = createCallbacks();
    const emotionClient: EmotionClient = {
      analyzeText: vi
        .fn()
        .mockResolvedValue({ emotion: 'anxious', confidence: 0.82 }),
    };
    const llmStream = vi
      .fn()
      .mockResolvedValue(createTokenStream(['That sounds difficult.']));
    const llmClient: LlmClient = {
      streamResponse: llmStream,
    };
    const ttsClient: TtsClient = {
      synthesize: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    };
    const persistenceClient = createPersistenceClient();

    const loop = new RealTimeVoiceAssistantLoop({
      sessionId: 'session-5',
      userId: 'user-1',
      emotionClient,
      llmClient,
      ttsClient,
      persistenceClient,
      callbacks,
      audioContextFactory: () => new FakeAudioContext() as unknown as AudioContext,
    });

    await loop.handleFinalizedUtterance({
      id: 'user-1',
      text: 'Work has been making me really anxious this week.',
      timestamp: '2026-03-22T12:00:00Z',
    });

    await loop.handleFinalizedUtterance({
      id: 'user-2',
      text: 'I am still stressed about work today.',
      timestamp: '2026-03-22T12:05:00Z',
    });

    const secondCall = llmStream.mock.calls[1]?.[0];
    expect(secondCall).toHaveLength(2);
    expect(secondCall?.[1]?.content).toContain('"memory_context"');
    expect(secondCall?.[1]?.content).toContain('"recurring_topics":["work"]');
    expect(secondCall?.[1]?.content).toContain('"support_style":"gentle_guidance"');
    expect(persistenceClient.saveSession).toHaveBeenCalledTimes(2);
  });

  it('saves a completed user turn exactly once after final transcript emotion analysis completes', async () => {
    const callbacks = createCallbacks();
    const emotionClient: EmotionClient = {
      analyzeText: vi.fn().mockResolvedValue({ emotion: 'sad', confidence: 0.84 }),
    };
    const llmClient: LlmClient = {
      streamResponse: vi.fn().mockResolvedValue(createTokenStream(['I hear you.'])),
    };
    const ttsClient: TtsClient = {
      synthesize: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    };
    const persistenceClient = createPersistenceClient();

    const loop = new RealTimeVoiceAssistantLoop({
      sessionId: 'session-save-1',
      userId: 'user-42',
      emotionClient,
      llmClient,
      ttsClient,
      persistenceClient,
      callbacks,
      audioContextFactory: () => new FakeAudioContext() as unknown as AudioContext,
    });

    await loop.handleFinalizedUtterance({
      id: 'user-save-1',
      text: 'I feel low today.',
      timestamp: '2026-03-22T12:00:00Z',
    });

    expect(persistenceClient.saveSession).toHaveBeenCalledTimes(1);
    expect(persistenceClient.saveSession).toHaveBeenCalledWith({
      user_id: 'user-42',
      text: 'I feel low today.',
      emotion: 'sad',
      confidence: 0.84,
      timestamp: '2026-03-22T12:00:00Z',
    });
  });

  it('does not save duplicate rows for the same finalized turn when a stale emotion result resolves twice', async () => {
    const callbacks = createCallbacks();
    const emotionResult = { emotion: 'anxious', confidence: 0.76 };
    const emotionClient: EmotionClient = {
      analyzeText: vi.fn().mockResolvedValue(emotionResult),
    };
    const llmClient: LlmClient = {
      streamResponse: vi.fn().mockResolvedValue(createTokenStream(['Let us take this one step at a time.'])),
    };
    const ttsClient: TtsClient = {
      synthesize: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    };
    const persistenceClient = createPersistenceClient();

    const loop = new RealTimeVoiceAssistantLoop({
      sessionId: 'session-save-2',
      userId: 'user-84',
      emotionClient,
      llmClient,
      ttsClient,
      persistenceClient,
      callbacks,
      audioContextFactory: () => new FakeAudioContext() as unknown as AudioContext,
    });

    await loop.handleFinalizedUtterance({
      id: 'user-save-2',
      text: 'I feel overwhelmed.',
      timestamp: '2026-03-22T12:00:00Z',
    });

    await loop.handleFinalizedUtterance({
      id: 'user-save-2',
      text: 'I feel overwhelmed.',
      timestamp: '2026-03-22T12:00:00Z',
    });

    expect(persistenceClient.saveSession).toHaveBeenCalledTimes(1);
  });

  it('skips persistence when no authenticated user id is available', async () => {
    const callbacks = createCallbacks();
    const emotionClient: EmotionClient = {
      analyzeText: vi.fn().mockResolvedValue({ emotion: 'sad', confidence: 0.8 }),
    };
    const llmClient: LlmClient = {
      streamResponse: vi.fn().mockResolvedValue(createTokenStream(['I am here with you.'])),
    };
    const ttsClient: TtsClient = {
      synthesize: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    };
    const persistenceClient = createPersistenceClient();

    const loop = new RealTimeVoiceAssistantLoop({
      sessionId: 'session-save-3',
      emotionClient,
      llmClient,
      ttsClient,
      persistenceClient,
      callbacks,
      audioContextFactory: () => new FakeAudioContext() as unknown as AudioContext,
    });

    await loop.handleFinalizedUtterance({
      id: 'user-save-3',
      text: 'I feel off today.',
      timestamp: '2026-03-22T12:00:00Z',
    });

    expect(persistenceClient.saveSession).not.toHaveBeenCalled();
  });

  it('measures end-to-end latency stages across speech, emotion, llm, tts, and playback', async () => {
    const callbacks = createCallbacks();
    const emotionClient: EmotionClient = {
      analyzeText: vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 60));
        return { emotion: 'anxious', confidence: 0.8 };
      }),
    };
    const llmClient: LlmClient = {
      streamResponse: vi.fn().mockResolvedValue(
        createTokenStream(['That sounds tough. ', 'What feels most pressing?'], 45),
      ),
    };
    const ttsClient: TtsClient = {
      synthesize: vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return new ArrayBuffer(8);
      }),
    };

    const loop = new RealTimeVoiceAssistantLoop({
      sessionId: 'session-latency-1',
      emotionClient,
      llmClient,
      ttsClient,
      callbacks,
      audioContextFactory: () => new FakeAudioContext() as unknown as AudioContext,
    });

    loop.handleUserSpeechStart();
    await new Promise((resolve) => setTimeout(resolve, 70));
    await loop.handleFinalizedUtterance({
      id: 'user-latency-1',
      text: 'I feel overwhelmed today.',
    });

    expect(callbacks.latencies).toHaveLength(1);
    expect(callbacks.latencies[0]?.speech_to_final_transcript_ms).toBeGreaterThanOrEqual(60);
    expect(callbacks.latencies[0]?.transcript_to_emotion_ms).toBeGreaterThanOrEqual(50);
    expect(callbacks.latencies[0]?.transcript_to_llm_first_token_ms).toBeGreaterThanOrEqual(40);
    expect(callbacks.latencies[0]?.tts_first_audio_ready_ms).toBeGreaterThanOrEqual(45);
    expect(callbacks.latencies[0]?.bottleneck_stage).toBeTruthy();
  });

  it('starts playback before the full assistant text is ready for longer responses', async () => {
    const callbacks = createCallbacks();
    const emotionClient: EmotionClient = {
      analyzeText: vi.fn().mockResolvedValue({ emotion: 'sad', confidence: 0.77 }),
    };
    const llmClient: LlmClient = {
      streamResponse: vi.fn().mockResolvedValue(
        createTokenStream(
          [
            'That sounds like a lot to carry, ',
            'and you do not have to hold it all alone. ',
            'What feels hardest right now?',
          ],
          55,
        ),
      ),
    };
    const ttsClient: TtsClient = {
      synthesize: vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 35));
        return new ArrayBuffer(8);
      }),
    };

    const loop = new RealTimeVoiceAssistantLoop({
      sessionId: 'session-latency-2',
      emotionClient,
      llmClient,
      ttsClient,
      callbacks,
      audioContextFactory: () => new FakeAudioContext() as unknown as AudioContext,
    });

    loop.handleUserSpeechStart();
    await new Promise((resolve) => setTimeout(resolve, 30));
    await loop.handleFinalizedUtterance({
      id: 'user-latency-2',
      text: 'I am having a rough day.',
    });

    expect(callbacks.latencies[0]?.final_transcript_to_playback_start_ms).not.toBeNull();
    expect(callbacks.latencies[0]?.final_transcript_to_assistant_text_ms).not.toBeNull();
    expect(
      (callbacks.latencies[0]?.final_transcript_to_playback_start_ms ?? Number.POSITIVE_INFINITY),
    ).toBeLessThan(
      callbacks.latencies[0]?.final_transcript_to_assistant_text_ms ?? 0,
    );
  });

  it('reuses cached tts audio for repeated assistant phrasing to reduce playback delay', async () => {
    const callbacks = createCallbacks();
    const emotionClient: EmotionClient = {
      analyzeText: vi.fn().mockResolvedValue({ emotion: 'neutral', confidence: 0.6 }),
    };
    const llmClient: LlmClient = {
      streamResponse: vi
        .fn()
        .mockImplementation(async () => createTokenStream(['I hear you.'])),
    };
    const ttsClient: TtsClient = {
      synthesize: vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 40));
        return new ArrayBuffer(8);
      }),
    };

    const loop = new RealTimeVoiceAssistantLoop({
      sessionId: 'session-latency-3',
      emotionClient,
      llmClient,
      ttsClient,
      callbacks,
      audioContextFactory: () => new FakeAudioContext() as unknown as AudioContext,
    });

    loop.handleUserSpeechStart();
    await new Promise((resolve) => setTimeout(resolve, 20));
    await loop.handleFinalizedUtterance({
      id: 'user-cache-1',
      text: 'Hello.',
    });

    loop.handleUserSpeechStart();
    await new Promise((resolve) => setTimeout(resolve, 20));
    await loop.handleFinalizedUtterance({
      id: 'user-cache-2',
      text: 'Hello again.',
    });

    expect(ttsClient.synthesize).toHaveBeenCalledTimes(1);
    expect(callbacks.latencies[1]?.tts_cache_hit).toBe(true);
    expect(callbacks.latencies[1]?.tts_first_audio_ready_ms).toBe(0);
  });

  it('stays consistent when delayed llm, interruption, and tts failure happen together', async () => {
    const callbacks = createCallbacks();
    const emotionClient: EmotionClient = {
      analyzeText: vi.fn().mockResolvedValue({ emotion: 'anxious', confidence: 0.78 }),
    };
    let notifyFirstStreamStarted: (() => void) | null = null;
    const firstStreamStarted = new Promise<void>((resolve) => {
      notifyFirstStreamStarted = resolve;
    });
    const llmClient: LlmClient = {
      streamResponse: vi
        .fn()
        .mockImplementationOnce(async (_messages, signal?: AbortSignal) => {
          notifyFirstStreamStarted?.();
          return {
            [Symbol.asyncIterator]() {
              let index = 0;

              return {
                next: async () => {
                  if (index === 0) {
                    index += 1;
                    return { done: false, value: 'First reply ' };
                  }

                  return new Promise<{ done: boolean; value?: string }>((resolve) => {
                    const finish = () => {
                      signal?.removeEventListener('abort', finish);
                      resolve({ done: true });
                    };

                    signal?.addEventListener('abort', finish, { once: true });
                  });
                },
                return: async () => {
                  return { done: true, value: undefined };
                },
              };
            },
          };
        })
        .mockImplementationOnce(async () => {
          return createTokenStream(['Second reply survives.']);
        }),
    };
    const ttsClient: TtsClient = {
      synthesize: vi.fn().mockRejectedValue(new Error('tts offline')),
    };

    const loop = new RealTimeVoiceAssistantLoop({
      sessionId: 'session-chaos-1',
      emotionClient,
      llmClient,
      ttsClient,
      callbacks,
      audioContextFactory: () => new FakeAudioContext() as unknown as AudioContext,
    });

    const first = loop.handleFinalizedUtterance({
      id: 'user-chaos-1',
      text: 'First unstable thought.',
    });

    await firstStreamStarted;
    loop.handleUserSpeechStart();

    await first.catch(() => undefined);

    await loop.handleFinalizedUtterance({
      id: 'user-chaos-2',
      text: 'Second stable thought.',
    });

    expect(loop.getTurns().map((turn) => turn.text)).toEqual([
      'First unstable thought.',
      'Second stable thought.',
      'Second reply survives.',
    ]);
    expect(callbacks.ready).toEqual(['Second reply survives.']);
    expect(callbacks.errors.at(-1)).toContain('Voice playback unavailable');
    expect(callbacks.states.at(-1)).toBe('idle');
  });
});
