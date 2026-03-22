import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import AppLayout from '@/components/layout/AppLayout';
import type { ConversationUtterance } from '@/components/voice/ConversationPanel';
import { apiClient } from '@/lib/apiClient';
import { lazyWithPreload } from '@/lib/lazyWithPreload';

const VoiceRecorder = lazyWithPreload(() => import('@/components/voice/VoiceRecorder'));
const ConversationPanel = lazyWithPreload(() => import('@/components/voice/ConversationPanel'));

const BASE_ANALYSIS_DEBOUNCE_MS = 650;
const FAST_ANALYSIS_DEBOUNCE_MS = 220;
const SHORT_ANALYSIS_DEBOUNCE_MS = 320;
const MEDIUM_ANALYSIS_DEBOUNCE_MS = 475;
const LONG_ANALYSIS_DEBOUNCE_MS = 900;
const ANALYSIS_REQUEST_TIMEOUT_MS = 8_000;
const MIN_ANALYSIS_WORDS = 2;
const SHORT_FILLER_PATTERN = /^(ok(?:ay)?|hmm+|hm+|mm+|uh+|um+|yeah|yes|no|fine)$/i;
const SENTENCE_END_PATTERN = /[.!?]["')\]]?$/;
const WEAK_BREAK_PATTERN = /[,;:]\s*$/;
const CONTINUATION_CUE_PATTERN = /\b(?:and|but|or|because|so|if|when|while|though|although|that|which|who|whom|whose|to|of|for|with|at|from|into|on|in|about|like|as|than)\s*$/i;
const CORRECTION_LEAD_PATTERN = /^(?:i mean|sorry|actually|rather|or maybe|no,? wait)\b/i;

type FinalSegmentEvent = {
  id: string;
  transcript: string;
  speechFinal: boolean;
};

type QueuedUtterance = {
  id: string;
  transcript: string;
  requestToken: number;
  sessionId: number;
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
const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error('Emotion analysis timed out.'));
    }, timeoutMs);

    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
};

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
  const strongSentenceEnd = endsWithStrongSentence(normalizedSegment) || endsWithStrongSentence(normalizedBuffered);
  const weakBreak = endsWithWeakBreak(normalizedSegment) || endsWithWeakBreak(normalizedBuffered);
  const continuationCue = endsWithContinuationCue(normalizedBuffered);
  const correctionLead = CORRECTION_LEAD_PATTERN.test(normalizedSegment);

  if (correctionLead) {
    return { action: 'delay', delayMs: SHORT_ANALYSIS_DEBOUNCE_MS };
  }

  if (strongSentenceEnd && bufferedWordCount >= 3 && !continuationCue) {
    return { action: 'flush-now' };
  }

  if (terminatorCount >= 2 && bufferedWordCount >= 6) {
    return { action: 'flush-now' };
  }

  if (speechFinal) {
    if (continuationCue || bufferedWordCount <= 3 || segmentWordCount <= 2) {
      return { action: 'delay', delayMs: LONG_ANALYSIS_DEBOUNCE_MS };
    }

    if (weakBreak) {
      return { action: 'delay', delayMs: MEDIUM_ANALYSIS_DEBOUNCE_MS };
    }

    return { action: 'delay', delayMs: FAST_ANALYSIS_DEBOUNCE_MS };
  }

  if (weakBreak || continuationCue) {
    return { action: 'delay', delayMs: LONG_ANALYSIS_DEBOUNCE_MS };
  }

  if (bufferedWordCount >= 10 || segmentWordCount >= 6) {
    return { action: 'delay', delayMs: SHORT_ANALYSIS_DEBOUNCE_MS };
  }

  if (bufferedWordCount >= 5 || segmentWordCount >= 3) {
    return { action: 'delay', delayMs: MEDIUM_ANALYSIS_DEBOUNCE_MS };
  }

  return { action: 'delay', delayMs: BASE_ANALYSIS_DEBOUNCE_MS };
};

