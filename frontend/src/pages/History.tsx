import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Loader2, MessageSquare, MessageSquareText } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import {
  apiClient,
  type ConversationSessionDetailResponse,
  type ConversationSessionSummaryResponse,
} from '@/lib/apiClient';
import { EMOTION_COLORS } from '@/types';

type SessionSummary = {
  id: string;
  startedAt: string;
  updatedAt: string;
  dominantEmotion: string;
  preview: string;
  turnCount: number;
};

type SessionTurn = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  emotion: string | null;
  confidence: number | null;
};

type SessionDetail = SessionSummary & {
  turns: SessionTurn[];
};

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

const mapSummary = (entry: ConversationSessionSummaryResponse): SessionSummary => ({
  id: entry.id,
  startedAt: entry.started_at,
  updatedAt: entry.updated_at,
  dominantEmotion: entry.dominant_emotion || 'neutral',
  preview: entry.preview?.trim() || 'No messages captured for this session.',
  turnCount: entry.turn_count,
});

const mapDetail = (entry: ConversationSessionDetailResponse): SessionDetail => ({
  ...mapSummary(entry),
  turns: entry.turns.map((turn) => ({
    id: turn.id,
    role: turn.role,
    text: turn.text,
    timestamp: turn.timestamp,
    emotion: turn.emotion,
    confidence: turn.confidence,
  })),
});

const formatSessionDate = (value: string) =>
  new Date(value).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

const formatSessionTime = (value: string) =>
  new Date(value).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

