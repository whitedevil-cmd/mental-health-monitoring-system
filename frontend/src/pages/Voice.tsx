import { useState } from 'react';
import { motion } from 'framer-motion';
import AppLayout from '@/components/layout/AppLayout';
import VoiceRecorder from '@/components/voice/VoiceRecorder';
import TranscriptPanel from '@/components/voice/TranscriptPanel';
import EmotionProbabilityBars from '@/components/voice/EmotionProbabilityBars';
import SupportResponseCard from '@/components/voice/SupportResponseCard';
import { EmotionScore } from '@/types';

const Voice = () => {
  const [transcript, setTranscript] = useState('');
  const [emotions, setEmotions] = useState<EmotionScore[]>([]);
  const [aiResponse, setAiResponse] = useState('');

  const handleResult = (data: { transcript: string; emotions: EmotionScore[]; aiResponse: string }) => {
    setTranscript(data.transcript);
    setEmotions(data.emotions);
    setAiResponse(data.aiResponse);
  };

  const handleTranscriptChange = (nextTranscript: string) => {
    setTranscript(nextTranscript);
    setEmotions([]);
    setAiResponse('');
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground">Voice Session</h1>
          <p className="text-muted-foreground mt-2">Speak freely — I'm listening with care</p>
        </motion.div>

        <div className="flex flex-col items-center mb-10">
          <VoiceRecorder onResult={handleResult} onTranscriptChange={handleTranscriptChange} />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-6">
            <TranscriptPanel transcript={transcript} />
            <SupportResponseCard response={aiResponse} />
          </div>
          <div className="glass-card rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-wider">Emotional Analysis</h3>
            <EmotionProbabilityBars emotions={emotions} />
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Voice;
