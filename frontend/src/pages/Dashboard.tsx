import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Heart, Loader2, Mic, Sun, TrendingUp } from 'lucide-react';

import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient, HistoryResponseItem } from '@/lib/apiClient';
import {
  buildEmotionDistribution,
  buildInsightCards,
  buildWeeklyTrend,
  summarizeSessions,
} from '@/lib/emotionAnalytics';
import { preloadRoute } from '@/lib/routePreload';

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const Dashboard = () => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<HistoryResponseItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadHistory = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const nextEntries = await apiClient.getHistory(user?.id ?? undefined);
        if (!mounted) return;
        setEntries(nextEntries);
      } catch (err) {
        if (!mounted) return;
        console.error('Failed to load dashboard history:', err);
        setError('Unable to load dashboard insights right now.');
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    void loadHistory();

    return () => {
      mounted = false;
    };
  }, [user?.id]);

  const summary = useMemo(() => summarizeSessions(entries), [entries]);
  const trendData = useMemo(() => buildWeeklyTrend(entries), [entries]);
  const distribution = useMemo(() => buildEmotionDistribution(entries), [entries]);
  const notes = useMemo(() => buildInsightCards(entries), [entries]);

  return (
    <AppLayout>
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
        <motion.div variants={item} className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Your dashboard</h1>
            <p className="mt-1 text-muted-foreground">Live summaries from your actual Emoiva sessions</p>
          </div>
          <Button variant="hero" size="lg" asChild>
            <Link
              to="/voice"
              className="gap-2"
              onMouseEnter={() => preloadRoute('/voice')}
              onFocus={() => preloadRoute('/voice')}
            >
              <Mic className="h-5 w-5" />
              Start voice session
            </Link>
          </Button>
        </motion.div>

        {isLoading ? (
          <motion.div variants={item} className="glass-card flex items-center justify-center gap-3 rounded-2xl p-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading your dashboard...</span>
          </motion.div>
        ) : error ? (
          <motion.div variants={item} className="glass-card rounded-2xl border border-destructive/20 p-6 text-destructive">
            {error}
          </motion.div>
        ) : (
          <>
            <motion.div variants={item} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="glass-card rounded-2xl p-5">
                <div className="mb-2 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15">
                    <Sun className="h-5 w-5 text-accent" />
                  </div>
                  <span className="text-sm text-muted-foreground">Latest Mood</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{summary.todayMood}</p>
              </div>
              <div className="glass-card rounded-2xl p-5">
                <div className="mb-2 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
                    <TrendingUp className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-sm text-muted-foreground">Weekly Trend</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{summary.weeklyTrendLabel}</p>
              </div>
              <div className="glass-card rounded-2xl p-5">
                <div className="mb-2 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-insight/15">
                    <Heart className="h-5 w-5 text-insight" />
                  </div>
                  <span className="text-sm text-muted-foreground">Sessions This Week</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{summary.sessionsThisWeek}</p>
              </div>
            </motion.div>

            <motion.div variants={item} className="glass-card rounded-2xl border-l-4 border-accent p-6">
              <div className="flex items-start gap-3">
                <Heart className="mt-0.5 h-5 w-5 flex-shrink-0 text-accent" />
                <div>
                  <h3 className="mb-1 font-semibold text-foreground">A note from Emoiva</h3>
                  <p className="leading-relaxed text-muted-foreground">{notes[0]?.desc ?? 'Your session data will appear here after a few conversations.'}</p>
                </div>
              </div>
            </motion.div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <motion.div variants={item} className="glass-card rounded-2xl p-6 lg:col-span-2">
                <h3 className="mb-4 font-semibold text-foreground">Weekly Emotion Trends</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="calmGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(190, 60%, 55%)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="hsl(190, 60%, 55%)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="joyGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(160, 64%, 52%)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="hsl(160, 64%, 52%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: 'hsl(215, 16%, 47%)', fontSize: 12 }} />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(0, 0%, 100%)',
                        border: '1px solid hsl(220, 20%, 92%)',
                        borderRadius: '12px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                      }}
                    />
                    <Area type="monotone" dataKey="calm" stroke="hsl(190, 60%, 55%)" fill="url(#calmGrad)" strokeWidth={2} />
                    <Area type="monotone" dataKey="joy" stroke="hsl(160, 64%, 52%)" fill="url(#joyGrad)" strokeWidth={2} />
                    <Area type="monotone" dataKey="sadness" stroke="hsl(235, 82%, 75%)" fill="transparent" strokeWidth={2} strokeDasharray="5 5" />
                  </AreaChart>
                </ResponsiveContainer>
              </motion.div>

              <motion.div variants={item} className="glass-card rounded-2xl p-6">
                <h3 className="mb-4 font-semibold text-foreground">Emotion Distribution</h3>
                {distribution.length === 0 ? (
                  <div className="flex h-[200px] items-center justify-center text-center text-sm text-muted-foreground">
                    Record a few sessions to see your distribution.
                  </div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={distribution} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}>
                          {distribution.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="mt-2 flex flex-wrap justify-center gap-3">
                      {distribution.map((entry) => (
                        <div key={entry.name} className="flex items-center gap-1.5 text-xs">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                          <span className="text-muted-foreground">{entry.name}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </motion.div>
            </div>
          </>
        )}
      </motion.div>
    </AppLayout>
  );
};

export default Dashboard;
