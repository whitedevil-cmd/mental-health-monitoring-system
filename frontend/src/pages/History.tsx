import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AppLayout from '@/components/layout/AppLayout';
import { MessageSquare, ChevronRight, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { EMOTION_COLORS } from '@/types';
import { apiClient, HistoryResponseItem } from '@/lib/apiClient';

type HistoryConversation = {
  id: string;
  date: string;
  dominant_emotion: string;
  transcript: string;
  confidence: number;
};

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

const mapHistoryItem = (entry: HistoryResponseItem): HistoryConversation => ({
  id: `${entry.timestamp}-${entry.emotion}`,
  date: entry.timestamp,
  dominant_emotion: entry.emotion,
  transcript: entry.transcript?.trim() || 'No transcript available for this session.',
  confidence: entry.confidence,
});

const History = () => {
  const { user } = useAuth();
  const [selected, setSelected] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryConversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadHistory = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const entries = await apiClient.getHistory(user?.id ?? undefined);
        if (!mounted) return;
        setHistory(entries.map(mapHistoryItem));
      } catch (err) {
        if (!mounted) return;
        console.error('Failed to load history:', err);
        setError('Unable to load conversation history. Confirm the backend is running on port 8001.');
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    void loadHistory();

    return () => {
      mounted = false;
    };
  }, [user?.id]);

  const activeConvo = history.find((c) => c.id === selected) || null;

  return (
    <AppLayout>
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
        <motion.div variants={item}>
          <h1 className="text-3xl font-bold text-foreground">Conversation History</h1>
          <p className="text-muted-foreground mt-1">Revisit your past conversations</p>
        </motion.div>

        {isLoading ? (
          <motion.div variants={item} className="glass-card rounded-2xl p-10 flex items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading past conversations...</span>
          </motion.div>
        ) : error ? (
          <motion.div variants={item} className="glass-card rounded-2xl p-6 border border-destructive/20 text-destructive">
            {error}
          </motion.div>
        ) : history.length === 0 ? (
          <motion.div variants={item} className="glass-card rounded-2xl p-10 text-center text-muted-foreground">
            No conversation history yet. Record a voice session and it will appear here.
          </motion.div>
        ) : (
          <div className="grid gap-3">
            {history.map((c) => (
              <motion.button
                key={c.id}
                variants={item}
                onClick={() => setSelected(c.id)}
                className="w-full glass-card rounded-2xl p-5 text-left hover:shadow-lg transition-shadow group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${EMOTION_COLORS[c.dominant_emotion] || EMOTION_COLORS.neutral}20` }}
                    >
                      <MessageSquare className="h-5 w-5" style={{ color: EMOTION_COLORS[c.dominant_emotion] || EMOTION_COLORS.neutral }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm text-muted-foreground">
                          {new Date(c.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </span>
                        <span
                          className="text-xs px-2 py-0.5 rounded-full bg-secondary capitalize font-medium"
                          style={{ color: EMOTION_COLORS[c.dominant_emotion] || EMOTION_COLORS.neutral }}
                        >
                          {c.dominant_emotion}
                        </span>
                      </div>
                      <p className="text-foreground truncate">{c.transcript}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 ml-2" />
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {activeConvo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setSelected(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="glass-card rounded-3xl p-6 md:p-8 max-w-2xl w-full max-h-[80vh] overflow-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {new Date(activeConvo.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span
                      className="text-xs px-2 py-0.5 rounded-full bg-secondary capitalize font-medium"
                      style={{ color: EMOTION_COLORS[activeConvo.dominant_emotion] || EMOTION_COLORS.neutral }}
                    >
                      {activeConvo.dominant_emotion}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {Math.round(activeConvo.confidence * 100)}% confidence
                    </span>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setSelected(null)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">What you said</h3>
                  <p className="text-foreground leading-relaxed whitespace-pre-wrap">{activeConvo.transcript}</p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Emotion Summary</h3>
                  <p className="text-foreground leading-relaxed capitalize">
                    Dominant emotion: {activeConvo.dominant_emotion} ({Math.round(activeConvo.confidence * 100)}% confidence)
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
};

export default History;
