import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';

import BackButton from '@/components/navigation/BackButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
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
  const { signUp, verifyOtp, resendSignupOtp, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [action, setAction] = useState<'signup' | 'verify' | 'resend' | null>(null);
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

    setAction('signup');
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

    setAction(null);
  };

  const handleVerifyOtp = async (event: React.FormEvent) => {
    event.preventDefault();

    if (otp.trim().length !== 8) {
      setError('Enter the 8-digit OTP from your email.');
      return;
    }

    setAction('verify');
    setError('');
    const { error } = await verifyOtp(email, otp);
    if (error) {
      setError(getFriendlyAuthError(error.message, 'signup'));
    }
    setAction(null);
  };

  const handleResendOtp = async () => {
    if (cooldownSeconds > 0) {
      setError(`Please wait ${cooldownSeconds}s before requesting another OTP.`);
      return;
    }

    setAction('resend');
    setError('');
    const { error } = await resendSignupOtp(email);
    if (error) {
      const friendly = getFriendlyAuthError(error.message, 'signup');
      setError(friendly);
      if (friendly !== error.message || friendly.toLowerCase().includes('wait a minute')) {
        setCooldownExpiry(
          writeCooldownExpiry(getCooldownKey('signup', email), SIGNUP_EMAIL_COOLDOWN_SECONDS),
        );
      }
    } else {
      setCooldownExpiry(
        writeCooldownExpiry(getCooldownKey('signup', email), SIGNUP_EMAIL_COOLDOWN_SECONDS),
      );
    }
    setAction(null);
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
          <form onSubmit={handleVerifyOtp} className="glass-card rounded-3xl p-8 text-center space-y-5">
            <h2 className="text-xl font-semibold text-foreground">Enter your OTP</h2>
            <p className="text-muted-foreground">
              We sent an 8-digit code to <span className="font-medium text-foreground">{email}</span>.
            </p>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-center">
              <InputOTP maxLength={8} value={otp} onChange={setOtp}>
                <InputOTPGroup className="flex-wrap justify-center gap-2">
                  {Array.from({ length: 8 }, (_, index) => (
                    <InputOTPSlot key={index} index={index} className="h-12 w-12 text-base" />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
            <Button
              type="submit"
              variant="hero"
              size="lg"
              className="w-full"
              disabled={action !== null || otp.trim().length !== 8}
            >
              {action === 'verify' ? 'Verifying...' : 'Verify OTP'}
            </Button>
            <Button
              type="button"
              variant="soft"
              size="lg"
              className="w-full"
              disabled={action !== null || cooldownSeconds > 0}
              onClick={handleResendOtp}
            >
              {action === 'resend'
                ? 'Sending...'
                : cooldownSeconds > 0
                  ? `Resend in ${cooldownSeconds}s`
                  : 'Resend OTP'}
            </Button>
            <p className="text-xs text-muted-foreground">
              Use the latest OTP from your inbox. If multiple people are signing up at once, wait
              about a minute before requesting another email.
            </p>
          </form>
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
            <Button type="submit" variant="hero" size="lg" className="w-full" disabled={action !== null}>
              {action === 'signup' ? 'Creating account...' : cooldownSeconds > 0 ? `Wait ${cooldownSeconds}s` : 'Get started'}
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
