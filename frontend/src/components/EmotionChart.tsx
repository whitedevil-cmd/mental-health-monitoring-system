import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { EmotionDataPoint } from '@/hooks/use-dashboard-data';

const EMOTION_COLORS: Record<string, string> = {
  happiness: 'hsl(45, 80%, 55%)',
  sadness: 'hsl(220, 60%, 55%)',
  anger: 'hsl(0, 65%, 55%)',
};

interface EmotionChartProps {
  data: EmotionDataPoint[];
}

export default function EmotionChart({ data }: EmotionChartProps) {
  return (
    <Card className="border-0" style={{ background: 'var(--gradient-card)', boxShadow: 'var(--shadow-soft)' }}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium text-foreground">Emotion Trends</CardTitle>
        <p className="text-xs text-muted-foreground">Happiness, sadness & anger over time</p>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <defs>
                {Object.entries(EMOTION_COLORS).map(([key, color]) => (
                  <linearGradient key={key} id={`gradient-${key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '0.75rem',
                  fontSize: 12,
                  boxShadow: 'var(--shadow-elevated)',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 500 }}
              />
              {Object.entries(EMOTION_COLORS).map(([key, color]) => (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={color}
                  strokeWidth={2}
                  fill={`url(#gradient-${key})`}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, fill: 'hsl(var(--card))' }}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-center gap-5 mt-3">
          {Object.entries(EMOTION_COLORS).map(([key, color]) => (
            <div key={key} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-xs text-muted-foreground capitalize">{key}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
