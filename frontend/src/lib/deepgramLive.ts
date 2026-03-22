import { apiClient } from '@/lib/apiClient';

const DEEPGRAM_WS_URL = 'wss://api.deepgram.com/v1/listen';
const KEEP_ALIVE_INTERVAL_MS = 10_000;
const RECONNECT_BASE_DELAY_MS = 350;
const MAX_RECONNECT_ATTEMPTS = 2;

const buildDeepgramUrl = (sampleRate: number): string => {
  const url = new URL(DEEPGRAM_WS_URL);
  url.searchParams.set('model', 'nova-3');
  url.searchParams.set('encoding', 'linear16');
  url.searchParams.set('sample_rate', String(sampleRate));
  url.searchParams.set('channels', '1');
  url.searchParams.set('smart_format', 'true');
  url.searchParams.set('punctuate', 'true');
  url.searchParams.set('interim_results', 'true');
  url.searchParams.set('endpointing', '500');
  url.searchParams.set('utterance_end_ms', '1600');
  return url.toString();
};

const toInt16Buffer = (input: Float32Array): ArrayBuffer => {
  const pcm = new Int16Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, input[i]));
    pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return pcm.buffer;
};

type TranscriptHandler = (transcript: string) => void;
type FinalTranscriptHandler = (segment: { id: string; transcript: string; speechFinal: boolean }) => void;
type UtteranceEndHandler = () => void;
type VoidHandler = () => void;
type CloseHandler = (event: { manual: boolean; code: number; wasConnected: boolean }) => void;
type ErrorHandler = (message: string) => void;

interface DeepgramLiveOptions {
  sampleRate: number;
  onTranscript: TranscriptHandler;
  onFinalTranscript?: FinalTranscriptHandler;
  onUtteranceEnd?: UtteranceEndHandler;
  onOpen?: VoidHandler;
  onClose?: CloseHandler;
  onError?: ErrorHandler;
}

export class DeepgramLiveClient {
  private readonly sampleRate: number;
  private readonly onTranscript: TranscriptHandler;
  private readonly onFinalTranscript?: FinalTranscriptHandler;
  private readonly onUtteranceEnd?: UtteranceEndHandler;
  private readonly onOpen?: VoidHandler;
  private readonly onClose?: CloseHandler;
  private readonly onError?: ErrorHandler;
  private socket: WebSocket | null = null;
  private finalSegments: string[] = [];
  private interimSegment = '';
  private manualClose = false;
  private keepAliveTimer: number | null = null;
  private reconnectAttempts = 0;

  constructor(options: DeepgramLiveOptions) {
    this.sampleRate = options.sampleRate;
    this.onTranscript = options.onTranscript;
    this.onFinalTranscript = options.onFinalTranscript;
    this.onUtteranceEnd = options.onUtteranceEnd;
    this.onOpen = options.onOpen;
    this.onClose = options.onClose;
    this.onError = options.onError;
  }

  async connect(): Promise<void> {
    if (this.socket && this.socket.readyState <= WebSocket.OPEN) {
      return;
    }

    this.manualClose = false;
    this.reconnectAttempts = 0;
    await this.openSocketWithFreshToken(1);
  }

