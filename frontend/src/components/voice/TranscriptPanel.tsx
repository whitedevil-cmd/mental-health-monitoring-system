import { motion, AnimatePresence } from 'framer-motion';

const TranscriptPanel = ({ transcript }: { transcript: string }) => {
  return (
    <div className="glass-card rounded-2xl p-6 min-h-[120px]">
      <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">What you said</h3>
      <AnimatePresence mode="wait">
        {transcript ? (
          <motion.p
            key={transcript}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-foreground leading-relaxed"
          >
            {transcript}
          </motion.p>
        ) : (
          <p className="text-muted-foreground italic">Your words will appear here…</p>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TranscriptPanel;
