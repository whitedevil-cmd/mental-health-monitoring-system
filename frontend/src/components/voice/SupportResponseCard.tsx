import { motion, AnimatePresence } from 'framer-motion';
import { Heart } from 'lucide-react';

const SupportResponseCard = ({ response }: { response: string }) => {
  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-3">
        <Heart className="h-4 w-4 text-accent" />
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">SereneAI says</h3>
      </div>
      <AnimatePresence mode="wait">
        {response ? (
          <motion.p
            key={response}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-foreground leading-relaxed"
          >
            {response}
          </motion.p>
        ) : (
          <p className="text-muted-foreground italic">I'm here whenever you're ready to talk…</p>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SupportResponseCard;
