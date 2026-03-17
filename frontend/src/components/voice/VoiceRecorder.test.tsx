import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import VoiceRecorder from "@/components/voice/VoiceRecorder";

class FakeAnalyser {
  fftSize = 0;
  frequencyBinCount = 32;
  getByteFrequencyData(data: Uint8Array) {
    for (let i = 0; i < data.length; i += 1) {
      data[i] = 0;
    }
  }
}

class FakeAudioContext {
  createMediaStreamSource() {
    return { connect: () => {} };
  }
  createAnalyser() {
    return new FakeAnalyser();
  }
  close = vi.fn().mockResolvedValue(undefined);
}

class FakeMediaRecorder {
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;

  constructor(public stream: MediaStream) {}

  start() {}

  stop() {
    this.onstop?.();
  }
}

describe("VoiceRecorder", () => {
  const originalAudioContext = globalThis.AudioContext;
  const originalMediaRecorder = globalThis.MediaRecorder;

  beforeEach(() => {
    const track = { stop: vi.fn() };
    const stream = { getTracks: () => [track] } as unknown as MediaStream;
    const getUserMedia = vi.fn().mockResolvedValue(stream);

    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });

    globalThis.AudioContext = FakeAudioContext as unknown as typeof AudioContext;
    globalThis.MediaRecorder = FakeMediaRecorder as unknown as typeof MediaRecorder;

    vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 0);
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    globalThis.AudioContext = originalAudioContext;
    globalThis.MediaRecorder = originalMediaRecorder;
    vi.restoreAllMocks();
  });

  it("shows listening state after starting recording", async () => {
    render(<VoiceRecorder />);

    expect(screen.getByText("Tap to start speaking")).toBeInTheDocument();

    const button = screen.getByRole("button");
    fireEvent.click(button);

    expect(await screen.findByText(/Listening/i)).toBeInTheDocument();
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true });
  });
});
