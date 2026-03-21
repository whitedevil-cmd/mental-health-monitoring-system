import { AnimatePresence, motion } from 'framer-motion';

export interface ConversationUtterance {
  id: string;
  transcript: string;
  emotion: string | null;
  confidence: number | null;
  status: 'pending' | 'resolved' | 'failed' | 'skipped';
}

interface ConversationPanelProps {
  utterances: ConversationUtterance[];
  partialTranscript: string;
}

const formatConfidence = (confidence: number | null): string => {
  if (confidence === null) {
    return '--';
  }
  return `${Math.round(confidence * 100)}%`;
};

const ConversationPanel = ({ utterances, partialTranscript }: ConversationPanelProps) => {
  return (
    <div className="glass-card rounded-2xl p-6 min-h-[240px]">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Live Conversation
        </h3>
      </div>

      {utterances.length === 0 && !partialTranscript ? (
        <p className="text-muted-foreground italic">Finalized transcript segments will appear here.</p>
      ) : (
        <div className="space-y-4">
          <AnimatePresence initial={false}>
            {utterances.map((utterance) => (
              <motion.div
                key={utterance.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="rounded-xl border border-border/70 bg-background/50 p-4"
              >
                <p className="text-foreground leading-relaxed">{utterance.transcript}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                  <span className="rounded-full bg-secondary px-3 py-1 text-foreground">
                    {utterance.status === 'failed'
                      ? 'Emotion unavailable'
                      : utterance.status === 'skipped'
                        ? 'Too short to analyze'
                      : utterance.status === 'pending'
                        ? 'Analyzing emotion...'
                        : utterance.emotion}
                  </span>
                  <span className="text-muted-foreground">
                    Confidence: {utterance.status === 'resolved' ? formatConfidence(utterance.confidence) : '--'}
                  </span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {partialTranscript ? (
            <motion.div
              key="partial-transcript"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Listening</p>
              <p className="mt-2 text-foreground/90 leading-relaxed">{partialTranscript}</p>
            </motion.div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default ConversationPanel;
