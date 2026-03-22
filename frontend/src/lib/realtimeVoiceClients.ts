import { apiClient, API_BASE } from '@/lib/apiClient';
import type {
  EmotionClient,
  LlmClient,
  TtsClient,
  TtsSynthesisContext,
} from '@/lib/voiceConversationLoop';

type AssistantStreamEvent =
  | { type: 'token'; text: string }
  | { type: 'done' };

const createNdjsonStream = async function* (
  stream: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncIterable<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      if (signal?.aborted) {
        throw new DOMException('The operation was aborted.', 'AbortError');
      }

      const { value, done } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          continue;
        }

        const event = JSON.parse(trimmed) as AssistantStreamEvent;
        if (event.type === 'token') {
          yield event.text;
        }
      }
    }

    const last = buffer.trim();
    if (last) {
      const event = JSON.parse(last) as AssistantStreamEvent;
      if (event.type === 'token') {
        yield event.text;
      }
    }
  } finally {
    reader.releaseLock();
  }
};

export const createRealtimeVoiceClients = (
  userId?: string | null,
): {
  emotionClient: EmotionClient;
  llmClient: LlmClient;
  ttsClient: TtsClient;
} => {
  const emotionClient: EmotionClient = {
    analyzeText: (text, signal) => apiClient.analyzeText(text, signal),
  };

  const llmClient: LlmClient = {
    async streamResponse(messages, signal) {
      const response = await fetch(`${API_BASE}/api/v1/assistant/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages,
          user_id: userId ?? undefined,
        }),
        signal,
      });

      if (!response.ok || !response.body) {
        const details = await response.text().catch(() => '');
        throw new Error(`Assistant stream failed: ${response.status} ${details}`);
      }

      return createNdjsonStream(response.body, signal);
    },
  };

  const ttsClient: TtsClient = {
    async synthesize(text, signal, context?: TtsSynthesisContext) {
      const normalizedText = text.trim();
      if (!normalizedText) {
        throw new Error('Skipped empty TTS chunk.');
      }

      const response = await fetch(`${API_BASE}/api/v1/assistant/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: normalizedText,
          previous_text: context?.previousText,
          next_text: context?.nextText,
        }),
        signal,
      });

      if (!response.ok) {
        const details = await response.text().catch(() => '');
        throw new Error(`Assistant TTS failed: ${response.status} ${details}`);
      }

      return response.arrayBuffer();
    },
  };

  return {
    emotionClient,
    llmClient,
    ttsClient,
  };
};
