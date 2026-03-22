import { describe, expect, it } from 'vitest';
import {
  createPaywallEngine,
  createInitialPaywallState,
  reducePaywallState,
  recordPaywallDismissed,
  type PaywallEvent,
} from '@/lib/paywallEngine';

const dayMs = 24 * 60 * 60 * 1000;

const event = <T extends PaywallEvent['type']>(
  type: T,
  timestamp: number,
  sessionId: string,
  payload: Extract<PaywallEvent, { type: T }>['payload'],
): Extract<PaywallEvent, { type: T }> => ({
  type,
  timestamp,
  session_id: sessionId,
  payload,
});

describe('paywallEngine', () => {
  it('does not show a paywall on the first session', () => {
    const engine = createPaywallEngine();

    engine.evaluatePaywall(
      event('session_started', 1_000, 'session-1', {}),
    );
    engine.evaluatePaywall(
      event('minutes_updated', 2_000, 'session-1', {
        total_minutes_used_today: 15,
      }),
    );
    const decision = engine.evaluatePaywall(
      event('session_completed', 3_000, 'session-1', {}),
    );

    expect(decision.should_show_paywall).toBe(false);
    expect(decision.reason).toBeNull();
  });

  it('shows a paywall when the minute threshold is reached after value has been experienced', () => {
    const engine = createPaywallEngine();

    engine.evaluatePaywall(event('session_started', 1_000, 'session-1', {}));
    engine.evaluatePaywall(event('session_completed', 2_000, 'session-1', {}));
    engine.evaluatePaywall(event('session_started', 3_000, 'session-2', {}));

    const decision = engine.evaluatePaywall(
      event('minutes_updated', 4_000, 'session-2', {
        total_minutes_used_today: 12,
      }),
    );

    expect(decision).toEqual({
      should_show_paywall: true,
      reason: 'minute_cap',
      context: {
        emotion_state: null,
        user_stage: 'new',
      },
    });
  });

  it('shows a paywall for an insight moment after the first session', () => {
    const engine = createPaywallEngine();

    engine.evaluatePaywall(event('session_started', 1_000, 'session-1', {}));
    engine.evaluatePaywall(event('session_completed', 2_000, 'session-1', {}));
    engine.evaluatePaywall(event('session_started', 3_000, 'session-2', {}));

    const decision = engine.evaluatePaywall(
      event('insight_generated', 4_000, 'session-2', {
        generated: true,
      }),
    );

    expect(decision.should_show_paywall).toBe(true);
    expect(decision.reason).toBe('insight_moment');
  });

  it('suppresses a trigger during distress and delays it until session completion', () => {
    const engine = createPaywallEngine();

    engine.evaluatePaywall(event('session_started', 1_000, 'session-1', {}));
    engine.evaluatePaywall(event('session_completed', 2_000, 'session-1', {}));
    engine.evaluatePaywall(
      event('session_started', 3_000, 'session-2', {
        emotion_state: {
          label: 'anxious',
          confidence: 0.84,
        },
      }),
    );

    const suppressed = engine.evaluatePaywall(
      event('insight_generated', 4_000, 'session-2', {
        generated: true,
        emotion_state: {
          label: 'anxious',
          confidence: 0.84,
        },
      }),
    );
    const released = engine.evaluatePaywall(
      event('session_completed', 5_000, 'session-2', {
        emotion_state: {
          label: 'anxious',
          confidence: 0.84,
        },
      }),
    );

    expect(suppressed.should_show_paywall).toBe(false);
    expect(released).toEqual({
      should_show_paywall: true,
      reason: 'insight_moment',
      context: {
        emotion_state: 'anxious',
        user_stage: 'new',
      },
    });
  });

  it('enforces the daily limit after one paywall is shown', () => {
    const engine = createPaywallEngine();

    engine.evaluatePaywall(event('session_started', 1_000, 'session-1', {}));
    engine.evaluatePaywall(event('session_completed', 2_000, 'session-1', {}));
    engine.evaluatePaywall(event('session_started', 3_000, 'session-2', {}));
    const first = engine.evaluatePaywall(
      event('memory_limit_hit', 4_000, 'session-2', {
        hit: true,
      }),
    );
    const second = engine.evaluatePaywall(
      event('insight_generated', 5_000, 'session-2', {
        generated: true,
      }),
    );

    expect(first.should_show_paywall).toBe(true);
    expect(second.should_show_paywall).toBe(false);
    expect(second.reason).toBeNull();
  });

  it('enforces the weekly cap at three paywalls', () => {
    const engine = createPaywallEngine();

    engine.evaluatePaywall(event('session_started', 1_000, 'session-1', {}));
    engine.evaluatePaywall(event('session_completed', 2_000, 'session-1', {}));

    const day1 = engine.evaluatePaywall(
      event('memory_limit_hit', dayMs + 1_000, 'session-2', { hit: true }),
    );
    const day2 = engine.evaluatePaywall(
      event('insight_generated', 2 * dayMs + 1_000, 'session-3', { generated: true }),
    );
    const day3 = engine.evaluatePaywall(
      event('memory_limit_hit', 3 * dayMs + 1_000, 'session-4', { hit: true }),
    );
    const day4 = engine.evaluatePaywall(
      event('session_completed', 4 * dayMs + 1_000, 'session-5', {}),
    );

    expect(day1.should_show_paywall).toBe(true);
    expect(day2.should_show_paywall).toBe(true);
    expect(day3.should_show_paywall).toBe(true);
    expect(day4.should_show_paywall).toBe(false);
  });

  it('deduplicates identical events so the same trigger does not fire twice', () => {
    const engine = createPaywallEngine();

    engine.evaluatePaywall(event('session_started', 1_000, 'session-1', {}));
    engine.evaluatePaywall(event('session_completed', 2_000, 'session-1', {}));

    const trigger = event('memory_limit_hit', 3_000, 'session-2', { hit: true });
    const first = engine.evaluatePaywall(trigger);
    const second = engine.evaluatePaywall(trigger);

    expect(first.should_show_paywall).toBe(true);
    expect(second.should_show_paywall).toBe(false);
    expect(engine.getState().paywall_shown_count_today).toBe(1);
  });

  it('waits for the next meaningful trigger after a dismissal', () => {
    const initial = createInitialPaywallState();
    const shown = reducePaywallState(
      initial,
      event('memory_limit_hit', 10_000, 'session-9', { hit: true }),
    );
    const dismissed = recordPaywallDismissed(shown.state, 11_000);

    const blocked = reducePaywallState(
      dismissed,
      event('session_completed', 12_000, 'session-9', {}),
    );
    const released = reducePaywallState(
      blocked.state,
      event('insight_generated', dayMs + 13_000, 'session-10', { generated: true }),
    );

    expect(blocked.decision.should_show_paywall).toBe(false);
    expect(released.decision.should_show_paywall).toBe(true);
    expect(released.decision.reason).toBe('insight_moment');
  });

  it('stays stable under rapid mixed-order events and does not rewind counters', () => {
    const engine = createPaywallEngine({
      first_session_id: 'session-1',
      sessions_completed_total: 2,
      user_stage: 'engaged',
      last_state_updated_at: 20_000,
    });

    const fast = engine.evaluatePaywall(
      event('minutes_updated', 21_000, 'session-3', {
        total_minutes_used_today: 12,
      }),
    );
    const stale = engine.evaluatePaywall(
      event('minutes_updated', 19_000, 'session-3', {
        total_minutes_used_today: 3,
      }),
    );
    const repeated = engine.evaluatePaywall(
      event('minutes_updated', 21_000, 'session-3', {
        total_minutes_used_today: 12,
      }),
    );

    expect(fast.should_show_paywall).toBe(true);
    expect(fast.reason).toBe('minute_cap');
    expect(stale.should_show_paywall).toBe(false);
    expect(repeated.should_show_paywall).toBe(false);
    expect(engine.getState().total_minutes_used_today).toBe(12);
  });
});
