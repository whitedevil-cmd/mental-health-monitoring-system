import { motion } from 'framer-motion';
import { EmotionScore, EMOTION_COLORS } from '@/types';

const EmotionProbabilityBars = ({ emotions }: { emotions: EmotionScore[] }) => {
  const sorted = [...emotions].sort((a, b) => b.score - a.score);

  if (sorted.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        Emotion analysis will appear here after you speak.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sorted.map((e, i) => (
        <div key={e.emotion} className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="capitalize font-medium text-foreground">{e.emotion}</span>
            <span className="text-muted-foreground">{Math.round(e.score * 100)}%</span>
          </div>
          <div className="h-3 rounded-full bg-secondary overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${e.score * 100}%` }}
              transition={{ duration: 0.6, delay: i * 0.08, ease: 'easeOut' }}
              className="h-full rounded-full"
              style={{ backgroundColor: EMOTION_COLORS[e.emotion] || EMOTION_COLORS.neutral }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export default EmotionProbabilityBars;
