import { MessageCircle, Lightbulb, Heart } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { AiMessage } from '@/hooks/use-dashboard-data';

const TYPE_CONFIG = {
  insight: { icon: MessageCircle, color: 'hsl(220, 60%, 55%)' },
  suggestion: { icon: Lightbulb, color: 'hsl(45, 80%, 55%)' },
  affirmation: { icon: Heart, color: 'hsl(var(--success))' },
} as const;

function timeAgo(date: Date): string {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

interface AiSupportPanelProps {
  messages: AiMessage[];
}

export default function AiSupportPanel({ messages }: AiSupportPanelProps) {
  return (
    <Card className="border-0 h-full" style={{ background: 'var(--gradient-card)', boxShadow: 'var(--shadow-soft)' }}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium text-foreground">AI Support</CardTitle>
        <p className="text-xs text-muted-foreground">Personalized insights & suggestions</p>
      </CardHeader>
      <CardContent className="pb-4">
        <ScrollArea className="h-52">
          <div className="flex flex-col gap-3 pr-3">
            {messages.map((msg) => {
              const config = TYPE_CONFIG[msg.type];
              const Icon = config.icon;
              return (
                <div key={msg.id} className="flex gap-3 items-start">
                  <div
                    className="mt-0.5 h-7 w-7 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: `${config.color}15` }}
                  >
                    <Icon className="h-3.5 w-3.5" style={{ color: config.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground leading-relaxed">{msg.text}</p>
                    <p className="text-xs text-muted-foreground mt-1">{timeAgo(msg.timestamp)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
