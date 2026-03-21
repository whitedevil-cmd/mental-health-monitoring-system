import { apiClient } from '@/lib/apiClient';

const DEEPGRAM_WS_URL = 'wss://api.deepgram.com/v1/listen';

const buildDeepgramUrl = (sampleRate: number, token?: string): string => {
  const url = new URL(DEEPGRAM_WS_URL);
  url.searchParams.set('model', 'nova-3');
  url.searchParams.set('encoding', 'linear16');
  url.searchParams.set('sample_rate', String(sampleRate));
  url.searchParams.set('channels', '1');
  url.searchParams.set('smart_format', 'true');
  url.searchParams.set('interim_results', 'true');
  url.searchParams.set('endpointing', '300');
  url.searchParams.set('utterance_end_ms', '1000');
  if (token) {
    url.searchParams.set('token', `bearer ${token}`);
  }
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
type VoidHandler = () => void;
type ErrorHandler = (message: string) => void;

interface DeepgramLiveOptions {
  sampleRate: number;
  onTranscript: TranscriptHandler;
  onOpen?: VoidHandler;
  onClose?: VoidHandler;
  onError?: ErrorHandler;
}

export class DeepgramLiveClient {
  private readonly sampleRate: number;
  private readonly onTranscript: TranscriptHandler;
  private readonly onOpen?: VoidHandler;
  private readonly onClose?: VoidHandler;
  private readonly onError?: ErrorHandler;
  private socket: WebSocket | null = null;
  private finalSegments: string[] = [];
  private interimSegment = '';
  private manualClose = false;

  constructor(options: DeepgramLiveOptions) {
    this.sampleRate = options.sampleRate;
    this.onTranscript = options.onTranscript;
    this.onOpen = options.onOpen;
    this.onClose = options.onClose;
    this.onError = options.onError;
  }

  async connect(): Promise<void> {
    if (this.socket && this.socket.readyState <= WebSocket.OPEN) {
      return;
    }

    this.manualClose = false;
    await this.openSocketWithFreshToken(1);
  }

  private async openSocketWithFreshToken(retriesRemaining: number): Promise<void> {
    const { token } = await apiClient.getDeepgramToken();
    if (!token) {
      throw new Error('Backend returned an empty Deepgram token.');
    }

    await new Promise<void>((resolve, reject) => {
      let opened = false;
      let settled = false;
      const socket = new WebSocket(buildDeepgramUrl(this.sampleRate, token));
      this.socket = socket;

      socket.onopen = () => {
        opened = true;
        settled = true;
        this.onOpen?.();
        resolve();
      };

      socket.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      socket.onerror = () => {
        if (settled) {
          this.onError?.('Deepgram streaming connection failed.');
          return;
        }
        settled = true;
        reject(new Error('Deepgram streaming connection failed.'));
      };

      socket.onclose = async (event) => {
        this.socket = null;
        this.onClose?.();
        if (!opened && !settled) {
          settled = true;
          if (retriesRemaining > 0) {
            try {
              await this.openSocketWithFreshToken(retriesRemaining - 1);
              resolve();
              return;
            } catch (error) {
              reject(error instanceof Error ? error : new Error('Deepgram token refresh failed.'));
              return;
            }
          }

          reject(new Error('Deepgram streaming connection closed before it was established.'));
          return;
        }

        if (!this.manualClose && opened && (event.code === 1008 || event.code === 1011)) {
          this.onError?.('Deepgram session expired. Start recording again to fetch a fresh token.');
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
        channel?: { alternatives?: Array<{ transcript?: string }> };
        is_final?: boolean;
      };
      const transcript = payload.channel?.alternatives?.[0]?.transcript?.trim() || '';
      if (!transcript) {
        return;
      }

      if (payload.is_final) {
        this.finalSegments.push(transcript);
        this.interimSegment = '';
      } else {
        this.interimSegment = transcript;
      }

      this.onTranscript(this.getTranscript());
    } catch {
      this.onError?.('Received an invalid Deepgram transcript message.');
    }
  }
}
