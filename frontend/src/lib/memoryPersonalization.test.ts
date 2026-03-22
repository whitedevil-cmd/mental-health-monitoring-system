import { describe, expect, it } from 'vitest';
import {
  buildMemoryCandidate,
  inferMemoryTopic,
  injectPersonalizationIntoLlmInput,
  resetUserMemoryStore,
  retrieveRelevantMemory,
  updateLongTermMemory,
  updateMidTermMemory,
  updateSessionMemory,
  updateUserMemoryStore,
} from '@/lib/memoryPersonalization';

const baseInput = {
  user_id: 'user-1',
  session_id: 'session-1',
  utterance: {
    id: 'utt-1',
    text: 'I feel really anxious about work lately and I do not know how to handle it.',
    emotion: 'anxious',
    confidence: 0.83,
    topic: 'work',
    timestamp: '2026-03-22T16:00:00Z',
  },
  intent_signals: {
    needs_support: true,
    uncertainty: true,
    distress: true,
    reflection: true,
    repetitive_thoughts: false,
  },
  emotion_summary: {
    latest_emotion: 'anxious' as const,
    dominant_recent_emotion: 'anxious' as const,
    trend: 'rising' as const,
  },
};

describe('memoryPersonalization', () => {
  it('builds safe abstraction candidates instead of storing raw sensitive content', () => {
    const candidate = buildMemoryCandidate(baseInput);

    expect(candidate.should_store).toBe(true);
    expect(candidate.topic_key).toBe('work');
    expect(candidate.topic_summary).toContain('work');
    expect(candidate.topic_summary).not.toContain('I feel really anxious');
    expect(candidate.trait_summary).toContain('work');
  });

  it('infers a stable abstract topic when no explicit topic is provided', () => {
    expect(inferMemoryTopic('Work has been making me feel on edge lately.')).toBe('work');
    expect(inferMemoryTopic('I barely slept last night.')).toBe('sleep');
  });

  it('guards highly sensitive content from entering durable memory', () => {
    const sensitive = buildMemoryCandidate({
      ...baseInput,
      utterance: {
        ...baseInput.utterance,
        text: 'My address is 21 Oak Lane and my diagnosis changed last week.',
        topic: 'health',
      },
    });

    expect(sensitive.should_store).toBe(false);
    expect(sensitive.risk).toBe('guarded');
  });

  it('updates short-term memory with a capped recent window', () => {
    let session = resetUserMemoryStore('user-1', 'session-1', '2026-03-22T15:00:00Z').short_term;

    for (let index = 0; index < 10; index += 1) {
      session = updateSessionMemory(session, {
        ...baseInput,
        utterance: {
          ...baseInput.utterance,
          id: `utt-${index}`,
          text: `I feel anxious about work item ${index}.`,
          timestamp: `2026-03-22T16:00:${String(index).padStart(2, '0')}Z`,
        },
      });
    }

    expect(session.recent_utterances).toHaveLength(8);
    expect(session.recent_utterances[0]?.id).toBe('utt-2');
  });

  it('merges repeated mid-term and long-term patterns instead of duplicating them', () => {
    const midOnce = updateMidTermMemory([], baseInput);
    const midTwice = updateMidTermMemory(midOnce, {
      ...baseInput,
      utterance: {
        ...baseInput.utterance,
        id: 'utt-2',
        timestamp: '2026-03-23T10:00:00Z',
      },
    });

    const longOnce = updateLongTermMemory([], baseInput);
    const longTwice = updateLongTermMemory(longOnce, {
      ...baseInput,
      utterance: {
        ...baseInput.utterance,
        id: 'utt-3',
        timestamp: '2026-03-24T10:00:00Z',
      },
    });

    expect(midTwice).toHaveLength(1);
    expect(midTwice[0]?.evidence_count).toBe(2);
    expect(longTwice).toHaveLength(1);
    expect(longTwice[0]?.reinforcement_count).toBe(2);
  });

  it('retrieves only the most relevant memory items and injects compact personalization', () => {
    const store = updateUserMemoryStore(
      updateUserMemoryStore(
        resetUserMemoryStore('user-1', 'session-1', '2026-03-22T15:00:00Z'),
        baseInput,
      ),
      {
        ...baseInput,
        utterance: {
          id: 'utt-2',
          text: 'Family conversations have also been making me tense.',
          emotion: 'sad',
          confidence: 0.72,
          topic: 'family',
          timestamp: '2026-03-23T11:00:00Z',
        },
        emotion_summary: {
          latest_emotion: 'sad',
          dominant_recent_emotion: 'anxious',
          trend: 'mixed',
        },
      },
    );

    const retrieved = retrieveRelevantMemory(store, {
      topic: 'work',
      emotion: 'anxious',
    });

    expect(retrieved.mid_term).toHaveLength(2);
    expect(retrieved.mid_term[0]?.topic_key).toBe('work');
    expect(retrieved.long_term.length).toBeLessThanOrEqual(2);

    const injected = injectPersonalizationIntoLlmInput(
      {
        current_input: {
          text: 'I feel anxious about work today.',
          emotion: 'anxious',
          confidence: 0.81,
        },
        context_window: [],
        emotion_summary: {
          latest: 'anxious' as const,
          dominant_recent: 'anxious' as const,
          trend: 'rising' as const,
        },
        intent_signals: {
          needs_support: true,
          uncertainty: true,
          distress: true,
          reflection: true,
          repetitive_thoughts: false,
        },
        conversation_state: {
          turn_count: 4,
          recent_question_asked: false,
          guidance_recently_given: false,
        },
      },
      retrieved,
    );

    expect(injected.memory_context.recurring_topics).toContain('work');
    expect(injected.memory_context.unresolved_concerns.length).toBeLessThanOrEqual(2);
    expect(injected.memory_context.subtle_traits.length).toBeLessThanOrEqual(2);
  });

  it('caps long-term memory growth under repeated inserts', () => {
    let memories: ReturnType<typeof updateLongTermMemory> = [];

    for (let index = 0; index < 30; index += 1) {
      memories = updateLongTermMemory(memories, {
        ...baseInput,
        utterance: {
          id: `utt-${index}`,
          text: `I feel anxious about work topic ${index} and I need support.`,
          emotion: 'anxious',
          confidence: 0.7,
          topic: `work-${index}`,
          timestamp: `2026-03-22T16:${String(index).padStart(2, '0')}:00Z`,
        },
      });
    }

    expect(memories.length).toBe(24);
  });
});