  private async openSocketWithFreshToken(retriesRemaining: number): Promise<void> {
    const { token } = await apiClient.getDeepgramToken();
    if (!token) {
      throw new Error('Voice session could not be started.');
    }

    await new Promise<void>((resolve, reject) => {
      let opened = false;
      let settled = false;
      const socket = new WebSocket(buildDeepgramUrl(this.sampleRate), ['bearer', token]);
      this.socket = socket;

      socket.onopen = () => {
        opened = true;
        settled = true;
        this.reconnectAttempts = 0;
        this.startKeepAlive();
        this.onOpen?.();
        resolve();
      };

      socket.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      socket.onerror = () => {
        if (settled) {
          this.onError?.('Voice connection failed.');
          return;
        }
        settled = true;
        reject(new Error('Voice connection failed.'));
      };

      socket.onclose = async (event) => {
        this.stopKeepAlive();
        this.socket = null;
        if (!opened && !settled) {
          this.onClose?.({
            manual: this.manualClose,
            code: event.code,
            wasConnected: opened,
          });
          settled = true;
          if (retriesRemaining > 0) {
            try {
              await this.openSocketWithFreshToken(retriesRemaining - 1);
              resolve();
              return;
            } catch (error) {
              reject(error instanceof Error ? error : new Error('Voice session refresh failed.'));
              return;
            }
          }

          reject(new Error('Voice session closed before it could start.'));
          return;
        }

        if (!this.manualClose && opened && this.shouldReconnect(event.code)) {
          const reconnectAttempt = this.reconnectAttempts + 1;
          if (reconnectAttempt <= MAX_RECONNECT_ATTEMPTS) {
            this.reconnectAttempts = reconnectAttempt;
            try {
              await this.delay(RECONNECT_BASE_DELAY_MS * reconnectAttempt);
              if (!this.manualClose) {
                await this.openSocketWithFreshToken(1);
                return;
              }
            } catch (error) {
              this.onError?.(
                error instanceof Error
                  ? error.message
                  : 'Voice session reconnection failed.',
              );
            }
          }
        }

        this.onClose?.({
          manual: this.manualClose,
          code: event.code,
          wasConnected: opened,
        });

        if (!this.manualClose && opened) {
          this.onError?.(
            event.code === 1008 || event.code === 1011
              ? 'Your voice session expired. Start again to continue.'
              : 'Your voice session was interrupted. Start again if it does not recover.',
          );
        }
      };
    });
  }

  sendAudio(float32Samples: Float32Array): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN || float32Samples.length === 0) {
      return;
    }

    this.socket.send(toInt16Buffer(float32Samples));
  }

  finalize(): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    this.socket.send(JSON.stringify({ type: 'Finalize' }));
  }

  disconnect(): void {
    if (!this.socket || this.socket.readyState >= WebSocket.CLOSING) {
      return;
    }

    this.manualClose = true;
    this.stopKeepAlive();
    this.socket.send(JSON.stringify({ type: 'CloseStream' }));
    this.socket.close(1000, 'client-stop');
  }

  getTranscript(): string {
    return [...this.finalSegments, this.interimSegment].filter(Boolean).join(' ').trim();
  }

  private handleMessage(raw: unknown): void {
    if (typeof raw !== 'string') {
      return;
    }

    try {
      const payload = JSON.parse(raw) as {
        type?: string;
        channel?: { alternatives?: Array<{ transcript?: string }> };
        is_final?: boolean;
        speech_final?: boolean;
      };
      if (payload.type === 'UtteranceEnd') {
        this.onUtteranceEnd?.();
        return;
      }

      const transcript = payload.channel?.alternatives?.[0]?.transcript?.trim() || '';
      if (!transcript) {
        return;
      }

      if (payload.is_final) {
        this.finalSegments.push(transcript);
        this.interimSegment = '';
        this.onFinalTranscript?.({
          id: `segment-${this.finalSegments.length}`,
          transcript,
          speechFinal: Boolean(payload.speech_final),
        });
      } else {
        this.interimSegment = transcript;
      }

      this.onTranscript(this.getTranscript());
    } catch {
      this.onError?.('Live transcript data could not be processed.');
    }
  }

  private startKeepAlive(): void {
    this.stopKeepAlive();
    this.keepAliveTimer = window.setInterval(() => {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        this.stopKeepAlive();
        return;
      }

      this.socket.send(JSON.stringify({ type: 'KeepAlive' }));
    }, KEEP_ALIVE_INTERVAL_MS);
  }

  private stopKeepAlive(): void {
    if (this.keepAliveTimer !== null) {
      window.clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }

  private shouldReconnect(code: number): boolean {
    return code === 1006 || code === 1012 || code === 1013;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }
}
