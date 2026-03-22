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
  const normalizedDraft = assistantDraft.trim();
  const latestTurn = turns[turns.length - 1];
  const latestAssistantTranscript =
    latestTurn?.role === 'assistant' ? latestTurn.transcript.trim() : '';
  const showAssistantDraft =
    assistantState !== 'idle' &&
    Boolean(normalizedDraft) &&
    !(
      latestTurn?.role === 'assistant' &&
      (latestAssistantTranscript === normalizedDraft ||
        latestAssistantTranscript.startsWith(normalizedDraft) ||
        normalizedDraft.startsWith(latestAssistantTranscript))
    );

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
          {assistantState !== 'idle' ? (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-primary/20 bg-primary/5 p-4"
            >
              <div className="flex items-center gap-4">
                <motion.div
                  animate={
                    assistantState === 'speaking'
                      ? { scale: [1, 1.08, 1], opacity: [0.8, 1, 0.8] }
                      : { scale: [1, 1.03, 1], opacity: [0.75, 0.95, 0.75] }
                  }
                  transition={{ duration: assistantState === 'speaking' ? 1.2 : 1.8, repeat: Infinity }}
                  className="relative flex h-12 w-12 items-center justify-center rounded-full bg-primary/12"
                >
                  <div className="h-5 w-5 rounded-full bg-primary" />
                </motion.div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">Emoiva</p>
                  <p className="text-sm text-muted-foreground">
                    {assistantState === 'thinking'
                      ? 'Thinking through a grounded response'
                      : 'Responding in real time'}
                  </p>
                </div>

                <div className="flex items-end gap-1">
                  {[0, 1, 2, 3, 4].map((index) => (
                    <motion.span
                      key={index}
                      className="w-1.5 rounded-full bg-primary/80"
                      animate={{
                        height:
                          assistantState === 'speaking'
                            ? [8, 18 + ((index + 1) % 3) * 8, 10]
                            : [8, 12 + (index % 2) * 4, 8],
                        opacity: assistantState === 'speaking' ? [0.45, 1, 0.55] : [0.35, 0.7, 0.35],
                      }}
                      transition={{
                        duration: assistantState === 'speaking' ? 0.7 : 1.2,
                        repeat: Infinity,
                        delay: index * 0.08,
                        ease: 'easeInOut',
                      }}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          ) : null}

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

          {showAssistantDraft ? (
            <motion.div
              key="assistant-draft"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-2xl border border-primary/20 bg-primary/5 p-4"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                Emoiva
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