const History = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId?: string }>();

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [activeSession, setActiveSession] = useState<SessionDetail | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadSessions = async () => {
      if (!user?.id) {
        if (mounted) {
          setSessions([]);
          setIsLoadingList(false);
        }
        return;
      }

      try {
        setIsLoadingList(true);
        setError(null);
        const entries = await apiClient.getConversationSessions(user.id);
        if (!mounted) {
          return;
        }
        setSessions(entries.map(mapSummary));
      } catch (err) {
        if (!mounted) {
          return;
        }
        console.error('Failed to load conversation sessions:', err);
        setError('Unable to load saved conversations right now. Please try again in a moment.');
      } finally {
        if (mounted) {
          setIsLoadingList(false);
        }
      }
    };

    void loadSessions();

    return () => {
      mounted = false;
    };
  }, [user?.id]);

  useEffect(() => {
    let mounted = true;

    const loadSessionDetail = async () => {
      if (!sessionId) {
        setActiveSession(null);
        return;
      }

      if (!user?.id) {
        if (mounted) {
          setActiveSession(null);
          setIsLoadingDetail(false);
        }
        return;
      }

      try {
        setIsLoadingDetail(true);
        setError(null);
        const entry = await apiClient.getConversationSession(user.id, sessionId);
        if (!mounted) {
          return;
        }
        setActiveSession(mapDetail(entry));
      } catch (err) {
        if (!mounted) {
          return;
        }
        console.error('Failed to load conversation detail:', err);
        setActiveSession(null);
        setError('Unable to open that conversation right now. Please try again.');
      } finally {
        if (mounted) {
          setIsLoadingDetail(false);
        }
      }
    };

    void loadSessionDetail();

    return () => {
      mounted = false;
    };
  }, [sessionId, user?.id]);

  const renderEmptyState = (
    <motion.div variants={item} className="glass-card rounded-2xl p-10 text-center text-muted-foreground">
      No saved conversations yet. Finish a voice session and it will appear here as one chat log.
    </motion.div>
  );

  const renderLoadingState = (
    <motion.div
      variants={item}
      className="glass-card rounded-2xl p-10 flex items-center justify-center gap-3 text-muted-foreground"
    >
      <Loader2 className="h-5 w-5 animate-spin" />
      <span>{sessionId ? 'Opening conversation...' : 'Loading saved conversations...'}</span>
    </motion.div>
  );

  return (
    <AppLayout>
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
        <motion.div variants={item} className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Conversation History</h1>
            <p className="mt-1 text-muted-foreground">
              {sessionId ? 'Open a saved session and read it like a chat.' : 'Each completed session is saved as one conversation log.'}
            </p>
          </div>
          {sessionId ? (
            <Button variant="outline" onClick={() => navigate('/history')} className="shrink-0">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Logs
            </Button>
          ) : null}
        </motion.div>

        {error ? (
          <motion.div variants={item} className="glass-card rounded-2xl p-6 border border-destructive/20 text-destructive">
            {error}
          </motion.div>
        ) : null}

        {sessionId ? (
          isLoadingDetail ? (
            renderLoadingState
          ) : activeSession ? (
            <motion.div variants={item} className="glass-card rounded-3xl p-4 md:p-6">
              <div className="border-b border-border/50 pb-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold capitalize"
                    style={{
                      color: EMOTION_COLORS[activeSession.dominantEmotion] || EMOTION_COLORS.neutral,
                      backgroundColor: `${EMOTION_COLORS[activeSession.dominantEmotion] || EMOTION_COLORS.neutral}20`,
                    }}
                  >
                    {activeSession.dominantEmotion}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {formatSessionDate(activeSession.startedAt)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {activeSession.turnCount} messages
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Started {formatSessionTime(activeSession.startedAt)} and last updated {formatSessionTime(activeSession.updatedAt)}.
                </p>
              </div>

              <div className="mt-6 space-y-4">
                {activeSession.turns.map((turn) => {
                  const isUser = turn.role === 'user';
                  return (
                    <div key={turn.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[85%] rounded-3xl px-4 py-3 shadow-sm md:max-w-[75%] ${
                          isUser
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-secondary/80 text-foreground'
                        }`}
                      >
                        <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide opacity-75">
                          <span>{isUser ? 'You' : 'Assistant'}</span>
                          <span>{formatSessionTime(turn.timestamp)}</span>
                          {isUser && turn.emotion ? (
                            <span className="capitalize">
                              {turn.emotion}
                              {turn.confidence !== null ? ` ${Math.round(turn.confidence * 100)}%` : ''}
                            </span>
                          ) : null}
                        </div>
                        <p className="whitespace-pre-wrap leading-relaxed">{turn.text}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          ) : (
            <motion.div variants={item} className="glass-card rounded-2xl p-10 text-center text-muted-foreground">
              This conversation could not be found. Go back to the history list and open another one.
            </motion.div>
          )
        ) : isLoadingList ? (
          renderLoadingState
        ) : sessions.length === 0 ? (
          renderEmptyState
        ) : (
          <div className="grid gap-3">
            {sessions.map((session) => (
              <motion.button
                key={session.id}
                variants={item}
                onClick={() => navigate(`/history/${encodeURIComponent(session.id)}`)}
                className="w-full rounded-2xl border border-border/50 bg-card/80 p-5 text-left transition hover:border-primary/30 hover:shadow-lg"
              >
                <div className="flex items-start gap-4">
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
                    style={{
                      backgroundColor: `${EMOTION_COLORS[session.dominantEmotion] || EMOTION_COLORS.neutral}20`,
                    }}
                  >
                    <MessageSquareText
                      className="h-5 w-5"
                      style={{ color: EMOTION_COLORS[session.dominantEmotion] || EMOTION_COLORS.neutral }}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-muted-foreground">{formatSessionDate(session.startedAt)}</span>
                      <span
                        className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium capitalize"
                        style={{ color: EMOTION_COLORS[session.dominantEmotion] || EMOTION_COLORS.neutral }}
                      >
                        {session.dominantEmotion}
                      </span>
                      <span className="text-xs text-muted-foreground">{session.turnCount} messages</span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-foreground">{session.preview}</p>
                  </div>
                  <MessageSquare className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </motion.div>
    </AppLayout>
  );
};

export default History;
