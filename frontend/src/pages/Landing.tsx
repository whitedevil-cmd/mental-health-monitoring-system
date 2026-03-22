import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Heart, Shield, Brain, Mic } from 'lucide-react';

const features = [
  { icon: Mic, title: 'Realtime Voice Sessions', desc: 'Speak naturally and let Emoiva respond in the flow of conversation.' },
  { icon: Brain, title: 'Emotion Intelligence', desc: 'Advanced models detect subtle emotional patterns in your voice.' },
  { icon: Heart, title: 'Personalized Support', desc: 'Receive emotionally-aware replies shaped by your recent context and patterns.' },
  { icon: Shield, title: 'Private & Secure', desc: 'Your conversations are encrypted and handled with care.' },
];

const Landing = () => {
  const { user, loading } = useAuth();
  if (!loading && user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-20 -left-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl animate-breathe" />
        <div className="absolute bottom-20 -right-32 h-80 w-80 rounded-full bg-accent/10 blur-3xl animate-breathe" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-insight/5 blur-3xl animate-float" />
      </div>

      <header className="relative z-10 flex items-center justify-between px-6 py-6 md:px-12">
        <img
          src="/emoiva-logo.png"
          alt="Emoiva"
          className="h-12 w-auto max-w-[220px] object-contain md:h-14"
        />
        <div className="flex gap-3">
          <Button variant="ghost" asChild><Link to="/support">Help</Link></Button>
          <Button variant="ghost" asChild><Link to="/portfolio">Portfolio</Link></Button>
          <Button variant="ghost" asChild><Link to="/login">Sign in</Link></Button>
          <Button variant="hero" asChild><Link to="/signup">Get started</Link></Button>
        </div>
      </header>

      <section className="relative z-10 flex flex-col items-center justify-center px-6 pt-16 pb-24 text-center md:pt-28 md:pb-32">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl"
        >
          <span className="mb-4 inline-block rounded-full bg-secondary px-4 py-1.5 text-sm font-medium text-primary">
            Emotion-aware voice support
          </span>
          <h2 className="text-4xl font-extrabold leading-tight text-foreground md:text-6xl">
            A safe space to <span className="text-primary">be heard</span>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
            Talk openly. Emoiva listens to your voice, tracks emotional signals in realtime, and
            answers with grounded, personalized support.
          </p>
          <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
            <Button variant="hero" size="xl" asChild>
              <Link to="/signup">Start your journey</Link>
            </Button>
            <Button variant="soft" size="xl" asChild>
              <Link to="/login">I have an account</Link>
            </Button>
          </div>
        </motion.div>
      </section>

      <section className="relative z-10 px-6 pb-24 md:px-12">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 * index }}
              className="glass-card rounded-3xl p-6 text-center transition-shadow hover:shadow-xl"
            >
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                <feature.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mb-2 font-semibold text-foreground">{feature.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="relative z-10 px-6 pb-20">
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="mx-auto max-w-3xl rounded-3xl p-10 text-center glass-card md:p-14"
        >
          <h3 className="mb-4 text-2xl font-bold text-foreground md:text-3xl">
            You deserve support that feels personal
          </h3>
          <p className="mx-auto mb-8 max-w-xl text-muted-foreground">
            Whether you feel overwhelmed, anxious, reflective, or simply need a calm space to talk,
            Emoiva is designed to respond with emotional awareness and continuity.
          </p>
          <Button variant="hero" size="xl" asChild>
            <Link to="/signup">Begin now - it&apos;s free</Link>
          </Button>
        </motion.div>
      </section>

      <footer className="relative z-10 border-t border-border/60 px-6 py-8 md:px-12">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Emoiva</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Emotion-aware voice support, personalized guidance, and product care that feels deliberate.
            </p>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <Link to="/support" className="transition-colors hover:text-foreground">Help</Link>
            <Link to="/privacy" className="transition-colors hover:text-foreground">Privacy & Terms</Link>
            <Link to="/portfolio" className="transition-colors hover:text-foreground">Portfolio</Link>
            <a
              href="https://linkedin.com/in/arpitshivhare/"
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-foreground"
            >
              LinkedIn
            </a>
            <a
              href="https://instagram.com/iarpitshivhare"
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-foreground"
            >
              Instagram
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
