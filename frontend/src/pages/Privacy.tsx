import { motion } from 'framer-motion';
import { FileText, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import BackButton from '@/components/navigation/BackButton';

const privacySections = [
  {
    title: 'What Emoiva stores',
    points: [
      'Account details needed to sign in and maintain access.',
      'Conversation history and emotional analysis generated during product use.',
      'Operational logs needed to keep sessions stable, secure, and debuggable.',
    ],
  },
  {
    title: 'How data is used',
    points: [
      'To provide voice sessions, personalized continuity, and insight summaries inside the product.',
      'To improve reliability, fix failures, and maintain a safe and coherent user experience.',
      'To support account recovery, customer support, and service monitoring when necessary.',
    ],
  },
  {
    title: 'What Emoiva does not promise',
    points: [
      'Emoiva is not a replacement for licensed clinical care or emergency services.',
      'The product should support reflection and emotional awareness, but it should not be treated as a crisis service.',
      'If someone may be in immediate danger, they should contact local emergency services or a trusted person immediately.',
    ],
  },
];

const termsSections = [
  {
    title: 'Acceptable use',
    body: 'Use the product lawfully and respectfully. Do not attempt to abuse sessions, scrape protected data, or disrupt service availability for other users.',
  },
  {
    title: 'Accounts and access',
    body: 'Users are responsible for maintaining access to their account credentials and for activity that occurs under their account unless otherwise reported.',
  },
  {
    title: 'Product changes',
    body: 'Features, limits, pricing, and support flows may evolve as the product improves. Material changes should be reflected in the product experience or this page.',
  },
  {
    title: 'Contact',
    body: 'Questions about privacy, usage, or support can be sent to arpitshivhare525@gmail.com.',
  },
];

const Privacy = () => {
  return (
    <div className="min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-20 top-24 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-insight/5 blur-3xl" />
      </div>

      <header className="relative z-10 px-6 py-6 md:px-12">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BackButton fallbackTo="/" />
            <Link to="/" className="inline-flex items-center">
              <img
                src="/emoiva-logo.png"
                alt="Emoiva"
                className="h-12 w-auto max-w-[220px] object-contain md:h-14"
              />
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link to="/support">Help</Link>
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
                <ShieldCheck className="h-4 w-4" />
                Privacy & Terms
              </div>
              <div className="space-y-3">
                <h1 className="text-4xl font-extrabold tracking-tight text-foreground md:text-6xl">
                  Clear policies for a sensitive product
                </h1>
                <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
                  Emoiva is an emotion-aware voice product. The policy language here is written to be clear,
                  practical, and aligned with how the product actually behaves.
                </p>
              </div>
            </div>

            <div className="rounded-[1.75rem] bg-secondary/45 p-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-foreground">
                  <LockKeyhole className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-semibold">Principles</h2>
                </div>
                <div className="rounded-2xl bg-background/70 p-4 text-sm leading-relaxed text-muted-foreground">
                  Emoiva should collect only what is required to run the product, maintain continuity, and support the user experience.
                </div>
                <div className="rounded-2xl bg-background/70 p-4 text-sm leading-relaxed text-muted-foreground">
                  The product should not expose internal provider details or technical diagnostics to users when a simple product-safe message is enough.
                </div>
                <div className="rounded-2xl bg-background/70 p-4 text-sm leading-relaxed text-muted-foreground">
                  Users should be able to understand what the product does with their data without reading legal filler.
                </div>
              </div>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.05 }}
            className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]"
          >
            <div className="space-y-6">
              {privacySections.map((section) => (
                <section key={section.title} className="glass-card rounded-[2rem] p-6 md:p-8">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-primary" />
                    <h2 className="text-xl font-semibold text-foreground">{section.title}</h2>
                  </div>
                  <ul className="mt-5 space-y-3 text-sm leading-relaxed text-muted-foreground">
                    {section.points.map((point) => (
                      <li key={point} className="rounded-2xl border border-border bg-background/60 p-4">
                        {point}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>

            <div className="glass-card rounded-[2rem] p-6 md:p-8">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Terms</h2>
              </div>
              <div className="mt-5 space-y-4">
                {termsSections.map((section) => (
                  <div key={section.title} className="rounded-2xl border border-border bg-background/60 p-4">
                    <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{section.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.section>
        </div>
      </main>
    </div>
  );
};

export default Privacy;
