import { Card, CardContent } from '@/components/ui/card';
import type { EmotionType } from '@/hooks/use-dashboard-data';

const EMOTION_CONFIG: Record<EmotionType, { emoji: string; label: string; hue: string }> = {
  happiness: { emoji: '😊', label: 'Happy', hue: '45 80% 55%' },
  sadness: { emoji: '😔', label: 'Sad', hue: '220 60% 55%' },
  anger: { emoji: '😤', label: 'Angry', hue: '0 65% 55%' },
  calm: { emoji: '😌', label: 'Calm', hue: '168 45% 40%' },
  anxiety: { emoji: '😰', label: 'Anxious', hue: '30 70% 55%' },
};

interface CurrentEmotionCardProps {
  emotion: EmotionType;
  confidence: number;
}

export default function CurrentEmotionCard({ emotion, confidence }: CurrentEmotionCardProps) {
  const config = EMOTION_CONFIG[emotion];

  return (
    <Card className="border-0 overflow-hidden" style={{ background: 'var(--gradient-card)', boxShadow: 'var(--shadow-soft)' }}>
      <CardContent className="p-6 flex flex-col items-center text-center gap-3">
        <div
          className="h-16 w-16 rounded-full flex items-center justify-center text-3xl"
          style={{ background: `hsl(${config.hue} / 0.12)` }}
        >
          {config.emoji}
        </div>
        <div>
          <p className="text-xs font-medium tracking-widest uppercase text-muted-foreground mb-1">Current Emotion</p>
          <p className="text-xl font-semibold text-foreground" style={{ fontFamily: "'Fraunces', serif" }}>
            {config.label}
          </p>
        </div>
        <div className="w-full">
          <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
            <span>Confidence</span>
            <span>{confidence}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${confidence}%`,
                background: `hsl(${config.hue})`,
              }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
