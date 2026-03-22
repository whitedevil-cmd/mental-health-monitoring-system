import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Square, Loader2 } from 'lucide-react';
import { EmotionScore } from '@/types';
import { toast } from '@/components/ui/use-toast';
import { DeepgramLiveClient } from '@/lib/deepgramLive';

interface VoiceRecorderProps {
  onResult?: (data: { transcript: string; emotions: EmotionScore[]; aiResponse: string }) => void;
  onTranscriptChange?: (transcript: string) => void;
  onFinalTranscript?: (segment: { id: string; transcript: string; speechFinal: boolean }) => void;
  onUtteranceEnd?: () => void;
  onStreamInterrupted?: (payload: { transcript: string }) => void;
}

type RecorderStatus = 'idle' | 'connecting' | 'recording' | 'processing';

const VoiceRecorder = ({
  onResult,
  onTranscriptChange,
  onFinalTranscript,
  onUtteranceEnd,
  onStreamInterrupted,
}: VoiceRecorderProps) => {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [duration, setDuration] = useState(0);
  const [analyzerData, setAnalyzerData] = useState<number[]>(new Array(32).fill(0));
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number>(0);
  const animFrameRef = useRef<number>(0);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const deepgramRef = useRef<DeepgramLiveClient | null>(null);
  const disconnectTimerRef = useRef<number | null>(null);
  const latestTranscriptRef = useRef('');
  const streamGenerationRef = useRef(0);

  const cleanupAudioGraph = useCallback(async () => {
    if (disconnectTimerRef.current) {
      window.clearTimeout(disconnectTimerRef.current);
      disconnectTimerRef.current = null;
    }

    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    analyzerRef.current?.disconnect();

    processorRef.current = null;
    sourceRef.current = null;
    analyzerRef.current = null;

    cancelAnimationFrame(animFrameRef.current);
    clearInterval(timerRef.current);

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (audioContextRef.current) {
      await audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }

    setAnalyzerData(new Array(32).fill(0));
    setDuration(0);
  }, []);

  const updateTranscript = useCallback((transcript: string) => {
    latestTranscriptRef.current = transcript;
    onTranscriptChange?.(transcript);
  }, [onTranscriptChange]);

  const isActiveStream = useCallback((generation: number) => {
    return streamGenerationRef.current === generation;
  }, []);

  const visualize = useCallback(() => {
    if (!analyzerRef.current) return;
    const data = new Uint8Array(analyzerRef.current.frequencyBinCount);
    analyzerRef.current.getByteFrequencyData(data);
    const slice = Array.from(data.slice(0, 32)).map((value) => value / 255);
    setAnalyzerData(slice);
    animFrameRef.current = requestAnimationFrame(visualize);
  }, []);

  const stopRecording = useCallback(async () => {
    if (status === 'idle') {
      return;
    }

    const activeGeneration = streamGenerationRef.current;
    setStatus('processing');
    clearInterval(timerRef.current);

    processorRef.current?.disconnect();
    processorRef.current = null;
    sourceRef.current?.disconnect();
    sourceRef.current = null;

    deepgramRef.current?.finalize();
    disconnectTimerRef.current = window.setTimeout(() => {
      if (isActiveStream(activeGeneration)) {
        deepgramRef.current?.disconnect();
      }
    }, 600);

    await new Promise((resolve) => window.setTimeout(resolve, 700));

    await cleanupAudioGraph();

    onResult?.({
      transcript: latestTranscriptRef.current,
      emotions: [],
      aiResponse: '',
    });

    setStatus('idle');
  }, [cleanupAudioGraph, isActiveStream, onResult, status]);

  const startRecording = useCallback(async () => {
    const generation = streamGenerationRef.current + 1;
    streamGenerationRef.current = generation;

    try {
      updateTranscript('');
      onResult?.({ transcript: '', emotions: [], aiResponse: '' });
      setStatus('connecting');

      deepgramRef.current?.disconnect();
      deepgramRef.current = null;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;

      const analyzer = audioContext.createAnalyser();
      analyzer.fftSize = 64;
      analyzerRef.current = analyzer;
      source.connect(analyzer);

      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      source.connect(processor);
      processor.connect(audioContext.destination);

      const deepgram = new DeepgramLiveClient({
        sampleRate: audioContext.sampleRate,
        onTranscript: (transcript) => {
          if (!isActiveStream(generation)) {
            return;
          }

          updateTranscript(transcript);
        },
        onFinalTranscript: (segment) => {
          if (!isActiveStream(generation)) {
            return;
          }

          onFinalTranscript?.(segment);
        },
        onUtteranceEnd: () => {
          if (!isActiveStream(generation)) {
            return;
          }

          onUtteranceEnd?.();
        },
        onOpen: () => {
          if (!isActiveStream(generation)) {
            deepgram.disconnect();
            return;
          }

          setStatus('recording');
        },
        onClose: ({ manual, wasConnected }) => {
          if (!isActiveStream(generation)) {
            return;
          }

          deepgramRef.current = null;
          if (!manual && wasConnected) {
            setStatus('idle');
            void cleanupAudioGraph();
            onStreamInterrupted?.({ transcript: latestTranscriptRef.current });
          }
        },
        onError: (message) => {
          if (!isActiveStream(generation)) {
            return;
          }

          console.error(message);
        },
      });
      deepgramRef.current = deepgram;

      await deepgram.connect();

      processor.onaudioprocess = (event) => {
        if (status === 'processing') {
          return;
        }

        const input = event.inputBuffer.getChannelData(0);
        deepgram.sendAudio(new Float32Array(input));
      };

      timerRef.current = window.setInterval(() => setDuration((value) => value + 1), 1000);
      visualize();
    } catch (err) {
      if (!isActiveStream(generation)) {
        return;
      }

      console.error('Microphone or Deepgram error:', err);
      deepgramRef.current?.disconnect();
      deepgramRef.current = null;
      await cleanupAudioGraph();
      setStatus('idle');
      toast({
        title: 'Live transcription failed',
        description: 'Check microphone access and Deepgram credentials, then try again.',
        variant: 'destructive',
      });
    }
  }, [
    cleanupAudioGraph,
    isActiveStream,
    onFinalTranscript,
    onResult,
    onStreamInterrupted,
    onUtteranceEnd,
    status,
    updateTranscript,
    visualize,
  ]);

  useEffect(() => {
    return () => {
      deepgramRef.current?.disconnect();
      void cleanupAudioGraph();
    };
  }, [cleanupAudioGraph]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') {
        return;
      }

      void audioContextRef.current?.resume?.().catch(() => undefined);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const formatTime = (seconds: number) =>
    `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative">
        {status === 'recording' && (
          <>
            <div className="absolute inset-0 -m-4 rounded-full border-2 border-primary/30 animate-pulse-ring" />
            <div
              className="absolute inset-0 -m-8 rounded-full border border-primary/15 animate-pulse-ring"
              style={{ animationDelay: '0.5s' }}
            />
          </>
        )}

        {status === 'recording' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg viewBox="0 0 200 200" className="absolute h-full w-full">
              {analyzerData.map((value, index) => {
                const angle = (index / analyzerData.length) * Math.PI * 2 - Math.PI / 2;
                const innerRadius = 55;
                const outerRadius = innerRadius + value * 30;
                const x1 = 100 + Math.cos(angle) * innerRadius;
                const y1 = 100 + Math.sin(angle) * innerRadius;
                const x2 = 100 + Math.cos(angle) * outerRadius;
                const y2 = 100 + Math.sin(angle) * outerRadius;

                return (
                  <line
                    key={index}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="hsl(var(--primary))"
                    strokeWidth="3"
                    strokeLinecap="round"
                    opacity={0.4 + value * 0.6}
                  />
                );
              })}
            </svg>
          </div>
        )}

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={
            status === 'idle'
              ? () => {
                  void startRecording();
                }
              : status === 'recording'
                ? () => {
                    void stopRecording();
                  }
                : undefined
          }
          disabled={status === 'connecting' || status === 'processing'}
          className={`relative z-10 flex h-28 w-28 items-center justify-center rounded-full transition-all duration-300 ${
            status === 'recording'
              ? 'bg-primary shadow-lg shadow-primary/30'
              : status === 'connecting' || status === 'processing'
                ? 'bg-secondary'
                : 'bg-primary/10 hover:bg-primary/20'
          }`}
        >
          <AnimatePresence mode="wait">
            {status === 'idle' && (
              <motion.div key="mic" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                <Mic className="h-10 w-10 text-primary" />
              </motion.div>
            )}
            {status === 'recording' && (
              <motion.div key="stop" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                <Square className="h-8 w-8 text-primary-foreground" />
              </motion.div>
            )}
            {(status === 'connecting' || status === 'processing') && (
              <motion.div key="load" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      <div className="text-center">
        {status === 'idle' && <p className="text-muted-foreground">Tap to start speaking</p>}
        {status === 'connecting' && <p className="text-muted-foreground">Connecting to Deepgram...</p>}
        {status === 'recording' && (
          <div className="space-y-1">
            <p className="font-medium text-primary">Streaming live transcript...</p>
            <p className="font-mono text-sm text-muted-foreground">{formatTime(duration)}</p>
          </div>
        )}
        {status === 'processing' && <p className="text-muted-foreground">Finalizing transcript...</p>}
      </div>
    </div>
  );
};

export default VoiceRecorder;
