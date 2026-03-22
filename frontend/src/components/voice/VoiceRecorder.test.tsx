import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
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
  static instances: FakeAudioContext[] = [];
  sampleRate = 16000;
  destination = {};
  state: AudioContextState = 'running';
  resume = vi.fn().mockResolvedValue(undefined);

  constructor() {
    FakeAudioContext.instances.push(this);
  }

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
  static instances: FakeWebSocket[] = [];

  onopen: (() => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  readyState = FakeWebSocket.OPEN;

  constructor(public url: string, public protocols?: string | string[]) {
    FakeWebSocket.instances.push(this);
    queueMicrotask(() => {
      this.onopen?.();
    });
  }

  send() {}

  emitMessage(data: string) {
    this.onmessage?.({ data });
  }

  emitClose(code = 1000) {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.({ code });
  }

  close(code = 1000) {
    this.emitClose(code);
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
    FakeAudioContext.instances = [];
    FakeWebSocket.instances = [];
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

  it("returns to idle and preserves the latest transcript on unexpected socket close", async () => {
    const onTranscriptChange = vi.fn();
    const onStreamInterrupted = vi.fn();

    render(
      <VoiceRecorder
        onTranscriptChange={onTranscriptChange}
        onStreamInterrupted={onStreamInterrupted}
      />,
    );

    fireEvent.click(screen.getByRole("button"));
    expect(await screen.findByText(/Streaming live transcript/i)).toBeInTheDocument();

    const socket = FakeWebSocket.instances[0];
    act(() => {
      socket.emitMessage(
        JSON.stringify({
          channel: { alternatives: [{ transcript: "I was speaking" }] },
          is_final: false,
        }),
      );

      socket.emitClose(1011);
    });

    expect(await screen.findByText("Tap to start speaking")).toBeInTheDocument();
    expect(onTranscriptChange).toHaveBeenCalledWith("I was speaking");
    expect(onStreamInterrupted).toHaveBeenCalledWith({ transcript: "I was speaking" });
  });

  it("reconnects after an unexpected socket drop without interrupting the UI", async () => {
    const onStreamInterrupted = vi.fn();

    render(<VoiceRecorder onStreamInterrupted={onStreamInterrupted} />);

    fireEvent.click(screen.getByRole("button"));
    expect(await screen.findByText(/Streaming live transcript/i)).toBeInTheDocument();

    act(() => {
      FakeWebSocket.instances[0]?.emitClose(1006);
    });

    await screen.findByText(/Streaming live transcript/i);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 450));
    });

    expect(FakeWebSocket.instances.length).toBeGreaterThan(1);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(onStreamInterrupted).not.toHaveBeenCalled();
    expect(screen.getByText(/Streaming live transcript/i)).toBeInTheDocument();
  });

  it("resumes the audio context when the tab becomes visible again", async () => {
    render(<VoiceRecorder />);

    fireEvent.click(screen.getByRole("button"));
    expect(await screen.findByText(/Streaming live transcript/i)).toBeInTheDocument();

    const audioContext = FakeAudioContext.instances[0];
    audioContext.state = "suspended";
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(audioContext.resume).toHaveBeenCalled();
  });
});
