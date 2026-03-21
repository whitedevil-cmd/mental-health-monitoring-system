import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import VoiceRecorder from "@/components/voice/VoiceRecorder";

class FakeAnalyser {
  fftSize = 0;
  frequencyBinCount = 32;

  connect() {}

  disconnect() {}

  getByteFrequencyData(data: Uint8Array) {
    for (let i = 0; i < data.length; i += 1) {
      data[i] = 0;
    }
  }
}

class FakeScriptProcessor {
  onaudioprocess: ((event: { inputBuffer: { getChannelData: (_channel: number) => Float32Array } }) => void) | null = null;

  connect() {}

  disconnect() {}
}

class FakeAudioContext {
  sampleRate = 16000;
  destination = {};

  createMediaStreamSource() {
    return { connect: () => {}, disconnect: () => {} };
  }

  createAnalyser() {
    return new FakeAnalyser();
  }

  createScriptProcessor() {
    return new FakeScriptProcessor();
  }

  close = vi.fn().mockResolvedValue(undefined);
}

class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  readyState = FakeWebSocket.OPEN;

  constructor(public url: string, public protocols?: string | string[]) {
    queueMicrotask(() => {
      this.onopen?.();
    });
  }

  send() {}

  close() {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.();
  }
}

describe("VoiceRecorder", () => {
  const originalAudioContext = globalThis.AudioContext;
  const originalWebSocket = globalThis.WebSocket;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    const track = { stop: vi.fn() };
    const stream = { getTracks: () => [track] } as unknown as MediaStream;
    const getUserMedia = vi.fn().mockResolvedValue(stream);

    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });

    globalThis.AudioContext = FakeAudioContext as unknown as typeof AudioContext;
    globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ token: "temporary-deepgram-token" }),
    } as unknown as Response);

    vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 0);
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    globalThis.AudioContext = originalAudioContext;
    globalThis.WebSocket = originalWebSocket;
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("shows streaming state after starting recording", async () => {
    render(<VoiceRecorder />);

    expect(screen.getByText("Tap to start speaking")).toBeInTheDocument();

    const button = screen.getByRole("button");
    fireEvent.click(button);

    expect(await screen.findByText(/Streaming live transcript/i)).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/deepgram-token"),
      expect.any(Object),
    );
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  });
});
