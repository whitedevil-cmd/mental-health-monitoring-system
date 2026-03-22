import { describe, expect, it, vi } from 'vitest';
import {
  THERAPIST_SYSTEM_PROMPT,
  buildConversationContext,
  buildTherapistMessages,
  classifyRiskLevel,
  generateTherapistResponse,
  postProcessTherapistResponse,
} from '@/lib/conversationAi';

describe('conversationAi', () => {
  it('builds a compact conversation context from recent utterances', () => {
    const context = buildConversationContext('session-1', [
      { id: '1', text: 'I feel a little off today.', emotion: 'sad', confidence: 0.71, timestamp: '2026-03-22T10:00:00Z', status: 'resolved' },
      { id: '2', text: 'I feel a little off today.', emotion: 'sad', confidence: 0.71, timestamp: '2026-03-22T10:00:01Z', status: 'resolved' },
      { id: '3', text: 'I am not sure why.', emotion: 'sad', confidence: 0.74, timestamp: '2026-03-22T10:00:05Z', status: 'resolved' },
      { id: '4', text: 'Maybe work is getting to me.', emotion: 'anxious', confidence: 0.69, timestamp: '2026-03-22T10:00:10Z', status: 'resolved' },
    ]);

    expect(context).not.toBeNull();
    expect(context?.current_input.text).toBe('Maybe work is getting to me.');
    expect(context?.context_window).toHaveLength(2);
    expect(context?.emotion_summary.latest).toBe('anxious');
    expect(context?.intent_signals.uncertainty).toBe(true);
  });

  it('classifies high-risk input conservatively but directly', () => {
    const input = {
      current_input: {
        text: 'I want to die tonight.',
        emotion: 'sad',
        confidence: 0.96,
      },
      context_window: [],
      emotion_summary: {
        latest: 'sad',
        dominant_recent: 'sad',
        trend: 'rising' as const,
      },
      intent_signals: {
        needs_support: true,
        uncertainty: false,
        distress: true,
        reflection: false,
        repetitive_thoughts: false,
      },
      conversation_state: {
        turn_count: 1,
        recent_question_asked: false,
        guidance_recently_given: false,
      },
    };

    expect(classifyRiskLevel(input)).toBe('high');
  });

  it('formats compact LLM messages with response rules', () => {
    const input = {
      current_input: {
        text: 'I feel really anxious right now.',
        emotion: 'anxious',
        confidence: 0.82,
      },
      context_window: [
        { text: 'I think I am spiraling a bit.', emotion: 'anxious', confidence: 0.78 },
      ],
      emotion_summary: {
        latest: 'anxious',
        dominant_recent: 'anxious',
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
        turn_count: 2,
        recent_question_asked: false,
        guidance_recently_given: false,
      },
      memory_context: {
        recurring_topics: ['work'],
        unresolved_concerns: ['User often discusses work with an anxious emotional tone.'],
        support_style: 'reflective' as const,
        emotional_tendency: 'anxious',
        subtle_traits: ['User frequently returns to work and responds best to reflective support.'],
      },
    };

    const messages = buildTherapistMessages(input);

    expect(messages).toHaveLength(2);
    expect(messages[0].content).toContain('AI mental health support companion');
    expect(messages[0].content).toContain('help the user feel heard, not managed');
    expect(messages[1].content).toContain('"risk_level":"moderate"');
    expect(messages[1].content).toContain('"ask_follow_up_question":true');
    expect(messages[1].content).toContain('"response_style":"reflective"');
    expect(messages[1].content).toContain('"memory_context"');
    expect(messages[1].content).toContain('"recurring_topics":["work"]');
  });

  it('post-processes responses to keep them short and add safety direction for high risk', () => {
    const input = {
      current_input: {
        text: 'I want to die tonight.',
        emotion: 'sad',
        confidence: 0.93,
      },
      context_window: [],
      emotion_summary: {
        latest: 'sad',
        dominant_recent: 'sad',
        trend: 'rising' as const,
      },
      intent_signals: {
        needs_support: true,
        uncertainty: false,
        distress: true,
        reflection: false,
        repetitive_thoughts: false,
      },
      conversation_state: {
        turn_count: 1,
        recent_question_asked: false,
        guidance_recently_given: false,
      },
    };

    const response = postProcessTherapistResponse(
      'That sounds incredibly heavy. I am really glad you said it out loud. Please pause with me for a second. You deserve immediate support.',
      input,
    );

    expect(response).toContain('local emergency services');
  });

  it('generates a final therapist response through the injected completion function', async () => {
    const input = {
      current_input: {
        text: 'I feel low and tired.',
        emotion: 'sad',
        confidence: 0.81,
      },
      context_window: [
        { text: 'It has been a long week.', emotion: 'sad', confidence: 0.72 },
      ],
      emotion_summary: {
        latest: 'sad',
        dominant_recent: 'sad',
        trend: 'stable' as const,
      },
      intent_signals: {
        needs_support: true,
        uncertainty: false,
        distress: false,
        reflection: true,
        repetitive_thoughts: false,
      },
      conversation_state: {
        turn_count: 2,
        recent_question_asked: false,
        guidance_recently_given: false,
      },
    };
    const createCompletion = vi.fn().mockResolvedValue(
      'That sounds like a lot to be carrying. It seems like you are worn down. What feels heaviest right now?',
    );

    const result = await generateTherapistResponse(input, createCompletion);

    expect(createCompletion).toHaveBeenCalledOnce();
    expect(result.risk_level).toBe('moderate');
    expect(result.text).toContain('worn down');
    expect(result.text.split(/[.!?]/).filter(Boolean).length).toBeLessThanOrEqual(4);
  });

  it('keeps the system prompt stable and plain-text oriented', () => {
    expect(THERAPIST_SYSTEM_PROMPT).toContain('return plain text only');
    expect(THERAPIST_SYSTEM_PROMPT).toContain('never diagnose, label disorders, or claim certainty about mental health conditions');
    expect(THERAPIST_SYSTEM_PROMPT).toContain('help the user feel heard, not managed');
  });
});
