import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import AppLayout from '@/components/layout/AppLayout';
import VoiceRecorder from '@/components/voice/VoiceRecorder';
import ConversationPanel, { ConversationUtterance } from '@/components/voice/ConversationPanel';
import { apiClient } from '@/lib/apiClient';

const BASE_ANALYSIS_DEBOUNCE_MS = 650;
const SHORT_ANALYSIS_DEBOUNCE_MS = 300;
const MEDIUM_ANALYSIS_DEBOUNCE_MS = 425;
const LONG_ANALYSIS_DEBOUNCE_MS = 650;
const MIN_ANALYSIS_WORDS = 2;
const SHORT_FILLER_PATTERN = /^(ok(?:ay)?|hmm+|hm+|mm+|uh+|um+|yeah|yes|no|fine)$/i;
const SENTENCE_END_PATTERN = /[.!?]$/;

type FinalSegmentEvent = {
  id: string;
  transcript: string;
  speechFinal: boolean;
};

type QueuedUtterance = {
  id: string;
  transcript: string;
};

type PendingUtterance = {
  segmentIds: string[];
  parts: string[];
  lastUpdatedAt: number;
};

const normalizeText = (value: string): string => value.replace(/\s+/g, ' ').trim();

const countWords = (value: string): number => normalizeText(value).split(' ').filter(Boolean).length;

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

const getAdaptiveMergeDelay = (segmentText: string, bufferedText: string): number => {
  const normalizedSegment = normalizeText(segmentText);
  const normalizedBuffered = normalizeText(bufferedText);
  const segmentWordCount = countWords(normalizedSegment);
  const bufferedWordCount = countWords(normalizedBuffered);

  if (SENTENCE_END_PATTERN.test(normalizedSegment)) {
    return 0;
  }

  if (bufferedWordCount >= 10 || segmentWordCount >= 5) {
    return SHORT_ANALYSIS_DEBOUNCE_MS;
  }

  if (bufferedWordCount >= 5 || segmentWordCount >= 3) {
    return MEDIUM_ANALYSIS_DEBOUNCE_MS;
  }

  return LONG_ANALYSIS_DEBOUNCE_MS;
};

const Voice = () => {
  const [utterances, setUtterances] = useState<ConversationUtterance[]>([]);
  const [partialTranscript, setPartialTranscript] = useState('');
  const [pendingPreview, setPendingPreview] = useState('');

  const committedTranscriptRef = useRef('');
  const pendingUtteranceRef = useRef<PendingUtterance | null>(null);
  const flushTimerRef = useRef<number | null>(null);
  const processedSegmentIdsRef = useRef<Set<string>>(new Set());
  const processedUtteranceKeysRef = useRef<Set<string>>(new Set());
  const pendingAnalysisIdsRef = useRef<Set<string>>(new Set());
  const analysisQueueRef = useRef<QueuedUtterance[]>([]);
  const isAnalyzingRef = useRef(false);

  const visiblePartialTranscript = useMemo(
    () => (pendingPreview ? '' : partialTranscript),
    [partialTranscript, pendingPreview],
  );

  const appendUtterance = useCallback((utterance: ConversationUtterance) => {
    setUtterances((current) => [...current, utterance]);
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
          const analysis = await apiClient.analyzeText(next.transcript);
          updateUtterance(next.id, (utterance) => ({
            ...utterance,
            emotion: analysis.emotion,
            confidence: analysis.confidence,
            status: 'resolved',
          }));
        } catch (error) {
          console.error('Emotion analysis failed:', error);
          updateUtterance(next.id, (utterance) => ({
            ...utterance,
            emotion: 'emotion unavailable',
            confidence: null,
            status: 'failed',
          }));
        } finally {
          pendingAnalysisIdsRef.current.delete(next.id);
        }
      }
    } finally {
      isAnalyzingRef.current = false;
    }
  }, [updateUtterance]);

  const enqueueAnalysis = useCallback((id: string, transcript: string) => {
    if (pendingAnalysisIdsRef.current.has(id)) {
      return;
    }

    pendingAnalysisIdsRef.current.add(id);
    analysisQueueRef.current.push({ id, transcript });
    void drainAnalysisQueue();
  }, [drainAnalysisQueue]);

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
      appendUtterance({
        id: utteranceId,
        transcript,
        emotion: 'too short to analyze',
        confidence: null,
        status: 'skipped',
      });
      return;
    }

    appendUtterance({
      id: utteranceId,
      transcript,
      emotion: null,
      confidence: null,
      status: 'pending',
    });
    enqueueAnalysis(utteranceId, transcript);
  }, [appendUtterance, clearFlushTimer, enqueueAnalysis]);

  const scheduleFlush = useCallback((delayMs: number) => {
    clearFlushTimer();
    flushTimerRef.current = window.setTimeout(() => {
      flushPendingUtterance();
    }, delayMs);
  }, [clearFlushTimer, flushPendingUtterance]);

  const resetSession = useCallback(() => {
    clearFlushTimer();
    pendingUtteranceRef.current = null;
    committedTranscriptRef.current = '';
    processedSegmentIdsRef.current = new Set();
    processedUtteranceKeysRef.current = new Set();
    pendingAnalysisIdsRef.current = new Set();
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

    const pending = pendingUtteranceRef.current ?? {
      segmentIds: [],
      parts: [],
      lastUpdatedAt: Date.now(),
    };

    pending.segmentIds.push(segment.id);
    pending.parts.push(transcript);
    pending.lastUpdatedAt = Date.now();
    pendingUtteranceRef.current = pending;

    const bufferedTranscript = normalizeText(pending.parts.join(' '));
    setPendingPreview(bufferedTranscript);

    if (segment.speechFinal || SENTENCE_END_PATTERN.test(transcript)) {
      flushPendingUtterance();
      return;
    }

    const adaptiveDelay = getAdaptiveMergeDelay(transcript, bufferedTranscript);
    scheduleFlush(adaptiveDelay || BASE_ANALYSIS_DEBOUNCE_MS);
  }, [flushPendingUtterance, scheduleFlush]);

  const handleUtteranceEnd = useCallback(() => {
    flushPendingUtterance();
  }, [flushPendingUtterance]);

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
          <VoiceRecorder
            onTranscriptChange={handleTranscriptChange}
            onFinalTranscript={handleFinalTranscript}
            onUtteranceEnd={handleUtteranceEnd}
          />
        </div>

        <ConversationPanel utterances={utterances} partialTranscript={visiblePartialTranscript || pendingPreview} />
      </div>
    </AppLayout>
  );
};

export default Voice;
