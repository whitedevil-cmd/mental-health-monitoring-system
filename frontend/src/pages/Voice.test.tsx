import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Voice from '@/pages/Voice';

const analyzeTextMock = vi.fn();
let voiceHandlers: {
  onTranscriptChange?: (transcript: string) => void;
  onFinalTranscript?: (segment: { id: string; transcript: string; speechFinal: boolean }) => void;
  onUtteranceEnd?: () => void;
} = {};

vi.mock('@/components/layout/AppLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/voice/VoiceRecorder', () => ({
  default: (props: typeof voiceHandlers) => {
    voiceHandlers = props;

    return (
      <div>
        <button
          type="button"
          onClick={() => {
            props.onTranscriptChange?.('I feel calm.');
            props.onFinalTranscript?.({ id: 'segment-1', transcript: 'I feel calm.', speechFinal: true });
          }}
        >
          Emit final transcript
        </button>
        <button
          type="button"
          onClick={() => {
            props.onTranscriptChange?.('I feel uncertain');
            props.onFinalTranscript?.({ id: 'segment-2', transcript: 'I feel uncertain', speechFinal: true });
          }}
        >
          Emit failing transcript
        </button>
        <button
          type="button"
          onClick={() => {
            props.onTranscriptChange?.('This feels quite stressful right now');
            props.onFinalTranscript?.({ id: 'segment-3', transcript: 'This feels', speechFinal: false });
            props.onTranscriptChange?.('This feels quite stressful right now');
            props.onFinalTranscript?.({ id: 'segment-4', transcript: 'quite stressful right now', speechFinal: false });
          }}
        >
          Emit chunked transcript
        </button>
        <button
          type="button"
          onClick={() => {
            props.onTranscriptChange?.('ok');
            props.onFinalTranscript?.({ id: 'segment-5', transcript: 'ok', speechFinal: true });
          }}
        >
          Emit short transcript
        </button>
        <button
          type="button"
          onClick={() => {
            const chunkGroups = [
              ['I feel', 'calm today', 'after', 'taking a', 'walk'],
              ['Work feels', 'intense right', 'now but', 'I am', 'managing'],
              ['I am', 'trying to', 'stay focused', 'through this', 'pressure'],
              ['This meeting', 'made me', 'anxious and', 'I need', 'space'],
              ['I think', 'I am', 'doing better', 'than last', 'week'],
            ];

            let segmentIndex = 6;
            for (let repeat = 0; repeat < 2; repeat += 1) {
              let runningTranscript = '';
              for (const group of chunkGroups) {
                for (const part of group) {
                  runningTranscript = `${runningTranscript} ${part}`.trim();
                  props.onTranscriptChange?.(runningTranscript);
                  props.onFinalTranscript?.({
                    id: `segment-${segmentIndex}`,
                    transcript: part,
                    speechFinal: false,
                  });
                  segmentIndex += 1;
                }
              }
            }
          }}
        >
          Emit rapid burst
        </button>
        <button
          type="button"
          onClick={() => {
            props.onTranscriptChange?.('I need a moment to breathe');
            props.onFinalTranscript?.({ id: 'segment-60', transcript: 'I need a moment', speechFinal: false });
            props.onTranscriptChange?.('I need a moment to breathe');
            props.onFinalTranscript?.({ id: 'segment-61', transcript: 'to breathe', speechFinal: false });
            props.onUtteranceEnd?.();
          }}
        >
          Emit utterance end
        </button>
        <button
          type="button"
          onClick={() => {
            props.onTranscriptChange?.('I need to think');
            props.onFinalTranscript?.({ id: 'segment-70', transcript: 'I need', speechFinal: false });
            props.onTranscriptChange?.('I need to think clearly');
            props.onFinalTranscript?.({ id: 'segment-71', transcript: 'to think clearly', speechFinal: false });
          }}
        >
          Emit slow backend transcript
        </button>
      </div>
    );
  },
}));

vi.mock('@/lib/apiClient', () => ({
  apiClient: {
    analyzeText: (...args: unknown[]) => analyzeTextMock(...args),
  },
}));

