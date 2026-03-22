import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Voice from '@/pages/Voice';

const analyzeTextMock = vi.fn();

let voiceHandlers: {
  onTranscriptChange?: (transcript: string) => void;
  onFinalTranscript?: (segment: { id: string; transcript: string; speechFinal: boolean }) => void;
  onUtteranceEnd?: () => void;
  onStreamInterrupted?: (payload: { transcript: string }) => void;
} = {};

vi.mock('@/components/layout/AppLayout', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      email: 'user@example.com',
    },
  }),
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

vi.mock('@/components/voice/ConversationPanel', () => ({
  default: ({
    turns,
    partialTranscript,
    assistantDraft,
    assistantState,
  }: {
    turns: Array<{ transcript: string; emotion: string | null; confidence: number | null; status: string }>;
    partialTranscript: string;
    assistantDraft: string;
    assistantState: string;
  }) => (
    <div>
      {turns.map((turn, index) => (
        <div key={`${turn.transcript}-${index}`}>
          <p>{turn.transcript}</p>
          <span>
            {turn.status === 'failed'
              ? 'Emotion unavailable'
              : turn.status === 'interrupted'
                ? 'Stream interrupted'
                : turn.status === 'skipped'
                  ? 'Too short to analyze'
                  : turn.status === 'pending'
                    ? 'Analyzing emotion...'
                    : turn.emotion}
          </span>
          <span>
            {turn.status === 'resolved' && turn.confidence !== null
              ? `Confidence: ${Math.round(turn.confidence * 100)}%`
              : 'Confidence: --'}
          </span>
        </div>
      ))}
      {assistantDraft ? <p>{assistantDraft}</p> : null}
      {partialTranscript ? <p>{partialTranscript}</p> : null}
      <span>{assistantState}</span>
    </div>
  ),
}));

vi.mock('@/lib/realtimeVoiceClients', () => ({
  createRealtimeVoiceClients: () => ({
    emotionClient: {
      analyzeText: (...args: unknown[]) => analyzeTextMock(...args),
    },
    llmClient: {
      streamResponse: vi.fn(),
    },
    ttsClient: {
      synthesize: vi.fn(),
    },
  }),
}));

