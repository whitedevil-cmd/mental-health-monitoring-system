const RATE_LIMIT_PATTERNS = [
  'rate limit',
  'rate_limit',
  'too many requests',
  'too many retries',
  'email rate limit exceeded',
  'over_email_send_rate_limit',
];

const NETWORK_ERROR_PATTERNS = [
  'failed to fetch',
  'networkerror',
  'network request failed',
  'load failed',
];

export const isRateLimitError = (message: string): boolean => {
  const normalized = message.trim().toLowerCase();
  return RATE_LIMIT_PATTERNS.some((pattern) => normalized.includes(pattern));
};

export const isNetworkAuthError = (message: string): boolean => {
  const normalized = message.trim().toLowerCase();
  return NETWORK_ERROR_PATTERNS.some((pattern) => normalized.includes(pattern));
};

export const getFriendlyAuthError = (message: string, flow: 'signup' | 'forgot' | 'login'): string => {
  if (isNetworkAuthError(message)) {
    if (flow === 'signup') {
      return 'Could not reach the sign-up service. Check your connection, disable blocking extensions for this site, and try again.';
    }

    if (flow === 'forgot') {
      return 'Could not reach the recovery email service. Check your connection and try again.';
    }

    return 'Could not reach the sign-in service. Check your connection and try again.';
  }

  if (isRateLimitError(message)) {
    if (flow === 'signup') {
      return 'Too many signup emails were requested recently. Wait a minute, then try again. If the account already exists, sign in instead.';
    }

    if (flow === 'forgot') {
      return 'A recovery email was sent recently. Wait a minute before requesting another reset link.';
    }

    return 'Too many authentication requests were made recently. Wait a minute and try again.';
  }

  if (flow === 'login' && message.toLowerCase().includes('invalid login credentials')) {
    return 'That email or password does not match an existing account.';
  }

  return message;
};

export const getCooldownKey = (flow: 'signup' | 'forgot', email: string): string =>
  `emoiva.authCooldown.${flow}.${email.trim().toLowerCase()}`;

export const readCooldownExpiry = (key: string): number => {
  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return 0;
  }

  const expiry = Number(raw);
  return Number.isFinite(expiry) ? expiry : 0;
};

export const writeCooldownExpiry = (key: string, secondsFromNow: number): number => {
  const expiry = Date.now() + secondsFromNow * 1000;
  window.localStorage.setItem(key, String(expiry));
  return expiry;
};

export const getCooldownSecondsRemaining = (expiry: number): number =>
  Math.max(0, Math.ceil((expiry - Date.now()) / 1000));
