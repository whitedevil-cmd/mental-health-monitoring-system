import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import AppLayout from '@/components/layout/AppLayout';
import type { ConversationTurnView } from '@/components/voice/ConversationPanel';
import { useAuth } from '@/contexts/AuthContext';
import { lazyWithPreload } from '@/lib/lazyWithPreload';
import { createRealtimeVoiceClients } from '@/lib/realtimeVoiceClients';
import {
  createVoiceAudioLoop,
  type AssistantResponseState,
  type AssistantTurn,
  type RealTimeVoiceAssistantLoop,
} from '@/lib/voiceConversationLoop';

const VoiceRecorder = lazyWithPreload(() => import('@/components/voice/VoiceRecorder'));
const ConversationPanel = lazyWithPreload(() => import('@/components/voice/ConversationPanel'));

const BASE_MERGE_DELAY_MS = 650;
const FAST_MERGE_DELAY_MS = 220;
const SHORT_MERGE_DELAY_MS = 320;
const MEDIUM_MERGE_DELAY_MS = 475;
const LONG_MERGE_DELAY_MS = 900;
const MIN_ANALYSIS_WORDS = 2;
const SHORT_FILLER_PATTERN = /^(ok(?:ay)?|hmm+|hm+|mm+|uh+|um+|yeah|yes|no|fine)$/i;
const SENTENCE_END_PATTERN = /[.!?]["')\]]?$/;
const WEAK_BREAK_PATTERN = /[,;:]\s*$/;
const CONTINUATION_CUE_PATTERN =
  /\b(?:and|but|or|because|so|if|when|while|though|although|that|which|who|whom|whose|to|of|for|with|at|from|into|on|in|about|like|as|than)\s*$/i;
const CORRECTION_LEAD_PATTERN = /^(?:i mean|sorry|actually|rather|or maybe|no,? wait)\b/i;

type FinalSegmentEvent = {
  id: string;
  transcript: string;
  speechFinal: boolean;
};

type PendingUtterance = {
  segmentIds: string[];
  parts: string[];
  lastUpdatedAt: number;
};

type SegmentationDecision =
  | { action: 'flush-now' }
  | { action: 'delay'; delayMs: number };

const normalizeText = (value: string): string => value.replace(/\s+/g, ' ').trim();
const countWords = (value: string): number => normalizeText(value).split(' ').filter(Boolean).length;
const countSentenceTerminators = (value: string): number => (normalizeText(value).match(/[.!?]/g) ?? []).length;
const isFillerFragment = (value: string): boolean => SHORT_FILLER_PATTERN.test(normalizeText(value));
const endsWithStrongSentence = (value: string): boolean => SENTENCE_END_PATTERN.test(normalizeText(value));
const endsWithWeakBreak = (value: string): boolean => WEAK_BREAK_PATTERN.test(normalizeText(value));
const endsWithContinuationCue = (value: string): boolean => CONTINUATION_CUE_PATTERN.test(normalizeText(value));

const isAnalyzableUtterance = (transcript: string): boolean => {
  const normalized = normalizeText(transcript);
  if (!normalized) {
    return false;
  }

  if (SHORT_FILLER_PATTERN.test(normalized)) {
    return false;
  }

  const words = countWords(normalized);
  if (words >= MIN_ANALYSIS_WORDS) {
    return true;
  }

  return normalized.length >= 12 || SENTENCE_END_PATTERN.test(normalized);
};

const getSegmentationDecision = (
  segmentText: string,
  bufferedText: string,
  speechFinal: boolean,
): SegmentationDecision => {
  const normalizedSegment = normalizeText(segmentText);
  const normalizedBuffered = normalizeText(bufferedText);
  const segmentWordCount = countWords(normalizedSegment);
  const bufferedWordCount = countWords(normalizedBuffered);
  const terminatorCount = countSentenceTerminators(normalizedBuffered);
  const strongSentenceEnd =
    endsWithStrongSentence(normalizedSegment) || endsWithStrongSentence(normalizedBuffered);
  const weakBreak = endsWithWeakBreak(normalizedSegment) || endsWithWeakBreak(normalizedBuffered);
  const continuationCue = endsWithContinuationCue(normalizedBuffered);
  const correctionLead = CORRECTION_LEAD_PATTERN.test(normalizedSegment);

  if (correctionLead) {
    return { action: 'delay', delayMs: SHORT_MERGE_DELAY_MS };
  }

  if (strongSentenceEnd && bufferedWordCount >= 3 && !continuationCue) {
    return { action: 'flush-now' };
  }

  if (terminatorCount >= 2 && bufferedWordCount >= 6) {
    return { action: 'flush-now' };
  }

  if (speechFinal) {
    if (continuationCue || bufferedWordCount <= 3 || segmentWordCount <= 2) {
      return { action: 'delay', delayMs: LONG_MERGE_DELAY_MS };
    }

    if (weakBreak) {
      return { action: 'delay', delayMs: MEDIUM_MERGE_DELAY_MS };
    }

    return { action: 'delay', delayMs: FAST_MERGE_DELAY_MS };
  }

  if (weakBreak || continuationCue) {
    return { action: 'delay', delayMs: LONG_MERGE_DELAY_MS };
  }

  if (bufferedWordCount >= 10 || segmentWordCount >= 6) {
    return { action: 'delay', delayMs: SHORT_MERGE_DELAY_MS };
  }

  if (bufferedWordCount >= 5 || segmentWordCount >= 3) {
    return { action: 'delay', delayMs: MEDIUM_MERGE_DELAY_MS };
  }

  return { action: 'delay', delayMs: BASE_MERGE_DELAY_MS };
};

const mapTurns = (turns: AssistantTurn[]): ConversationTurnView[] =>
  turns.map((turn) => ({
    id: turn.id,
    role: turn.role,
    transcript: turn.text,
    emotion: turn.emotion,
    confidence: turn.confidence,
    status: turn.status,
  }));

const Voice = () => {
  const { user } = useAuth();
  const { emotionClient, llmClient, ttsClient } = useMemo(
    () => createRealtimeVoiceClients(user?.id),
    [user?.id],
  );
  const [loopTurns, setLoopTurns] = useState<ConversationTurnView[]>([]);
  const [partialTranscript, setPartialTranscript] = useState('');
  const [pendingPreview, setPendingPreview] = useState('');
  const [assistantDraft, setAssistantDraft] = useState('');
  const [assistantState, setAssistantState] = useState<AssistantResponseState>('idle');
  const [interruptedTurn, setInterruptedTurn] = useState<ConversationTurnView | null>(null);

  const loopRef = useRef<RealTimeVoiceAssistantLoop | null>(null);
  const sessionIdRef = useRef(crypto.randomUUID());
  const pendingUtteranceRef = useRef<PendingUtterance | null>(null);
  const flushTimerRef = useRef<number | null>(null);
  const processedSegmentIdsRef = useRef<Set<string>>(new Set());
  const processedUtteranceKeysRef = useRef<Set<string>>(new Set());
  const committedTranscriptRef = useRef('');
  const latestPartialTranscriptRef = useRef('');

  const turns = useMemo(() => {
    if (!interruptedTurn) {
      return loopTurns;
    }

    const interruptedTranscript = normalizeText(interruptedTurn.transcript);
    const recovered = loopTurns.some(
      (turn) =>
        turn.role === 'user' &&
        normalizeText(turn.transcript).startsWith(interruptedTranscript),
    );

    if (recovered) {
      return loopTurns;
    }

    return [interruptedTurn, ...loopTurns];
  }, [interruptedTurn, loopTurns]);

  useEffect(() => {
    void VoiceRecorder.preload();
    void ConversationPanel.preload();
  }, []);

  useEffect(() => {
    loopRef.current = createVoiceAudioLoop({
      sessionId: sessionIdRef.current,
      userId: user?.id,
      emotionClient,
      llmClient,
      ttsClient,
      callbacks: {
        onTurnsChanged: (nextTurns) => {
          setLoopTurns(mapTurns(nextTurns));
        },
        onAssistantStateChanged: (state) => {
          setAssistantState(state);
          if (state === 'idle') {
            setAssistantDraft('');
          }
        },
        onAssistantTextStreaming: (text) => {
          setAssistantDraft(text);
        },
        onAssistantTextReady: (text) => {
          setAssistantDraft(text);
        },
        onAssistantSpeechStarted: () => undefined,
        onAssistantSpeechEnded: () => undefined,
        onError: (message) => {
          console.error(message);
        },
      },
    });

    return () => {
      loopRef.current = null;
    };
  }, [emotionClient, llmClient, ttsClient, user?.id]);

  useEffect(() => {
    if (!interruptedTurn) {
      return;
    }

    const interruptedTranscript = normalizeText(interruptedTurn.transcript);
    const recovered = loopTurns.some(
      (turn) =>
        turn.role === 'user' &&
        normalizeText(turn.transcript).startsWith(interruptedTranscript),
    );

    if (recovered) {
      setInterruptedTurn(null);
    }
  }, [interruptedTurn, loopTurns]);

  const clearFlushTimer = useCallback(() => {
    if (flushTimerRef.current !== null) {
      window.clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
  }, []);

  const flushPendingUtterance = useCallback(async () => {
    clearFlushTimer();

    const pending = pendingUtteranceRef.current;
    if (!pending || pending.parts.length === 0) {
      return;
    }

    const transcript = normalizeText(pending.parts.join(' '));
    pendingUtteranceRef.current = null;
    setPendingPreview('');

    if (!transcript || !isAnalyzableUtterance(transcript)) {
      setPartialTranscript('');
      return;
    }

    const utteranceId = pending.segmentIds[pending.segmentIds.length - 1];
    const dedupeKey = transcript.toLowerCase();
    if (processedUtteranceKeysRef.current.has(dedupeKey)) {
      setPartialTranscript('');
      return;
    }

    if (
      interruptedTurn &&
      normalizeText(transcript).startsWith(normalizeText(interruptedTurn.transcript))
    ) {
      setInterruptedTurn(null);
    }

    processedUtteranceKeysRef.current.add(dedupeKey);
    committedTranscriptRef.current = [committedTranscriptRef.current, transcript].filter(Boolean).join(' ').trim();
    setPartialTranscript('');

    await loopRef.current?.handleFinalizedUtterance({
      id: utteranceId,
      text: transcript,
      timestamp: new Date().toISOString(),
    });
  }, [clearFlushTimer, interruptedTurn]);

  const scheduleFlush = useCallback((delayMs: number) => {
    clearFlushTimer();
    flushTimerRef.current = window.setTimeout(() => {
      void flushPendingUtterance();
    }, delayMs);
  }, [clearFlushTimer, flushPendingUtterance]);

  const handleTranscriptChange = useCallback((nextTranscript: string) => {
    const normalized = normalizeText(nextTranscript);
    if (!normalized) {
      latestPartialTranscriptRef.current = '';
      setPartialTranscript('');
      return;
    }

    const committed = committedTranscriptRef.current;
    const nextPartial = committed && normalized.startsWith(committed)
      ? normalized.slice(committed.length).trim()
      : normalized;

    const hadPartial = Boolean(latestPartialTranscriptRef.current);
    latestPartialTranscriptRef.current = nextPartial;
    setPartialTranscript(nextPartial);

    if (!hadPartial && nextPartial) {
      if (assistantState === 'speaking') {
        setAssistantDraft('');
      }
      loopRef.current?.handleUserSpeechStart();
    }
  }, [assistantState]);

  const handleFinalTranscript = useCallback((segment: FinalSegmentEvent) => {
    const transcript = normalizeText(segment.transcript);
    if (!transcript || processedSegmentIdsRef.current.has(segment.id)) {
      return;
    }

    processedSegmentIdsRef.current.add(segment.id);

    if (isFillerFragment(transcript) && !pendingUtteranceRef.current?.parts.length) {
      setPartialTranscript('');
      return;
    }

    const pending = pendingUtteranceRef.current ?? {
      segmentIds: [],
      parts: [],
      lastUpdatedAt: Date.now(),
    };

    if (!isFillerFragment(transcript) && pending.parts.every((part) => isFillerFragment(part))) {
      pending.parts = [];
      pending.segmentIds = [];
    }

    pending.segmentIds.push(segment.id);
    pending.parts.push(transcript);
    pending.lastUpdatedAt = Date.now();
    pendingUtteranceRef.current = pending;

    const bufferedTranscript = normalizeText(pending.parts.join(' '));
    setPendingPreview(bufferedTranscript);

    const decision = getSegmentationDecision(transcript, bufferedTranscript, segment.speechFinal);
    if (decision.action === 'flush-now') {
      void flushPendingUtterance();
      return;
    }

    scheduleFlush(decision.delayMs);
  }, [flushPendingUtterance, scheduleFlush]);

  const handleUtteranceEnd = useCallback(() => {
    void flushPendingUtterance();
  }, [flushPendingUtterance]);

  const handleStreamInterrupted = useCallback((payload: { transcript: string }) => {
    clearFlushTimer();
    pendingUtteranceRef.current = null;
    latestPartialTranscriptRef.current = '';
    setPendingPreview('');
    setPartialTranscript('');
    const transcript = normalizeText(payload.transcript || latestPartialTranscriptRef.current);
    if (!transcript) {
      return;
    }

    setInterruptedTurn({
      id: `interrupted-${Date.now()}`,
      role: 'user',
      transcript,
      emotion: 'stream interrupted',
      confidence: null,
      status: 'interrupted',
    });
  }, [clearFlushTimer]);

  useEffect(() => {
    return () => {
      clearFlushTimer();
    };
  }, [clearFlushTimer]);

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-foreground">Voice Session</h1>
          <p className="mt-2 text-muted-foreground">
            Real-time voice conversation with streaming transcript, emotion-aware responses, and interruption support.
          </p>
        </motion.div>

        <div className="mb-10 flex flex-col items-center">
          <Suspense fallback={null}>
            <VoiceRecorder
              onTranscriptChange={handleTranscriptChange}
              onFinalTranscript={handleFinalTranscript}
              onUtteranceEnd={handleUtteranceEnd}
              onStreamInterrupted={handleStreamInterrupted}
            />
          </Suspense>
        </div>

        <Suspense fallback={null}>
          <ConversationPanel
            turns={turns}
            partialTranscript={pendingPreview || partialTranscript}
            assistantDraft={assistantDraft}
            assistantState={assistantState}
          />
        </Suspense>
      </div>
    </AppLayout>
  );
};

export default Voice;
