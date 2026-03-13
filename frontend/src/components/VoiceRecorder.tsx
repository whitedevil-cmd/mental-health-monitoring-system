import { Mic, Square, Upload, RotateCcw, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useVoiceRecorder } from '@/hooks/use-voice-recorder';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function VoiceRecorder() {
  const { state, elapsed, error, startRecording, stopRecording, uploadRecording, reset } = useVoiceRecorder();

  return (
    <Card className="w-full max-w-sm border-0 animate-float"
          style={{ background: 'var(--gradient-card)', boxShadow: 'var(--shadow-elevated)' }}>
      <CardContent className="flex flex-col items-center gap-8 p-8 pt-10">
        {/* Orb / visual indicator */}
        <div className="relative flex items-center justify-center">
          {state === 'recording' && (
            <>
              <span className="absolute h-28 w-28 rounded-full bg-[hsl(var(--recording))]/10 animate-ripple" />
              <span className="absolute h-28 w-28 rounded-full bg-[hsl(var(--recording))]/5 animate-ripple [animation-delay:0.5s]" />
            </>
          )}
          <div className={`
            h-24 w-24 rounded-full flex items-center justify-center transition-all duration-500
            ${state === 'recording' 
              ? 'bg-[hsl(var(--recording))]/15 ring-2 ring-[hsl(var(--recording))]/30' 
              : state === 'uploaded'
              ? 'bg-[hsl(var(--success))]/10 ring-2 ring-[hsl(var(--success))]/20'
              : 'bg-secondary ring-1 ring-border'}
          `}>
            {state === 'recording' ? (
              <div className="flex items-center gap-1">
                {[0, 1, 2, 3, 4].map((i) => (
                  <span
                    key={i}
                    className="w-1 rounded-full bg-[hsl(var(--recording))]"
                    style={{
                      height: `${12 + Math.random() * 16}px`,
                      animation: `pulse-recording 0.8s ease-in-out ${i * 0.15}s infinite alternate`,
                    }}
                  />
                ))}
              </div>
            ) : state === 'uploaded' ? (
              <CheckCircle className="h-10 w-10 text-[hsl(var(--success))]" />
            ) : (
              <Mic className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
        </div>

        {/* Timer & status */}
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-4xl font-light text-foreground tabular-nums tracking-tight"
                style={{ fontFamily: "'DM Sans', monospace" }}>
            {formatTime(elapsed)}
          </span>
          {state === 'idle' && (
            <span className="text-sm text-muted-foreground">Tap to begin recording</span>
          )}
          {state === 'recording' && (
            <span className="text-sm font-medium text-[hsl(var(--recording))]">Listening…</span>
          )}
          {state === 'recorded' && (
            <span className="text-sm text-muted-foreground">Ready to upload</span>
          )}
          {state === 'uploaded' && (
            <span className="text-sm font-medium text-[hsl(var(--success))]">Session saved</span>
          )}
        </div>

        {/* Controls */}
        <div className="flex gap-3 w-full justify-center">
          {(state === 'idle' || state === 'error') && (
            <Button onClick={startRecording} size="lg" className="gap-2 rounded-full px-8 shadow-sm">
              <Mic className="h-5 w-5" />
              Start Recording
            </Button>
          )}

          {state === 'recording' && (
            <Button onClick={stopRecording} variant="recording" size="lg" className="gap-2 rounded-full px-8 shadow-sm">
              <Square className="h-4 w-4 fill-current" />
              Stop
            </Button>
          )}

          {state === 'recorded' && (
            <>
              <Button onClick={uploadRecording} variant="success" size="lg" className="gap-2 rounded-full px-8 shadow-sm">
                <Upload className="h-5 w-5" />
                Upload
              </Button>
              <Button onClick={reset} variant="ghost" size="lg" className="gap-2 rounded-full">
                <RotateCcw className="h-4 w-4" />
                Redo
              </Button>
            </>
          )}

          {state === 'uploading' && (
            <Button disabled size="lg" className="gap-2 rounded-full px-8">
              <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              Uploading…
            </Button>
          )}

          {state === 'uploaded' && (
            <Button onClick={reset} variant="outline" size="lg" className="gap-2 rounded-full px-8">
              <RotateCcw className="h-4 w-4" />
              New Session
            </Button>
          )}
        </div>

        {error && (
          <p className="text-sm text-destructive text-center max-w-xs">{error}</p>
        )}
      </CardContent>
    </Card>
  );
}
