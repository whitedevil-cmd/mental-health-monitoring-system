import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
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

const SIGNUP_EMAIL_COOLDOWN_SECONDS = 60;

const Signup = () => {
  const { signUp, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
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

    setCooldownExpiry(readCooldownExpiry(getCooldownKey('signup', email)));
  }, [email]);

  useEffect(() => {
    if (cooldownExpiry <= Date.now()) {
      return;
    }

    const timer = window.setInterval(() => {
      if (Date.now() >= cooldownExpiry) {
        setCooldownExpiry(0);
      } else {
        setCooldownExpiry(readCooldownExpiry(getCooldownKey('signup', email)));
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [cooldownExpiry, email]);

  if (user) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (cooldownSeconds > 0) {
      setError(`Please wait ${cooldownSeconds}s before requesting another signup email.`);
      return;
    }

    setLoading(true);
    setError('');
    const { error } = await signUp(email, password);

    if (error) {
      const friendly = getFriendlyAuthError(error.message, 'signup');
      setError(friendly);
      if (friendly !== error.message || friendly.toLowerCase().includes('wait a minute')) {
        setCooldownExpiry(
          writeCooldownExpiry(getCooldownKey('signup', email), SIGNUP_EMAIL_COOLDOWN_SECONDS),
        );
      }
    } else {
      setSuccess(true);
      setCooldownExpiry(
        writeCooldownExpiry(getCooldownKey('signup', email), SIGNUP_EMAIL_COOLDOWN_SECONDS),
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
        <BackButton fallbackTo="/" className="px-0" />
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground">Begin your journey</h1>
          <p className="mt-2 text-muted-foreground">Create your account to start feeling heard</p>
        </div>
        {success ? (
          <div className="glass-card rounded-3xl p-8 text-center space-y-3">
            <div className="text-4xl">Spark</div>
            <h2 className="text-xl font-semibold text-foreground">Check your email</h2>
            <p className="text-muted-foreground">We&apos;ve sent you a confirmation link.</p>
            <p className="text-xs text-muted-foreground">
              If multiple people are signing up at once, wait about a minute before requesting
              another email.
            </p>
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
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="rounded-xl h-12"
              />
            </div>
            <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
              {loading ? 'Creating account...' : cooldownSeconds > 0 ? `Wait ${cooldownSeconds}s` : 'Get started'}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link to="/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        )}
      </motion.div>
    </div>
  );
};

export default Signup;
