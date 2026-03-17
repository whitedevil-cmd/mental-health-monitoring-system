import { motion } from 'framer-motion';
import AppLayout from '@/components/layout/AppLayout';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { Brain, TrendingUp, AlertTriangle } from 'lucide-react';

const weeklyTrend = [
  { week: 'W1', joy: 0.4, calm: 0.5, sadness: 0.3, anger: 0.1 },
  { week: 'W2', joy: 0.5, calm: 0.6, sadness: 0.2, anger: 0.08 },
  { week: 'W3', joy: 0.55, calm: 0.65, sadness: 0.18, anger: 0.05 },
  { week: 'W4', joy: 0.7, calm: 0.75, sadness: 0.1, anger: 0.04 },
];

const distribution = [
  { name: 'Calm', value: 35, color: 'hsl(190, 60%, 55%)' },
  { name: 'Joy', value: 28, color: 'hsl(160, 64%, 52%)' },
  { name: 'Sadness', value: 15, color: 'hsl(235, 82%, 75%)' },
  { name: 'Fear', value: 12, color: 'hsl(263, 70%, 71%)' },
  { name: 'Anger', value: 5, color: 'hsl(25, 90%, 60%)' },
  { name: 'Surprise', value: 5, color: 'hsl(45, 90%, 55%)' },
];

const stressData = [
  { day: 'Mon', level: 3 },
  { day: 'Tue', level: 4 },
  { day: 'Wed', level: 2 },
  { day: 'Thu', level: 5 },
  { day: 'Fri', level: 3 },
  { day: 'Sat', level: 2 },
  { day: 'Sun', level: 1 },
];

const insights = [
  { type: 'positive' as const, title: 'Growing calmness', desc: 'Your calm moments have increased by 20% this month.' },
  { type: 'positive' as const, title: 'Consistent engagement', desc: "You've had 12 sessions this month — great consistency!" },
  { type: 'attention' as const, title: 'Mid-week stress', desc: 'Thursdays tend to be higher stress. Consider a mid-week check-in.' },
];

const container = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

const Insights = () => {
  return (
    <AppLayout>
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
        <motion.div variants={item}>
          <h1 className="text-3xl font-bold text-foreground">Emotion Insights</h1>
          <p className="text-muted-foreground mt-1">A deeper look at your emotional patterns</p>
        </motion.div>

        {/* AI insights */}
        <motion.div variants={item} className="grid gap-4 sm:grid-cols-3">
          {insights.map((ins, i) => (
            <div key={i} className={`glass-card rounded-2xl p-5 border-l-4 ${ins.type === 'positive' ? 'border-accent' : 'border-destructive'}`}>
              <div className="flex items-center gap-2 mb-2">
                {ins.type === 'positive' ? (
                  <TrendingUp className="h-4 w-4 text-accent" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                )}
                <h3 className="font-semibold text-foreground text-sm">{ins.title}</h3>
              </div>
              <p className="text-sm text-muted-foreground">{ins.desc}</p>
            </div>
          ))}
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Weekly trend */}
          <motion.div variants={item} className="glass-card rounded-2xl p-6">
            <h3 className="font-semibold text-foreground mb-4">Weekly Emotional Trends</h3>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={weeklyTrend}>
                <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: 'hsl(215, 16%, 47%)', fontSize: 12 }} />
                <YAxis hide />
                <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid hsl(220, 20%, 92%)' }} />
                <Area type="monotone" dataKey="calm" stroke="hsl(190, 60%, 55%)" fill="hsl(190, 60%, 55%)" fillOpacity={0.15} strokeWidth={2} />
                <Area type="monotone" dataKey="joy" stroke="hsl(160, 64%, 52%)" fill="hsl(160, 64%, 52%)" fillOpacity={0.15} strokeWidth={2} />
                <Area type="monotone" dataKey="sadness" stroke="hsl(235, 82%, 75%)" fill="transparent" strokeWidth={2} strokeDasharray="5 5" />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Pie chart */}
          <motion.div variants={item} className="glass-card rounded-2xl p-6">
            <h3 className="font-semibold text-foreground mb-4">Emotion Distribution</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={distribution} dataKey="value" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3}>
                  {distribution.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-3 justify-center mt-2">
              {distribution.map(d => (
                <div key={d.name} className="flex items-center gap-1.5 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-muted-foreground">{d.name}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Stress indicator */}
        <motion.div variants={item} className="glass-card rounded-2xl p-6">
          <h3 className="font-semibold text-foreground mb-4">Stress Level This Week</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={stressData}>
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: 'hsl(215, 16%, 47%)', fontSize: 12 }} />
              <YAxis hide domain={[0, 6]} />
              <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid hsl(220, 20%, 92%)' }} />
              <Bar dataKey="level" fill="hsl(263, 70%, 71%)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </motion.div>
    </AppLayout>
  );
};

export default Insights;
