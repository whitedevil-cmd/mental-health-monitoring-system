import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

import BackButton from '@/components/navigation/BackButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import {
  getCooldownKey,
  getCooldownSecondsRemaining,
  getFriendlyAuthError,
  readCooldownExpiry,
  writeCooldownExpiry,
} from '@/lib/authFeedback';

const RESET_EMAIL_COOLDOWN_SECONDS = 60;

const ForgotPassword = () => {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldownExpiry, setCooldownExpiry] = useState(0);

  const cooldownSeconds = useMemo(
    () => getCooldownSecondsRemaining(cooldownExpiry),
    [cooldownExpiry],
  );

  useEffect(() => {
    if (!email.trim()) {
      setCooldownExpiry(0);
      return;
    }

    setCooldownExpiry(readCooldownExpiry(getCooldownKey('forgot', email)));
  }, [email]);

  useEffect(() => {
    if (cooldownExpiry <= Date.now()) {
      return;
    }

    const timer = window.setInterval(() => {
      if (Date.now() >= cooldownExpiry) {
        setCooldownExpiry(0);
      } else {
        setCooldownExpiry(readCooldownExpiry(getCooldownKey('forgot', email)));
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [cooldownExpiry, email]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (cooldownSeconds > 0) {
      setError(`Please wait ${cooldownSeconds}s before requesting another reset link.`);
      return;
    }

    setLoading(true);
    setError('');
    const { error } = await resetPassword(email);

    if (error) {
      const friendly = getFriendlyAuthError(error.message, 'forgot');
      setError(friendly);
      if (friendly !== error.message || friendly.toLowerCase().includes('wait a minute')) {
        setCooldownExpiry(
          writeCooldownExpiry(getCooldownKey('forgot', email), RESET_EMAIL_COOLDOWN_SECONDS),
        );
      }
    } else {
      setSent(true);
      setCooldownExpiry(
        writeCooldownExpiry(getCooldownKey('forgot', email), RESET_EMAIL_COOLDOWN_SECONDS),
      );
    }

    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md space-y-8"
      >
        <BackButton fallbackTo="/login" className="px-0" />
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground">Reset password</h1>
          <p className="mt-2 text-muted-foreground">We&apos;ll send you a recovery link</p>
        </div>
        {sent ? (
          <div className="glass-card rounded-3xl p-8 text-center space-y-3">
            <h2 className="text-xl font-semibold text-foreground">Check your email</h2>
            <p className="text-muted-foreground">A recovery link has been sent to your inbox.</p>
            <p className="text-xs text-muted-foreground">
              If you need another email, wait about a minute before requesting it again.
            </p>
            <Link to="/login" className="text-primary hover:underline text-sm">
              Back to login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="glass-card rounded-3xl p-8 space-y-5">
            {error && <p className="text-sm text-destructive text-center">{error}</p>}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
                className="rounded-xl h-12"
              />
            </div>
            <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
              {loading ? 'Sending...' : cooldownSeconds > 0 ? `Wait ${cooldownSeconds}s` : 'Send reset link'}
            </Button>
            <p className="text-center text-sm">
              <Link to="/login" className="text-primary hover:underline">
                Back to login
              </Link>
            </p>
          </form>
        )}
      </motion.div>
    </div>
  );
};

export default ForgotPassword;
