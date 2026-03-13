import { Card, CardContent } from '@/components/ui/card';

interface StressIndicatorProps {
  level: number; // 0-100
}

function getStressInfo(level: number) {
  if (level <= 25) return { label: 'Low', color: 'hsl(var(--success))', bg: 'hsl(var(--success) / 0.1)' };
  if (level <= 50) return { label: 'Moderate', color: 'hsl(168, 40%, 45%)', bg: 'hsl(168, 40%, 45%, 0.1)' };
  if (level <= 75) return { label: 'Elevated', color: 'hsl(30, 70%, 55%)', bg: 'hsl(30, 70%, 55%, 0.1)' };
  return { label: 'High', color: 'hsl(var(--recording))', bg: 'hsl(var(--recording) / 0.1)' };
}

export default function StressIndicator({ level }: StressIndicatorProps) {
  const info = getStressInfo(level);
  const rotation = -90 + (level / 100) * 180; // -90 to 90 degrees

  return (
    <Card className="border-0" style={{ background: 'var(--gradient-card)', boxShadow: 'var(--shadow-soft)' }}>
      <CardContent className="p-6 flex flex-col items-center gap-3">
        <p className="text-xs font-medium tracking-widest uppercase text-muted-foreground">Stress Level</p>

        {/* Gauge */}
        <div className="relative w-32 h-20 overflow-hidden">
          <svg viewBox="0 0 120 70" className="w-full h-full">
            {/* Background arc */}
            <path
              d="M 10 65 A 50 50 0 0 1 110 65"
              fill="none"
              stroke="hsl(var(--border))"
              strokeWidth="8"
              strokeLinecap="round"
            />
            {/* Active arc */}
            <path
              d="M 10 65 A 50 50 0 0 1 110 65"
              fill="none"
              stroke={info.color}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${(level / 100) * 157} 157`}
              className="transition-all duration-700"
            />
            {/* Needle */}
            <line
              x1="60"
              y1="65"
              x2="60"
              y2="25"
              stroke="hsl(var(--foreground))"
              strokeWidth="2"
              strokeLinecap="round"
              transform={`rotate(${rotation}, 60, 65)`}
              className="transition-all duration-700"
            />
            <circle cx="60" cy="65" r="4" fill="hsl(var(--foreground))" />
          </svg>
        </div>

        <div className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: info.color }}
          />
          <span className="text-lg font-semibold text-foreground">{level}%</span>
          <span className="text-sm text-muted-foreground">— {info.label}</span>
        </div>
      </CardContent>
    </Card>
  );
}
