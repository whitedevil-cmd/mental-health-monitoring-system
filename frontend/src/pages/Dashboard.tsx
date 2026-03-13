import { useDashboardData } from '@/hooks/use-dashboard-data';
import EmotionChart from '@/components/EmotionChart';
import CurrentEmotionCard from '@/components/CurrentEmotionCard';
import StressIndicator from '@/components/StressIndicator';
import AiSupportPanel from '@/components/AiSupportPanel';
import { NavLink } from '@/components/NavLink';
import { Mic } from 'lucide-react';

export default function Dashboard() {
  const { data } = useDashboardData();

  return (
    <div
      className="min-h-screen p-4 md:p-8 relative overflow-hidden"
      style={{ background: 'var(--gradient-warm)' }}
    >
      {/* Decorative blobs */}
      <div className="absolute top-[-8%] right-[-4%] w-80 h-80 rounded-full bg-primary/5 blur-3xl" />
      <div className="absolute bottom-[-8%] left-[-4%] w-96 h-96 rounded-full bg-accent/10 blur-3xl" />

      <div className="relative z-10 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-xs font-medium tracking-widest uppercase text-muted-foreground">Mindful</p>
            <h1 className="text-2xl font-semibold text-foreground" style={{ fontFamily: "'Fraunces', serif" }}>
              Your Dashboard
            </h1>
          </div>
          <NavLink to="/">
            <Mic className="h-4 w-4" />
            Record
          </NavLink>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Emotion chart — spans 2 cols */}
          <div className="md:col-span-2">
            <EmotionChart data={data.emotionTrend} />
          </div>

          {/* Current emotion */}
          <div className="flex flex-col gap-4">
            <CurrentEmotionCard emotion={data.currentEmotion} confidence={data.confidence} />
            <StressIndicator level={data.stressLevel} />
          </div>

          {/* AI Support — full width */}
          <div className="md:col-span-3">
            <AiSupportPanel messages={data.aiMessages} />
          </div>
        </div>
      </div>
    </div>
  );
}
