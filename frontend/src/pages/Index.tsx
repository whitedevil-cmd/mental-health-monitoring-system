import VoiceRecorder from '@/components/VoiceRecorder';
import { NavLink } from '@/components/NavLink';
import { LayoutDashboard } from 'lucide-react';

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden"
         style={{ background: 'var(--gradient-warm)' }}>
      {/* Decorative blobs */}
      <div className="absolute top-[-10%] right-[-5%] w-72 h-72 rounded-full bg-primary/5 blur-3xl" />
      <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 rounded-full bg-accent/10 blur-3xl" />
      
      <div className="absolute top-4 right-4 z-20">
        <NavLink to="/dashboard">
          <LayoutDashboard className="h-4 w-4" />
          Dashboard
        </NavLink>
      </div>

      <div className="relative z-10 flex flex-col items-center gap-6">
        <div className="text-center space-y-1.5 mb-2">
          <p className="text-sm font-medium tracking-widest uppercase text-muted-foreground">Mindful</p>
          <h1 className="text-2xl font-semibold text-foreground" style={{ fontFamily: "'Fraunces', serif" }}>
            Your safe space
          </h1>
        </div>
        <VoiceRecorder />
      </div>
    </div>
  );
};

export default Index;
