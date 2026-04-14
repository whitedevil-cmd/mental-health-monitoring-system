import { describe, expect, it } from 'vitest';

import { getFriendlyAuthError, isNetworkAuthError } from '@/lib/authFeedback';

describe('authFeedback', () => {
  it('detects network-style auth failures', () => {
    expect(isNetworkAuthError('Failed to fetch')).toBe(true);
    expect(isNetworkAuthError('NetworkError when attempting to fetch resource.')).toBe(true);
    expect(isNetworkAuthError('Invalid login credentials')).toBe(false);
  });

  it('maps signup fetch failures to a user-facing network message', () => {
    expect(getFriendlyAuthError('Failed to fetch', 'signup')).toContain(
      'Could not reach the sign-up service.',
    );
  });

  it('still maps invalid login credentials cleanly', () => {
    expect(getFriendlyAuthError('Invalid login credentials', 'login')).toBe(
      'That email or password does not match an existing account.',
    );
  });
});