vi.mock('@/lib/voiceConversationLoop', () => ({
  createVoiceAudioLoop: ({
    emotionClient,
    callbacks,
  }: {
    emotionClient: { analyzeText: (text: string) => Promise<{ emotion: string; confidence: number }> };
    callbacks: {
      onTurnsChanged: (turns: Array<{
        id: string;
        role: 'user';
        text: string;
        emotion: string | null;
        confidence: number | null;
        status: string;
        timestamp?: string;
      }>) => void;
      onAssistantStateChanged: (state: 'idle' | 'thinking' | 'speaking') => void;
    };
  }) => {
    let turns: Array<{
      id: string;
      role: 'user';
      text: string;
      emotion: string | null;
      confidence: number | null;
      status: 'pending' | 'resolved' | 'failed';
      timestamp?: string;
    }> = [];
    let epoch = 0;

    const publish = () => {
      callbacks.onTurnsChanged([...turns]);
    };

    return {
      handleUserSpeechStart: () => {
        epoch += 1;
        callbacks.onAssistantStateChanged('idle');
      },
      handleFinalizedUtterance: async ({
        id,
        text,
        timestamp,
      }: {
        id: string;
        text: string;
        timestamp?: string;
      }) => {
        const requestEpoch = ++epoch;
        let timeoutId: number | null = null;

        turns = [
          ...turns,
          {
            id,
            role: 'user',
            text,
            emotion: null,
            confidence: null,
            status: 'pending',
            timestamp,
          },
        ];
        publish();
        callbacks.onAssistantStateChanged('thinking');

        try {
          const analysis = await Promise.race([
            emotionClient.analyzeText(text),
            new Promise<never>((_, reject) => {
              timeoutId = window.setTimeout(() => {
                reject(new Error('timeout'));
              }, 8_000);
            }),
          ]);

          if (requestEpoch !== epoch) {
            return;
          }

          turns = turns.map((turn) =>
            turn.id === id
              ? {
                  ...turn,
                  emotion: analysis.emotion,
                  confidence: analysis.confidence,
                  status: 'resolved',
                }
              : turn,
          );
          publish();
        } catch {
          if (requestEpoch !== epoch) {
            return;
          }

          turns = turns.map((turn) =>
            turn.id === id
              ? {
                  ...turn,
                  emotion: 'emotion unavailable',
                  confidence: null,
                  status: 'failed',
                }
              : turn,
          );
          publish();
        } finally {
          if (timeoutId !== null) {
            window.clearTimeout(timeoutId);
          }
          callbacks.onAssistantStateChanged('idle');
        }
      },
    };
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
    fireEvent.click(await screen.findByRole('button', { name: 'Emit final transcript' }));

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
    fireEvent.click(await screen.findByRole('button', { name: 'Emit chunked transcript' }));

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
    fireEvent.click(await screen.findByRole('button', { name: 'Emit utterance end' }));

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
    fireEvent.click(await screen.findByRole('button', { name: 'Emit failing transcript' }));

    expect(await screen.findByText('I feel uncertain')).toBeInTheDocument();

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 1600));
    });

    await waitFor(() => {
      expect(screen.getByText('Emotion unavailable')).toBeInTheDocument();
    });
  });

  it('skips backend analysis for very short filler inputs', async () => {
    render(<Voice />);
    fireEvent.click(await screen.findByRole('button', { name: 'Emit short transcript' }));

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 300));
    });

    expect(screen.queryByText('ok')).not.toBeInTheDocument();
    expect(screen.queryByText('Too short to analyze')).not.toBeInTheDocument();
    expect(analyzeTextMock).not.toHaveBeenCalled();
  });

  it('handles 50 rapid transcript events with debounce and minimal API calls', async () => {
    analyzeTextMock.mockImplementation(async (text: string) => ({
      emotion: text.includes('anxious') ? 'anxious' : 'calm',
      confidence: 0.81,
    }));

    render(<Voice />);
    fireEvent.click(await screen.findByRole('button', { name: 'Emit rapid burst' }));

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
    fireEvent.click(await screen.findByRole('button', { name: 'Emit slow backend transcript' }));

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

  it('holds a short thought through a thinking pause before analyzing', async () => {
    analyzeTextMock.mockResolvedValue({ emotion: 'sad', confidence: 0.79 });

    render(<Voice />);

    act(() => {
      voiceHandlers.onTranscriptChange?.('I think');
      voiceHandlers.onFinalTranscript?.({ id: 'segment-80', transcript: 'I think', speechFinal: true });
    });

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 400));
    });

    expect(analyzeTextMock).not.toHaveBeenCalled();

    act(() => {
      voiceHandlers.onTranscriptChange?.('I think I feel sad.');
      voiceHandlers.onFinalTranscript?.({ id: 'segment-81', transcript: 'I feel sad.', speechFinal: true });
    });

    expect(await screen.findByText('I think I feel sad.')).toBeInTheDocument();

    await waitFor(() => {
      expect(analyzeTextMock).toHaveBeenCalledTimes(1);
      expect(analyzeTextMock).toHaveBeenCalledWith('I think I feel sad.');
      expect(screen.getByText('sad')).toBeInTheDocument();
    });
  });

  it('splits separate punctuated sentences into separate utterances', async () => {
    analyzeTextMock
      .mockResolvedValueOnce({ emotion: 'sad', confidence: 0.71 })
      .mockResolvedValueOnce({ emotion: 'confused', confidence: 0.68 });

    render(<Voice />);

    act(() => {
      voiceHandlers.onTranscriptChange?.('I feel sad.');
      voiceHandlers.onFinalTranscript?.({ id: 'segment-90', transcript: 'I feel sad.', speechFinal: false });
    });

    expect(await screen.findByText('I feel sad.')).toBeInTheDocument();

    act(() => {
      voiceHandlers.onTranscriptChange?.('I feel sad. I do not know why.');
      voiceHandlers.onFinalTranscript?.({ id: 'segment-91', transcript: 'I do not know why.', speechFinal: false });
    });

    expect(await screen.findByText('I do not know why.')).toBeInTheDocument();

    await waitFor(() => {
      expect(analyzeTextMock).toHaveBeenCalledTimes(2);
      expect(analyzeTextMock).toHaveBeenNthCalledWith(1, 'I feel sad.');
      expect(analyzeTextMock).toHaveBeenNthCalledWith(2, 'I do not know why.');
    });
  });

  it('merges a correction into one utterance instead of analyzing the first phrase alone', async () => {
    analyzeTextMock.mockResolvedValue({ emotion: 'sad', confidence: 0.74 });

    render(<Voice />);

    act(() => {
      voiceHandlers.onTranscriptChange?.('I feel happy');
      voiceHandlers.onFinalTranscript?.({ id: 'segment-100', transcript: 'I feel happy', speechFinal: false });
    });

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 250));
    });

    expect(analyzeTextMock).not.toHaveBeenCalled();

    act(() => {
      voiceHandlers.onTranscriptChange?.('I feel happy I mean sad.');
      voiceHandlers.onFinalTranscript?.({ id: 'segment-101', transcript: 'I mean sad.', speechFinal: false });
    });

    expect(await screen.findByText('I feel happy I mean sad.')).toBeInTheDocument();

    await waitFor(() => {
      expect(analyzeTextMock).toHaveBeenCalledTimes(1);
      expect(analyzeTextMock).toHaveBeenCalledWith('I feel happy I mean sad.');
    });
  });

  it('ignores filler pauses and only analyzes the meaningful follow-up', async () => {
    analyzeTextMock.mockResolvedValue({ emotion: 'tired', confidence: 0.72 });

    render(<Voice />);

    act(() => {
      voiceHandlers.onTranscriptChange?.('um');
      voiceHandlers.onFinalTranscript?.({ id: 'segment-110', transcript: 'um', speechFinal: true });
    });

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 250));
    });

    expect(analyzeTextMock).not.toHaveBeenCalled();
    expect(screen.queryByText(/^um$/)).not.toBeInTheDocument();

    act(() => {
      voiceHandlers.onTranscriptChange?.('I feel tired.');
      voiceHandlers.onFinalTranscript?.({ id: 'segment-111', transcript: 'I feel tired.', speechFinal: true });
    });

    expect(await screen.findByText('I feel tired.')).toBeInTheDocument();

    await waitFor(() => {
      expect(analyzeTextMock).toHaveBeenCalledTimes(1);
      expect(analyzeTextMock).toHaveBeenCalledWith('I feel tired.');
      expect(screen.getByText('tired')).toBeInTheDocument();
    });
  });

  it('preserves the current draft when the stream disconnects mid-speech', async () => {
    render(<Voice />);

    act(() => {
      voiceHandlers.onTranscriptChange?.('I was saying something important');
      voiceHandlers.onStreamInterrupted?.({ transcript: 'I was saying something important' });
    });

    expect(await screen.findByText('I was saying something important')).toBeInTheDocument();
    expect(screen.getByText('Stream interrupted')).toBeInTheDocument();
    expect(analyzeTextMock).not.toHaveBeenCalled();
  });

  it('replaces an interrupted draft with the recovered final utterance after reconnect', async () => {
    analyzeTextMock.mockResolvedValue({ emotion: 'calm', confidence: 0.8 });

    render(<Voice />);

    act(() => {
      voiceHandlers.onTranscriptChange?.('I was saying something important');
      voiceHandlers.onStreamInterrupted?.({ transcript: 'I was saying something important' });
    });

    expect(await screen.findByText('Stream interrupted')).toBeInTheDocument();

    act(() => {
      voiceHandlers.onTranscriptChange?.('I was saying something important to me.');
      voiceHandlers.onFinalTranscript?.({
        id: 'segment-140',
        transcript: 'I was saying something important to me.',
        speechFinal: true,
      });
    });

    await waitFor(() => {
      expect(screen.queryByText('Stream interrupted')).not.toBeInTheDocument();
      expect(screen.getByText('I was saying something important to me.')).toBeInTheDocument();
      expect(screen.getByText('calm')).toBeInTheDocument();
    });
  });

  it('ignores delayed analysis responses from an older session after the user restarts', async () => {
    let resolveOlderResponse: ((value: { emotion: string; confidence: number }) => void) | null = null;
    analyzeTextMock
      .mockImplementationOnce(
        () =>
          new Promise<{ emotion: string; confidence: number }>((resolve) => {
            resolveOlderResponse = resolve;
          }),
      )
      .mockResolvedValueOnce({ emotion: 'focused', confidence: 0.76 });

    render(<Voice />);

    act(() => {
      voiceHandlers.onTranscriptChange?.('I feel overwhelmed.');
      voiceHandlers.onFinalTranscript?.({ id: 'segment-120', transcript: 'I feel overwhelmed.', speechFinal: true });
    });

    expect(await screen.findByText('I feel overwhelmed.')).toBeInTheDocument();

    act(() => {
      voiceHandlers.onTranscriptChange?.('');
    });

    act(() => {
      voiceHandlers.onTranscriptChange?.('I am focused now.');
      voiceHandlers.onFinalTranscript?.({ id: 'segment-121', transcript: 'I am focused now.', speechFinal: true });
    });

    expect(await screen.findByText('I am focused now.')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('focused')).toBeInTheDocument();
      expect(analyzeTextMock).toHaveBeenCalledTimes(2);
    });

    await act(async () => {
      resolveOlderResponse?.({ emotion: 'overwhelmed', confidence: 0.91 });
      await Promise.resolve();
    });

    expect(screen.queryByText('overwhelmed')).not.toBeInTheDocument();
    expect(screen.getByText('focused')).toBeInTheDocument();
  });

  it('fails a dropped analysis request instead of leaving the queue stuck', async () => {
    vi.useFakeTimers();
    analyzeTextMock.mockImplementationOnce(() => new Promise(() => undefined));

    render(<Voice />);

    act(() => {
      voiceHandlers.onTranscriptChange?.('This will stall.');
      voiceHandlers.onFinalTranscript?.({ id: 'segment-130', transcript: 'This will stall.', speechFinal: true });
    });

    expect(screen.getByText('This will stall.')).toBeInTheDocument();
    expect(screen.getByText('Analyzing emotion...')).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(8_100);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText('Emotion unavailable')).toBeInTheDocument();
    vi.useRealTimers();
  });
});
