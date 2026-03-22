import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  KeyRound,
  HeartHandshake,
  History,
  Lightbulb,
  LogOut,
  Settings2,
  Shield,
  UserCircle2,
} from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

const initialsFromLabel = (label: string): string => {
  const cleaned = label.trim();
  if (!cleaned) {
    return 'S';
  }

  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
};

const Profile = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    'Mindful Member';
  const email = user?.email ?? 'Signed in account';

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const accountItems = [
    { label: 'Edit Profile', subtitle: 'Update your account details', icon: UserCircle2, to: '/edit-profile' },
    { label: 'Preferences', subtitle: 'Tune your session experience', icon: Settings2, to: '/preferences' },
    { label: 'Session History', subtitle: 'Review past conversations', icon: History, to: '/history' },
    { label: 'Insights', subtitle: 'See your emotional patterns', icon: Lightbulb, to: '/insights' },
  ];

  const securityItems = [
    { label: 'Change Password', subtitle: 'Update your account password while signed in', icon: KeyRound, to: '/change-password' },
    { label: 'Forgot Password', subtitle: 'Send a recovery link to your email', icon: KeyRound, to: '/forgot-password' },
  ];

  const supportItems = [
    { label: 'Help & Support', subtitle: 'Get assistance when you need it', icon: HeartHandshake, to: '/support' },
    { label: 'Privacy & Terms', subtitle: 'Read how your data is handled', icon: Shield, to: '/privacy' },
  ];

  return (
    <AppLayout>
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="mx-auto max-w-3xl space-y-6"
      >
        <motion.section variants={item} className="glass-card rounded-3xl p-6 md:p-8">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-xl font-semibold text-primary">
              {initialsFromLabel(displayName)}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold text-foreground">{displayName}</h1>
              <p className="truncate text-sm text-muted-foreground">{email}</p>
              <p className="mt-1 text-sm text-muted-foreground">Your Emoiva account</p>
            </div>
          </div>
        </motion.section>

        <motion.section variants={item} className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Account
            </h2>
          </div>
          <div className="overflow-hidden rounded-3xl border border-border bg-card">
            {accountItems.map((entry) => {
              const content = (
                <>
                  <div className="flex items-center gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-foreground">
                      <entry.icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{entry.label}</p>
                      <p className="text-sm text-muted-foreground">{entry.subtitle}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </>
              );

              if (entry.to) {
                return (
                  <Link
                    key={entry.label}
                    to={entry.to}
                    className="flex items-center justify-between gap-3 border-b border-border px-4 py-4 transition-colors last:border-b-0 hover:bg-secondary/50"
                  >
                    {content}
                  </Link>
                );
              }

              return null;
            })}
          </div>
        </motion.section>

        <motion.section variants={item} className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Security
            </h2>
          </div>
          <div className="overflow-hidden rounded-3xl border border-border bg-card">
            {securityItems.map((entry) => (
              <Link
                key={entry.label}
                to={entry.to}
                className="flex items-center justify-between gap-3 border-b border-border px-4 py-4 text-left transition-colors last:border-b-0 hover:bg-secondary/50"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-foreground">
                    <entry.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{entry.label}</p>
                    <p className="text-sm text-muted-foreground">{entry.subtitle}</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </motion.section>

        <motion.section variants={item} className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              App & Support
            </h2>
          </div>
          <div className="overflow-hidden rounded-3xl border border-border bg-card">
            {supportItems.map((entry) => (
              <Link
                key={entry.label}
                to={entry.to}
                className="flex items-center justify-between gap-3 border-b border-border px-4 py-4 text-left transition-colors last:border-b-0 hover:bg-secondary/50"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-foreground">
                    <entry.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{entry.label}</p>
                    <p className="text-sm text-muted-foreground">{entry.subtitle}</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </motion.section>

        <motion.section variants={item} className="pt-2">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={handleSignOut}
            className="h-12 w-full justify-center border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-5 w-5" />
            Sign out
          </Button>
        </motion.section>
      </motion.div>
    </AppLayout>
  );
};

export default Profile;
