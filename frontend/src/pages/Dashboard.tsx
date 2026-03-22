import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Mic, TrendingUp, Heart, Sun } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { preloadRoute } from '@/lib/routePreload';

const mockTrend = [
  { day: 'Mon', calm: 0.7, joy: 0.5, sadness: 0.2 },
  { day: 'Tue', calm: 0.6, joy: 0.6, sadness: 0.3 },
  { day: 'Wed', calm: 0.8, joy: 0.7, sadness: 0.1 },
  { day: 'Thu', calm: 0.5, joy: 0.4, sadness: 0.4 },
  { day: 'Fri', calm: 0.7, joy: 0.8, sadness: 0.15 },
  { day: 'Sat', calm: 0.9, joy: 0.7, sadness: 0.1 },
  { day: 'Sun', calm: 0.8, joy: 0.9, sadness: 0.05 },
];

const mockDistribution = [
  { name: 'Calm', value: 35, color: 'hsl(190, 60%, 55%)' },
  { name: 'Joy', value: 28, color: 'hsl(160, 64%, 52%)' },
  { name: 'Sadness', value: 15, color: 'hsl(235, 82%, 75%)' },
  { name: 'Fear', value: 12, color: 'hsl(263, 70%, 71%)' },
  { name: 'Surprise', value: 10, color: 'hsl(45, 90%, 55%)' },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const Dashboard = () => {
  return (
    <AppLayout>
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
        {/* Header */}
        <motion.div variants={item} className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Good afternoon 🌤️</h1>
            <p className="text-muted-foreground mt-1">Here's how you've been feeling lately</p>
          </div>
          <Button variant="hero" size="lg" asChild>
            <Link
              to="/voice"
              className="gap-2"
              onMouseEnter={() => preloadRoute('/voice')}
              onFocus={() => preloadRoute('/voice')}
            >
              <Mic className="h-5 w-5" /> Start voice session
            </Link>
          </Button>
        </motion.div>

        {/* Summary cards */}
        <motion.div variants={item} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="glass-card rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center">
                <Sun className="h-5 w-5 text-accent" />
              </div>
              <span className="text-sm text-muted-foreground">Today's Mood</span>
            </div>
            <p className="text-2xl font-bold text-foreground">Calm & Hopeful</p>
          </div>
          <div className="glass-card rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <span className="text-sm text-muted-foreground">Weekly Trend</span>
            </div>
            <p className="text-2xl font-bold text-foreground">Improving ↑</p>
          </div>
          <div className="glass-card rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-insight/15 flex items-center justify-center">
                <Heart className="h-5 w-5 text-insight" />
              </div>
              <span className="text-sm text-muted-foreground">Sessions This Week</span>
            </div>
            <p className="text-2xl font-bold text-foreground">5 conversations</p>
          </div>
        </motion.div>

        {/* AI message */}
        <motion.div variants={item} className="glass-card rounded-2xl p-6 border-l-4 border-accent">
          <div className="flex items-start gap-3">
            <Heart className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-foreground mb-1">A note from SereneAI</h3>
              <p className="text-muted-foreground leading-relaxed">
                I've noticed you've been more at ease this week. Your calm moments are growing, 
                and that's something to celebrate. Remember — progress isn't always linear, 
                and every step counts. 💙
              </p>
            </div>
          </div>
        </motion.div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <motion.div variants={item} className="lg:col-span-2 glass-card rounded-2xl p-6">
            <h3 className="font-semibold text-foreground mb-4">Weekly Emotion Trends</h3>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={mockTrend}>
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
            <h3 className="font-semibold text-foreground mb-4">Emotion Distribution</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={mockDistribution} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}>
                  {mockDistribution.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-3 mt-2 justify-center">
              {mockDistribution.map(d => (
                <div key={d.name} className="flex items-center gap-1.5 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-muted-foreground">{d.name}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </motion.div>
    </AppLayout>
  );
};

export default Dashboard;
