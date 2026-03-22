import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangle, Brain, Loader2, TrendingUp } from 'lucide-react';

import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient, HistoryResponseItem } from '@/lib/apiClient';
import {
  buildEmotionDistribution,
  buildInsightCards,
  buildWeeklyTrend,
} from '@/lib/emotionAnalytics';

const container = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

const Insights = () => {
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
        console.error('Failed to load insight history:', err);
        setError('Unable to load insight data right now.');
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

  const weeklyTrend = useMemo(() => buildWeeklyTrend(entries), [entries]);
  const distribution = useMemo(() => buildEmotionDistribution(entries), [entries]);
  const insights = useMemo(() => buildInsightCards(entries), [entries]);
  const stressData = useMemo(
    () => weeklyTrend.map((day) => ({ day: day.day, level: day.stress })),
    [weeklyTrend],
  );

  return (
    <AppLayout>
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
        <motion.div variants={item}>
          <div className="flex items-center gap-3">
            <Brain className="h-7 w-7 text-primary" />
            <div>
              <h1 className="text-3xl font-bold text-foreground">Emotion Insights</h1>
              <p className="mt-1 text-muted-foreground">Patterns derived from your saved Emoiva sessions</p>
            </div>
          </div>
        </motion.div>

        {isLoading ? (
          <motion.div variants={item} className="glass-card flex items-center justify-center gap-3 rounded-2xl p-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading your insights...</span>
          </motion.div>
        ) : error ? (
          <motion.div variants={item} className="glass-card rounded-2xl border border-destructive/20 p-6 text-destructive">
            {error}
          </motion.div>
        ) : (
          <>
            <motion.div variants={item} className="grid gap-4 sm:grid-cols-3">
              {insights.map((insight, index) => (
                <div
                  key={`${insight.title}-${index}`}
                  className={`glass-card rounded-2xl border-l-4 p-5 ${insight.type === 'positive' ? 'border-accent' : insight.type === 'attention' ? 'border-destructive' : 'border-primary'}`}
                >
                  <div className="mb-2 flex items-center gap-2">
                    {insight.type === 'positive' ? (
                      <TrendingUp className="h-4 w-4 text-accent" />
                    ) : insight.type === 'attention' ? (
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                    ) : (
                      <Brain className="h-4 w-4 text-primary" />
                    )}
                    <h3 className="text-sm font-semibold text-foreground">{insight.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">{insight.desc}</p>
                </div>
              ))}
            </motion.div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <motion.div variants={item} className="glass-card rounded-2xl p-6">
                <h3 className="mb-4 font-semibold text-foreground">Weekly Emotional Trends</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={weeklyTrend}>
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: 'hsl(215, 16%, 47%)', fontSize: 12 }} />
                    <YAxis hide />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid hsl(220, 20%, 92%)' }} />
                    <Area type="monotone" dataKey="calm" stroke="hsl(190, 60%, 55%)" fill="hsl(190, 60%, 55%)" fillOpacity={0.15} strokeWidth={2} />
                    <Area type="monotone" dataKey="joy" stroke="hsl(160, 64%, 52%)" fill="hsl(160, 64%, 52%)" fillOpacity={0.15} strokeWidth={2} />
                    <Area type="monotone" dataKey="sadness" stroke="hsl(235, 82%, 75%)" fill="transparent" strokeWidth={2} strokeDasharray="5 5" />
                  </AreaChart>
                </ResponsiveContainer>
              </motion.div>

              <motion.div variants={item} className="glass-card rounded-2xl p-6">
                <h3 className="mb-4 font-semibold text-foreground">Emotion Distribution</h3>
                {distribution.length === 0 ? (
                  <div className="flex h-[220px] items-center justify-center text-center text-sm text-muted-foreground">
                    Record a few sessions to unlock distribution insights.
                  </div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={distribution} dataKey="value" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3}>
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

            <motion.div variants={item} className="glass-card rounded-2xl p-6">
              <h3 className="mb-4 font-semibold text-foreground">Stress Signal This Week</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={stressData}>
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: 'hsl(215, 16%, 47%)', fontSize: 12 }} />
                  <YAxis hide domain={[0, 'dataMax + 1']} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid hsl(220, 20%, 92%)' }} />
                  <Bar dataKey="level" fill="hsl(263, 70%, 71%)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>
          </>
        )}
      </motion.div>
    </AppLayout>
  );
};

export default Insights;