describe('Voice page', () => {
  beforeEach(() => {
    analyzeTextMock.mockReset();
    voiceHandlers = {};
    vi.useRealTimers();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('analyzes one finalized utterance once and renders emotion', async () => {
    analyzeTextMock.mockResolvedValue({ emotion: 'calm', confidence: 0.82 });

    render(<Voice />);
    fireEvent.click(screen.getByRole('button', { name: 'Emit final transcript' }));

    expect(await screen.findByText('I feel calm.')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('calm')).toBeInTheDocument();
      expect(screen.getByText('Confidence: 82%')).toBeInTheDocument();
    });

    expect(analyzeTextMock).toHaveBeenCalledTimes(1);
    expect(analyzeTextMock).toHaveBeenCalledWith('I feel calm.');
  });

  it('groups adjacent final chunks into one backend request', async () => {
    analyzeTextMock.mockResolvedValue({ emotion: 'stress', confidence: 0.73 });

    render(<Voice />);
    fireEvent.click(screen.getByRole('button', { name: 'Emit chunked transcript' }));

    expect(analyzeTextMock).not.toHaveBeenCalled();

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 500));
    });

    expect(await screen.findByText('This feels quite stressful right now')).toBeInTheDocument();

    await waitFor(() => {
      expect(analyzeTextMock).toHaveBeenCalledTimes(1);
      expect(analyzeTextMock).toHaveBeenCalledWith('This feels quite stressful right now');
      expect(screen.getByText('stress')).toBeInTheDocument();
    });
  });

  it('flushes buffered finals on utterance end without waiting for debounce', async () => {
    analyzeTextMock.mockResolvedValue({ emotion: 'calm', confidence: 0.77 });

    render(<Voice />);
    fireEvent.click(screen.getByRole('button', { name: 'Emit utterance end' }));

    expect(await screen.findByText('I need a moment to breathe')).toBeInTheDocument();

    await waitFor(() => {
      expect(analyzeTextMock).toHaveBeenCalledTimes(1);
      expect(analyzeTextMock).toHaveBeenCalledWith('I need a moment to breathe');
      expect(screen.getByText('calm')).toBeInTheDocument();
      expect(screen.getByText('Confidence: 77%')).toBeInTheDocument();
    });
  });

  it('shows a fallback when analyze-text fails', async () => {
    analyzeTextMock.mockRejectedValue(new Error('backend down'));

    render(<Voice />);
    fireEvent.click(screen.getByRole('button', { name: 'Emit failing transcript' }));

    expect(await screen.findByText('I feel uncertain')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Emotion unavailable')).toBeInTheDocument();
    });
  });

  it('skips backend analysis for very short filler inputs', async () => {
    render(<Voice />);
    fireEvent.click(screen.getByRole('button', { name: 'Emit short transcript' }));

    expect(await screen.findByText('ok')).toBeInTheDocument();
    expect(screen.getByText('Too short to analyze')).toBeInTheDocument();
    expect(analyzeTextMock).not.toHaveBeenCalled();
  });

  it('handles 50 rapid transcript events with debounce and minimal API calls', async () => {
    analyzeTextMock.mockImplementation(async (text: string) => ({
      emotion: text.includes('anxious') ? 'anxious' : 'calm',
      confidence: 0.81,
    }));

    render(<Voice />);

    fireEvent.click(screen.getByRole('button', { name: 'Emit rapid burst' }));

    expect(analyzeTextMock).not.toHaveBeenCalled();

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 800));
    });

    await waitFor(() => {
      expect(analyzeTextMock).toHaveBeenCalledTimes(1);
    });

    expect(analyzeTextMock).toHaveBeenNthCalledWith(
      1,
      'I feel calm today after taking a walk Work feels intense right now but I am managing I am trying to stay focused through this pressure This meeting made me anxious and I need space I think I am doing better than last week I feel calm today after taking a walk Work feels intense right now but I am managing I am trying to stay focused through this pressure This meeting made me anxious and I need space I think I am doing better than last week',
    );

    const renderedUtterances = screen.getAllByText((content, element) =>
      element?.tagName.toLowerCase() === 'p' &&
      content.includes('I feel calm today') &&
      content.includes('I think I am doing better than last week'),
    );
    expect(renderedUtterances).toHaveLength(1);
    expect(screen.getByText('anxious')).toBeInTheDocument();
    expect(screen.getByText('Confidence: 81%')).toBeInTheDocument();
  });

  it('shows immediate pending UI while backend is slow and keeps API calls minimal', async () => {
    analyzeTextMock.mockImplementation(
      () =>
        new Promise<{ emotion: string; confidence: number }>((resolve) => {
          window.setTimeout(() => resolve({ emotion: 'focused', confidence: 0.75 }), 1200);
        }),
    );

    render(<Voice />);
    fireEvent.click(screen.getByRole('button', { name: 'Emit slow backend transcript' }));

    expect(await screen.findByText('I need to think clearly')).toBeInTheDocument();

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 500));
    });

    expect(screen.getByText('Analyzing emotion...')).toBeInTheDocument();
    expect(analyzeTextMock).toHaveBeenCalledTimes(1);
    expect(analyzeTextMock).toHaveBeenCalledWith('I need to think clearly');

    await waitFor(
      () => {
        expect(screen.getByText('focused')).toBeInTheDocument();
        expect(screen.getByText('Confidence: 75%')).toBeInTheDocument();
      },
      { timeout: 2000 },
    );
  });
});
