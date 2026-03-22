import { useEffect, useState } from 'react';

import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/use-toast';

const STORAGE_KEY = 'emoiva.preferences';

type UserPreferences = {
  autoPlayVoice: boolean;
  assistantAnimations: boolean;
  patientPauseHandling: boolean;
  showSessionHistory: boolean;
};

const defaultPreferences: UserPreferences = {
  autoPlayVoice: true,
  assistantAnimations: true,
  patientPauseHandling: true,
  showSessionHistory: true,
};

const Preferences = () => {
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      setLoaded(true);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<UserPreferences>;
      setPreferences({ ...defaultPreferences, ...parsed });
    } catch {
      setPreferences(defaultPreferences);
    }

    setLoaded(true);
  }, []);

  const updatePreference = <T extends keyof UserPreferences>(key: T, value: UserPreferences[T]) => {
    setPreferences((current) => ({ ...current, [key]: value }));
  };

  const handleSave = () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    toast({
      title: 'Preferences saved',
      description: 'Your Emoiva preferences were updated.',
    });
  };

  if (!loaded) {
    return null;
  }

  const items: Array<{
    key: keyof UserPreferences;
    title: string;
    description: string;
  }> = [
    {
      key: 'autoPlayVoice',
      title: 'Auto-play assistant voice',
      description: 'Start spoken responses automatically after a voice session reply is ready.',
    },
    {
      key: 'assistantAnimations',
      title: 'Assistant speaking animation',
      description: 'Show the live assistant orb and tone animation during active responses.',
    },
    {
      key: 'patientPauseHandling',
      title: 'Wait through short pauses',
      description: 'Bias voice sessions to wait through short natural pauses before replying.',
    },
    {
      key: 'showSessionHistory',
      title: 'Show session history in the app',
      description: 'Keep recent conversations visible from the history section.',
    },
  ];

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="glass-card rounded-3xl p-6 md:p-8">
          <h1 className="text-2xl font-bold text-foreground">Preferences</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Control how Emoiva feels during sessions and across the app.
          </p>
        </div>

        <div className="glass-card space-y-4 rounded-3xl p-6 md:p-8">
          {items.map((item) => (
            <div
              key={item.key}
              className="flex items-start justify-between gap-4 rounded-2xl border border-border/70 bg-background/50 p-4"
            >
              <div className="space-y-1">
                <p className="font-medium text-foreground">{item.title}</p>
                <p className="text-sm leading-relaxed text-muted-foreground">{item.description}</p>
              </div>
              <Switch
                checked={preferences[item.key]}
                onCheckedChange={(checked) => updatePreference(item.key, checked)}
              />
            </div>
          ))}

          <Button type="button" variant="hero" size="lg" onClick={handleSave} className="w-full md:w-auto">
            Save preferences
          </Button>
        </div>
      </div>
    </AppLayout>
  );
};

export default Preferences;
