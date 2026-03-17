import { VoiceSessionState } from '@/types';

interface VoiceStreamClientProps {
  state: VoiceSessionState;
}

/**
 * VoiceStreamClient - Ready for real-time streaming integration.
 * Will connect to /api/v1/voice-stream when backend streaming is implemented.
 * 
 * UI States supported:
 * - connecting: WebSocket handshake
 * - listening: Streaming audio to server
 * - processing: Server analyzing audio
 * - responding: AI response streaming back
 */
const VoiceStreamClient = ({ state }: VoiceStreamClientProps) => {
  const statusMessages = {
    idle: '',
    connecting: 'Connecting to SereneAI…',
    listening: 'Listening to you…',
    processing: 'Understanding your emotions…',
    responding: 'Composing a response…',
  };

  if (state.status === 'idle') return null;

  return (
    <div className="text-center py-4">
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary text-sm text-primary">
        <span className="w-2 h-2 rounded-full bg-primary animate-breathe" />
        {statusMessages[state.status]}
      </div>
    </div>
  );
};

export default VoiceStreamClient;
