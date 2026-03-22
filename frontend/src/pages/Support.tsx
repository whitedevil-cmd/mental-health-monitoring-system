import { motion } from 'framer-motion';
import { ArrowUpRight, HeartHandshake, Instagram, LifeBuoy, Linkedin, Mail, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const supportChannels = [
  {
    label: 'Email',
    value: 'arpitshivhare525@gmail.com',
    href: 'mailto:arpitshivhare525@gmail.com',
    icon: Mail,
    hint: 'Best for product questions, support requests, and collaborations.',
  },
  {
    label: 'Phone',
    value: '+91-6260962016',
    href: 'tel:+916260962016',
    icon: Phone,
    hint: 'For direct contact and urgent follow-up.',
  },
  {
    label: 'LinkedIn',
    value: 'linkedin.com/in/arpitshivhare',
    href: 'https://linkedin.com/in/arpitshivhare/',
    icon: Linkedin,
    hint: 'Professional background, portfolio context, and networking.',
  },
  {
    label: 'Instagram',
    value: '@iarpitshivhare',
    href: 'https://instagram.com/iarpitshivhare',
    icon: Instagram,
    hint: 'Social presence and creator updates.',
  },
];

const supportPrinciples = [
  'Emoiva is designed to be calm, respectful, and easy to use.',
  'Support requests are handled with privacy in mind and shared only when needed to resolve an issue.',
  'The product experience is built to keep language clear, emotionally appropriate, and non-invasive.',
  'If a session fails, the product should guide the user back without technical jargon or provider-facing errors.',
];

const Support = () => {
  return (
    <div className="min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-20 top-24 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-insight/5 blur-3xl" />
      </div>

      <header className="relative z-10 px-6 py-6 md:px-12">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <Link to="/" className="inline-flex items-center">
            <img
              src="/emoiva-logo.png"
              alt="Emoiva"
              className="h-12 w-auto max-w-[220px] object-contain md:h-14"
            />
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link to="/privacy">Privacy & Terms</Link>
            </Button>
            <Button variant="hero" asChild>
              <a href="mailto:arpitshivhare525@gmail.com">Contact</a>
            </Button>
          </div>
        </div>
      </header>

      <main className="relative z-10 px-6 pb-20 md:px-12">
        <div className="mx-auto max-w-6xl space-y-8">
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="grid gap-6 rounded-[2rem] border border-border/70 bg-card/70 p-6 shadow-xl backdrop-blur md:grid-cols-[1.1fr_0.9fr] md:p-10"
          >
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
                <LifeBuoy className="h-4 w-4" />
                Help & Contact
              </div>
              <div className="space-y-3">
                <h1 className="text-4xl font-extrabold tracking-tight text-foreground md:text-6xl">
                  Support that matches the product
                </h1>
                <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
                  Emoiva is built to feel clear, supportive, and trustworthy. If you need help,
                  want to report an issue, or want to discuss the product, use the contact options below.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {supportChannels.map((channel) => (
                  <a
                    key={channel.label}
                    href={channel.href}
                    target={channel.href.startsWith('http') ? '_blank' : undefined}
                    rel={channel.href.startsWith('http') ? 'noreferrer' : undefined}
                    className="rounded-2xl border border-border bg-background/65 p-4 transition-colors hover:bg-secondary/70"
                  >
                    <div className="flex items-center gap-3">
                      <channel.icon className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium text-foreground">{channel.label}</span>
                      {channel.href.startsWith('http') ? (
                        <ArrowUpRight className="ml-auto h-4 w-4 text-muted-foreground" />
                      ) : null}
                    </div>
                    <p className="mt-3 text-sm text-foreground">{channel.value}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{channel.hint}</p>
                  </a>
                ))}
              </div>
            </div>

            <div className="rounded-[1.75rem] bg-secondary/45 p-6">
              <div className="flex items-center gap-3 text-foreground">
                <HeartHandshake className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">What to expect</h2>
              </div>
              <div className="mt-5 space-y-3">
                {supportPrinciples.map((principle) => (
                  <div key={principle} className="rounded-2xl bg-background/70 p-4 text-sm leading-relaxed text-muted-foreground">
                    {principle}
                  </div>
                ))}
              </div>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.05 }}
            className="grid gap-6 lg:grid-cols-2"
          >
            <div className="glass-card rounded-[2rem] p-6 md:p-8">
              <h2 className="text-xl font-semibold text-foreground">Product support</h2>
              <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
                <p>Use this page if you experience trouble with voice sessions, account access, history, or insight pages.</p>
                <p>Messages should be answered in a way that is useful to the user, not written as raw technical diagnostics.</p>
                <p>If a product issue affects trust or session continuity, that gets higher priority.</p>
              </div>
            </div>

            <div className="glass-card rounded-[2rem] p-6 md:p-8">
              <h2 className="text-xl font-semibold text-foreground">Portfolio contact</h2>
              <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
                <p>For partnerships, hiring, product collaboration, or portfolio conversations, contact Arpit Shivhare directly.</p>
                <div className="flex flex-wrap gap-3 pt-2">
                  <Button variant="soft" asChild>
                    <Link to="/portfolio">View Portfolio</Link>
                  </Button>
                  <Button variant="hero" asChild>
                    <a href="mailto:arpitshivhare525@gmail.com">Start a conversation</a>
                  </Button>
                </div>
              </div>
            </div>
          </motion.section>
        </div>
      </main>
    </div>
  );
};

export default Support;
