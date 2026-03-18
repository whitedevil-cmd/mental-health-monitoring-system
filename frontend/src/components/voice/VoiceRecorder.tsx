import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Square, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';
import { EmotionScore, EMOTION_COLORS } from '@/types';
import { toast } from '@/components/ui/use-toast';

const encodeWav = (audioBuffer: AudioBuffer): ArrayBuffer => {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + length * blockAlign);
  const view = new DataView(buffer);

  const writeString = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + length * blockAlign, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, length * blockAlign, true);

  const interleaved = new Float32Array(length * numChannels);
  for (let channel = 0; channel < numChannels; channel += 1) {
    const channelData = audioBuffer.getChannelData(channel);
    for (let i = 0; i < length; i += 1) {
      interleaved[i * numChannels + channel] = channelData[i];
    }
  }

  let offset = 44;
  for (let i = 0; i < interleaved.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, interleaved[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }

  return buffer;
};

const convertToWavBlob = async (blob: Blob): Promise<Blob> => {
  const arrayBuffer = await blob.arrayBuffer();
  const decodeContext = new AudioContext();
  try {
    const audioBuffer = await decodeContext.decodeAudioData(arrayBuffer);
    const wavBuffer = encodeWav(audioBuffer);
    return new Blob([wavBuffer], { type: 'audio/wav' });
  } finally {
    await decodeContext.close().catch(() => undefined);
  }
};

interface VoiceRecorderProps {
  onResult?: (data: { transcript: string; emotions: EmotionScore[]; aiResponse: string }) => void;
}

const VoiceRecorder = ({ onResult }: VoiceRecorderProps) => {
  const { user } = useAuth();
  const [status, setStatus] = useState<'idle' | 'recording' | 'processing'>('idle');
  const [duration, setDuration] = useState(0);
  const [analyzerData, setAnalyzerData] = useState<number[]>(new Array(32).fill(0));
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number>(0);
  const animFrameRef = useRef<number>(0);
  const analyzerRef = useRef<AnalyserNode | null>(null);

  const visualize = useCallback(() => {
    if (!analyzerRef.current) return;
    const data = new Uint8Array(analyzerRef.current.frequencyBinCount);
    analyzerRef.current.getByteFrequencyData(data);
    const slice = Array.from(data.slice(0, 32)).map(v => v / 255);
    setAnalyzerData(slice);
    animFrameRef.current = requestAnimationFrame(visualize);
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyzer = audioCtx.createAnalyser();
      analyzer.fftSize = 64;
      source.connect(analyzer);
      analyzerRef.current = analyzer;
      audioContextRef.current = audioCtx;
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        cancelAnimationFrame(animFrameRef.current);
        setAnalyzerData(new Array(32).fill(0));

        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setStatus('processing');

        try {
          const wavBlob = await convertToWavBlob(blob);
          // Step 1: Analyze audio emotion
          const analysis = await apiClient.analyzeAudio(wavBlob, user?.id ?? undefined);

          // Convert probabilities to EmotionScore[]
          const emotions: EmotionScore[] = Object.entries(analysis.probabilities).map(
            ([emotion, score]) => ({
              emotion,
              score,
              color: EMOTION_COLORS[emotion] || EMOTION_COLORS.neutral,
            })
          );

          // Step 2: Generate AI support response
          const support = await apiClient.generateSupport(analysis.emotion, analysis.confidence);
          const transcriptText = analysis.transcript?.trim()
            ? analysis.transcript
            : `Detected emotion: ${analysis.emotion} (${Math.round(analysis.confidence * 100)}% confidence)`;

          onResult?.({
            transcript: transcriptText,
            emotions,
            aiResponse: support.message,
          });
        } catch (err) {
          console.error('Processing error:', err);
          toast({
            title: 'Audio processing failed',
            description: 'Please confirm microphone access and backend availability, then try again.',
            variant: 'destructive',
          });
          onResult?.({
            transcript: 'Unable to process audio. Please check that the backend is running.',
            emotions: [],
            aiResponse: 'I had trouble processing your audio. Please try again.',
          });
        } finally {
          await audioContextRef.current?.close().catch(() => undefined);
          audioContextRef.current = null;
          setStatus('idle');
          setDuration(0);
        }
      };

      mediaRecorder.start();
      setStatus('recording');
      setDuration(0);
      timerRef.current = window.setInterval(() => setDuration(d => d + 1), 1000);
      visualize();
    } catch (err) {
      console.error('Microphone error:', err);
      toast({
        title: 'Microphone access failed',
        description: 'Please allow microphone access and try again.',
        variant: 'destructive',
      });
      setStatus('idle');
    }
  };

  const stopRecording = () => {
    clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
  };

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      cancelAnimationFrame(animFrameRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      audioContextRef.current?.close().catch(() => undefined);
      audioContextRef.current = null;
    };
  }, []);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative">
        {status === 'recording' && (
          <>
            <div className="absolute inset-0 -m-4 rounded-full border-2 border-primary/30 animate-pulse-ring" />
            <div className="absolute inset-0 -m-8 rounded-full border border-primary/15 animate-pulse-ring" style={{ animationDelay: '0.5s' }} />
          </>
        )}

        {status === 'recording' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg viewBox="0 0 200 200" className="w-full h-full absolute">
              {analyzerData.map((v, i) => {
                const angle = (i / analyzerData.length) * Math.PI * 2 - Math.PI / 2;
                const innerR = 55;
                const outerR = innerR + v * 30;
                const x1 = 100 + Math.cos(angle) * innerR;
                const y1 = 100 + Math.sin(angle) * innerR;
                const x2 = 100 + Math.cos(angle) * outerR;
                const y2 = 100 + Math.sin(angle) * outerR;
                return (
                  <line
                    key={i}
                    x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke="hsl(var(--primary))"
                    strokeWidth="3"
                    strokeLinecap="round"
                    opacity={0.4 + v * 0.6}
                  />
                );
              })}
            </svg>
          </div>
        )}

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={status === 'idle' ? startRecording : status === 'recording' ? stopRecording : undefined}
          disabled={status === 'processing'}
          className={`relative z-10 w-28 h-28 rounded-full flex items-center justify-center transition-all duration-300 ${
            status === 'recording'
              ? 'bg-primary shadow-lg shadow-primary/30'
              : status === 'processing'
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
            {status === 'processing' && (
              <motion.div key="load" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      <div className="text-center">
        {status === 'idle' && <p className="text-muted-foreground">Tap to start speaking</p>}
        {status === 'recording' && (
          <div className="space-y-1">
            <p className="text-primary font-medium">Listening…</p>
            <p className="text-sm text-muted-foreground font-mono">{formatTime(duration)}</p>
          </div>
        )}
        {status === 'processing' && <p className="text-muted-foreground">Analyzing your emotions…</p>}
      </div>
    </div>
  );
};

export default VoiceRecorder;