const Voice = () => {
  const [utterances, setUtterances] = useState<ConversationUtterance[]>([]);
  const [partialTranscript, setPartialTranscript] = useState('');
  const [pendingPreview, setPendingPreview] = useState('');

  const committedTranscriptRef = useRef('');
  const pendingUtteranceRef = useRef<PendingUtterance | null>(null);
  const flushTimerRef = useRef<number | null>(null);
  const sessionEpochRef = useRef(0);
  const analysisRequestTokenRef = useRef(0);
  const processedSegmentIdsRef = useRef<Set<string>>(new Set());
  const processedUtteranceKeysRef = useRef<Set<string>>(new Set());
  const pendingAnalysisIdsRef = useRef<Set<string>>(new Set());
  const utteranceRequestTokensRef = useRef<Map<string, number>>(new Map());
  const analysisQueueRef = useRef<QueuedUtterance[]>([]);
  const isAnalyzingRef = useRef(false);

  const visiblePartialTranscript = useMemo(
    () => (pendingPreview ? '' : partialTranscript),
    [partialTranscript, pendingPreview],
  );

  const appendUtterance = useCallback((utterance: ConversationUtterance) => {
    setUtterances((current) => [...current, utterance]);
  }, []);

  const upsertRecoveredUtterance = useCallback((nextUtterance: ConversationUtterance) => {
    setUtterances((current) => {
      const recoveredIndex = current.findIndex(
        (utterance) =>
          utterance.status === 'interrupted' &&
          normalizeText(nextUtterance.transcript).startsWith(normalizeText(utterance.transcript)),
      );

      if (recoveredIndex === -1) {
        return [...current, nextUtterance];
      }

      const updated = [...current];
      updated[recoveredIndex] = nextUtterance;
      return updated;
    });
  }, []);

  const updateUtterance = useCallback((id: string, updater: (utterance: ConversationUtterance) => ConversationUtterance) => {
    setUtterances((current) => current.map((utterance) => (utterance.id === id ? updater(utterance) : utterance)));
  }, []);

  const clearFlushTimer = useCallback(() => {
    if (flushTimerRef.current !== null) {
      window.clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
  }, []);

  const buildAnalysisKey = useCallback((sessionId: number, utteranceId: string) => {
    return `${sessionId}:${utteranceId}`;
  }, []);

  const isCurrentAnalysisTarget = useCallback((utteranceId: string, sessionId: number, requestToken: number) => {
    return (
      sessionEpochRef.current === sessionId &&
      utteranceRequestTokensRef.current.get(utteranceId) === requestToken
    );
  }, []);

  const drainAnalysisQueue = useCallback(async () => {
    if (isAnalyzingRef.current) {
      return;
    }

    isAnalyzingRef.current = true;
    try {
      while (analysisQueueRef.current.length > 0) {
        const next = analysisQueueRef.current.shift();
        if (!next) {
          continue;
        }

        try {
          const analysis = await withTimeout(
            apiClient.analyzeText(next.transcript),
            ANALYSIS_REQUEST_TIMEOUT_MS,
          );
          if (!isCurrentAnalysisTarget(next.id, next.sessionId, next.requestToken)) {
            continue;
          }

          updateUtterance(next.id, (utterance) => ({
            ...utterance,
            emotion: analysis.emotion,
            confidence: analysis.confidence,
            status: 'resolved',
          }));
        } catch (error) {
          console.error('Emotion analysis failed:', error);
          if (!isCurrentAnalysisTarget(next.id, next.sessionId, next.requestToken)) {
            continue;
          }

          updateUtterance(next.id, (utterance) => ({
            ...utterance,
            emotion: 'emotion unavailable',
            confidence: null,
            status: 'failed',
          }));
        } finally {
          if (isCurrentAnalysisTarget(next.id, next.sessionId, next.requestToken)) {
            pendingAnalysisIdsRef.current.delete(buildAnalysisKey(next.sessionId, next.id));
            utteranceRequestTokensRef.current.delete(next.id);
          }
        }
      }
    } finally {
      isAnalyzingRef.current = false;
    }
  }, [buildAnalysisKey, isCurrentAnalysisTarget, updateUtterance]);

  const enqueueAnalysis = useCallback((id: string, transcript: string) => {
    const sessionId = sessionEpochRef.current;
    const analysisKey = buildAnalysisKey(sessionId, id);
    if (pendingAnalysisIdsRef.current.has(analysisKey)) {
      return;
    }

    const requestToken = analysisRequestTokenRef.current + 1;
    analysisRequestTokenRef.current = requestToken;
    pendingAnalysisIdsRef.current.add(analysisKey);
    utteranceRequestTokensRef.current.set(id, requestToken);
    analysisQueueRef.current.push({ id, transcript, requestToken, sessionId });
    void drainAnalysisQueue();
  }, [buildAnalysisKey, drainAnalysisQueue]);

  const flushPendingUtterance = useCallback(() => {
    clearFlushTimer();

    const pending = pendingUtteranceRef.current;
    if (!pending || pending.parts.length === 0) {
      return;
    }

    const transcript = normalizeText(pending.parts.join(' '));
    pendingUtteranceRef.current = null;
    setPendingPreview('');

    if (!transcript) {
      return;
    }

    const utteranceId = pending.segmentIds[pending.segmentIds.length - 1];
    const dedupeKey = transcript.toLowerCase();
    if (processedUtteranceKeysRef.current.has(dedupeKey)) {
      return;
    }

    processedUtteranceKeysRef.current.add(dedupeKey);
    committedTranscriptRef.current = [committedTranscriptRef.current, transcript].filter(Boolean).join(' ').trim();
    setPartialTranscript('');

    if (!isAnalyzableUtterance(transcript)) {
      upsertRecoveredUtterance({
        id: utteranceId,
        transcript,
        emotion: 'too short to analyze',
        confidence: null,
        status: 'skipped',
      });
      return;
    }

    upsertRecoveredUtterance({
      id: utteranceId,
      transcript,
      emotion: null,
      confidence: null,
      status: 'pending',
    });
    enqueueAnalysis(utteranceId, transcript);
  }, [clearFlushTimer, enqueueAnalysis, upsertRecoveredUtterance]);

  const scheduleFlush = useCallback((delayMs: number) => {
    const sessionId = sessionEpochRef.current;
    clearFlushTimer();
    flushTimerRef.current = window.setTimeout(() => {
      if (sessionId !== sessionEpochRef.current) {
        return;
      }

      flushPendingUtterance();
    }, delayMs);
  }, [clearFlushTimer, flushPendingUtterance]);

  const resetSession = useCallback(() => {
    sessionEpochRef.current += 1;
    clearFlushTimer();
    pendingUtteranceRef.current = null;
    committedTranscriptRef.current = '';
    processedSegmentIdsRef.current = new Set();
    processedUtteranceKeysRef.current = new Set();
    pendingAnalysisIdsRef.current = new Set();
    utteranceRequestTokensRef.current = new Map();
    analysisQueueRef.current = [];
    isAnalyzingRef.current = false;
    setPartialTranscript('');
    setPendingPreview('');
    setUtterances([]);
  }, [clearFlushTimer]);

  const handleTranscriptChange = useCallback((nextTranscript: string) => {
    const normalized = normalizeText(nextTranscript);
    if (!normalized) {
      resetSession();
      return;
    }

    const committed = committedTranscriptRef.current;
    if (!committed) {
      setPartialTranscript(normalized);
      return;
    }

    if (!normalized.startsWith(committed)) {
      setPartialTranscript(normalized);
      return;
    }

    setPartialTranscript(normalized.slice(committed.length).trim());
  }, [resetSession]);

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
      flushPendingUtterance();
      return;
    }

    scheduleFlush(decision.delayMs);
  }, [flushPendingUtterance, scheduleFlush]);

  const handleUtteranceEnd = useCallback(() => {
    flushPendingUtterance();
  }, [flushPendingUtterance]);

  const handleStreamInterrupted = useCallback((payload: { transcript: string }) => {
    clearFlushTimer();

    if (pendingUtteranceRef.current?.parts.length) {
      flushPendingUtterance();
      return;
    }

    const interruptedTranscript = normalizeText(payload.transcript || partialTranscript);
    if (!interruptedTranscript) {
      setPendingPreview('');
      setPartialTranscript('');
      return;
    }

    const interruptedKey = `interrupted:${interruptedTranscript.toLowerCase()}`;
    if (processedUtteranceKeysRef.current.has(interruptedKey)) {
      setPendingPreview('');
      setPartialTranscript('');
      return;
    }

    processedUtteranceKeysRef.current.add(interruptedKey);
    appendUtterance({
      id: `interrupted-${Date.now()}`,
      transcript: interruptedTranscript,
      emotion: 'stream interrupted',
      confidence: null,
      status: 'interrupted',
    });
    setPendingPreview('');
    setPartialTranscript('');
  }, [appendUtterance, clearFlushTimer, flushPendingUtterance, partialTranscript]);

  useEffect(() => {
    void VoiceRecorder.preload();
    void ConversationPanel.preload();
  }, []);

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
            Speak freely - final transcript chunks are grouped into utterances before emotion analysis.
          </p>
        </motion.div>

        <div className="mb-10 flex flex-col items-center">
          <Suspense
            fallback={
              <div className="flex flex-col items-center gap-4">
                <div className="h-28 w-28 animate-pulse rounded-full bg-primary/10" />
                <p className="text-sm text-muted-foreground">Loading voice tools...</p>
              </div>
            }
          >
            <VoiceRecorder
              onTranscriptChange={handleTranscriptChange}
              onFinalTranscript={handleFinalTranscript}
              onUtteranceEnd={handleUtteranceEnd}
              onStreamInterrupted={handleStreamInterrupted}
            />
          </Suspense>
        </div>

        <Suspense
          fallback={
            <div className="glass-card min-h-[240px] rounded-2xl p-6">
              <p className="text-muted-foreground italic">Loading conversation tools...</p>
            </div>
          }
        >
          <ConversationPanel utterances={utterances} partialTranscript={visiblePartialTranscript || pendingPreview} />
        </Suspense>
      </div>
    </AppLayout>
  );
};

export default Voice;
