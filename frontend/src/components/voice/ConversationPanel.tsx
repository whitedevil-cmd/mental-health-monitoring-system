import { AnimatePresence, motion } from 'framer-motion';

export interface ConversationTurnView {
  id: string;
  role: 'user' | 'assistant';
  transcript: string;
  emotion: string | null;
  confidence: number | null;
  status: 'pending' | 'resolved' | 'failed' | 'skipped' | 'interrupted';
}

interface ConversationPanelProps {
  turns: ConversationTurnView[];
  partialTranscript: string;
  assistantDraft: string;
  assistantState: 'idle' | 'thinking' | 'speaking';
}

const formatConfidence = (confidence: number | null): string => {
  if (confidence === null) {
    return '--';
  }
  return `${Math.round(confidence * 100)}%`;
};

const ConversationPanel = ({
  turns,
  partialTranscript,
  assistantDraft,
  assistantState,
}: ConversationPanelProps) => {
  return (
    <div className="glass-card min-h-[280px] rounded-2xl p-6">
      <div className="mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Live Conversation
        </h3>
      </div>

      {turns.length === 0 && !partialTranscript && !assistantDraft ? (
        <p className="italic text-muted-foreground">Start speaking to begin the conversation.</p>
      ) : (
        <div className="space-y-4">
          <AnimatePresence initial={false}>
            {turns.map((turn) => (
              <motion.div
                key={turn.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className={`rounded-2xl border p-4 ${
                  turn.role === 'assistant'
                    ? 'border-primary/20 bg-primary/5'
                    : 'border-border/70 bg-background/50'
                }`}
              >
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                  <span className={turn.role === 'assistant' ? 'text-primary' : 'text-muted-foreground'}>
                    {turn.role === 'assistant' ? 'Assistant' : 'You'}
                  </span>
                </div>
                <p className="leading-relaxed text-foreground">{turn.transcript}</p>

                {turn.role === 'user' ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                    <span className="rounded-full bg-secondary px-3 py-1 text-foreground">
                      {turn.status === 'failed'
                        ? 'Emotion unavailable'
                        : turn.status === 'interrupted'
                          ? 'Stream interrupted'
                          : turn.status === 'skipped'
                            ? 'Too short to analyze'
                            : turn.status === 'pending'
                              ? 'Analyzing emotion...'
                              : turn.emotion}
                    </span>
                    <span className="text-muted-foreground">
                      Confidence: {turn.status === 'resolved' ? formatConfidence(turn.confidence) : '--'}
                    </span>
                  </div>
                ) : null}
              </motion.div>
            ))}
          </AnimatePresence>

          {assistantState !== 'idle' && assistantDraft ? (
            <motion.div
              key="assistant-draft"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-2xl border border-primary/20 bg-primary/5 p-4"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                {assistantState === 'thinking' ? 'Thinking' : 'Speaking'}
              </p>
              <p className="mt-2 leading-relaxed text-foreground">{assistantDraft}</p>
            </motion.div>
          ) : null}

          {partialTranscript ? (
            <motion.div
              key="partial-transcript"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-4"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Listening</p>
              <p className="mt-2 leading-relaxed text-foreground/90">{partialTranscript}</p>
            </motion.div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default ConversationPanel;
