import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Heart, Shield, Brain, Mic } from 'lucide-react';

const features = [
  { icon: Mic, title: 'Voice Analysis', desc: 'Speak naturally — our AI listens and understands how you feel.' },
  { icon: Brain, title: 'Emotion Intelligence', desc: 'Advanced models detect subtle emotional patterns in your voice.' },
  { icon: Heart, title: 'Compassionate Support', desc: 'Receive thoughtful, personalized responses that truly help.' },
  { icon: Shield, title: 'Private & Secure', desc: 'Your conversations are encrypted and completely confidential.' },
];

const Landing = () => {
  const { user, loading } = useAuth();
  if (!loading && user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-background overflow-hidden relative">
      {/* Ambient background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 -left-32 w-96 h-96 rounded-full bg-primary/10 blur-3xl animate-breathe" />
        <div className="absolute bottom-20 -right-32 w-80 h-80 rounded-full bg-accent/10 blur-3xl animate-breathe" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-insight/5 blur-3xl animate-float" />
      </div>

      {/* Nav */}
      <header className="relative z-10 flex items-center justify-between px-6 md:px-12 py-6">
        <h1 className="text-2xl font-bold text-foreground">SereneAI</h1>
        <div className="flex gap-3">
          <Button variant="ghost" asChild><Link to="/login">Sign in</Link></Button>
          <Button variant="hero" asChild><Link to="/signup">Get started</Link></Button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 flex flex-col items-center justify-center text-center px-6 pt-16 pb-24 md:pt-28 md:pb-32">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl"
        >
          <span className="inline-block mb-4 px-4 py-1.5 rounded-full bg-secondary text-primary text-sm font-medium">
            Your AI mental health companion
          </span>
          <h2 className="text-4xl md:text-6xl font-extrabold text-foreground leading-tight">
            A safe space to{' '}
            <span className="text-primary">be heard</span>
          </h2>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Talk openly. SereneAI listens to your voice, understands your emotions, 
            and offers gentle, personalized support — whenever you need it.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="hero" size="xl" asChild>
              <Link to="/signup">Start your journey</Link>
            </Button>
            <Button variant="soft" size="xl" asChild>
              <Link to="/login">I have an account</Link>
            </Button>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="relative z-10 px-6 md:px-12 pb-24">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 * i }}
              className="glass-card rounded-3xl p-6 text-center hover:shadow-xl transition-shadow"
            >
              <div className="mx-auto mb-4 w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                <f.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 px-6 pb-20">
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto glass-card rounded-3xl p-10 md:p-14 text-center"
        >
          <h3 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
            You deserve to feel supported
          </h3>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Whether you're feeling overwhelmed, anxious, or just need someone to talk to — 
            SereneAI is here, 24/7, without judgment.
          </p>
          <Button variant="hero" size="xl" asChild>
            <Link to="/signup">Begin now — it's free</Link>
          </Button>
        </motion.div>
      </section>
    </div>
  );
};

export default Landing;
