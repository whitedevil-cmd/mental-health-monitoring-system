import { useState, useRef, useCallback, useEffect } from 'react';
import { audioBufferToWav } from '@/lib/audio-utils';

const TRANSCRIPT_STORAGE_KEY = 'dashboard-latest-transcript';

export type RecorderState = 'idle' | 'recording' | 'recorded' | 'uploading' | 'uploaded' | 'error';

export function useVoiceRecorder() {
  const [state, setState] = useState<RecorderState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [wavBlob, setWavBlob] = useState<Blob | null>(null);

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setWavBlob(null);
      chunks.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream);
      mediaRecorder.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };

      recorder.onstop = async () => {
        // Convert to WAV
        const rawBlob = new Blob(chunks.current, { type: 'audio/webm' });
        try {
          const arrayBuffer = await rawBlob.arrayBuffer();
          const audioCtx = new AudioContext();
          const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
          const wav = audioBufferToWav(audioBuffer);
          setWavBlob(wav);
          setState('recorded');
          await audioCtx.close();
        } catch {
          setError('Failed to convert audio to WAV format.');
          setState('error');
        }
      };

      recorder.start();
      setState('recording');
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((t) => t + 1), 1000);
    } catch {
      setError('Microphone access denied. Please allow microphone permissions.');
      setState('error');
    }
  }, []);

  const stopRecording = useCallback(() => {
    clearTimer();
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, [clearTimer]);

  const uploadRecording = useCallback(async () => {
    if (!wavBlob) return;
    setState('uploading');
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', wavBlob, 'recording.wav');

      // 1. Upload audio
      const uploadRes = await fetch('/upload-audio', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) throw new Error(`Upload failed: ${uploadRes.status}`);
      const uploadData = await uploadRes.json();
      const filePath = uploadData.file_path;

      // 2. Detect emotion
      const detectRes = await fetch('/detect-emotion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio_path: filePath }),
      });

      if (!detectRes.ok) throw new Error(`Emotion detection failed: ${detectRes.status}`);
      const detectData = await detectRes.json();
      const dominantEmotion = detectData.dominant_emotion;
      const transcript = typeof detectData.transcript === 'string' ? detectData.transcript.trim() : '';
      const scores = detectData.scores ?? {};
      const dominantConfidence =
        typeof scores[dominantEmotion] === 'number'
          ? scores[dominantEmotion]
          : Math.max(...Object.values(scores).map(Number), 0);

      if (transcript) {
        window.localStorage.setItem(TRANSCRIPT_STORAGE_KEY, transcript);
      }

      // 3. Store in DB
      const analyzeRes = await fetch('/api/v1/emotions/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: 'default-user',
          audio_id: filePath,
          emotion_label: dominantEmotion,
          confidence: dominantConfidence,
          transcript: transcript || undefined,
        }),
      });

      if (!analyzeRes.ok) throw new Error(`Failed to save emotion: ${analyzeRes.status}`);

      setState('uploaded');

      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('emotion-updated', { detail: { transcript } }));
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
      setState('error');
    }
  }, [wavBlob]);

  const reset = useCallback(() => {
    clearTimer();
    setElapsed(0);
    setWavBlob(null);
    setError(null);
    setState('idle');
  }, [clearTimer]);

  useEffect(() => {
    return () => {
      clearTimer();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [clearTimer]);

  return { state, elapsed, error, wavBlob, startRecording, stopRecording, uploadRecording, reset };
}
