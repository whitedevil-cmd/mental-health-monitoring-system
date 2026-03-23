import { motion } from 'framer-motion';
import {
  ArrowUpRight,
  Award,
  BookOpen,
  Brain,
  Briefcase,
  GraduationCap,
  Instagram,
  Linkedin,
  Mail,
  MapPin,
  Phone,
  Sparkles,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import BackButton from '@/components/navigation/BackButton';

const skills = [
  'Python',
  'C++',
  'SQL',
  'HTML/CSS',
  'JavaScript',
  'Machine Learning',
  'Data Analytics',
  'Data Visualization',
  'Scikit-learn',
  'FastAPI',
  'Power BI',
  'REST API Debugging',
  'Git',
  'GitHub',
  'Agile Methodology',
];

const projects = [
  {
    title: 'AI Therapist',
    period: '2026',
    summary:
      'Built a realtime voice-based emotional support product with natural conversation flow, personalized memory, and low-latency voice interaction.',
    highlights: [
      'Designed natural full-duplex voice interaction with interruption-aware behavior.',
      'Built resilient session state, memory, and persistence flows for a product-ready experience.',
      'Shaped the experience around emotional awareness, responsiveness, and user trust.',
    ],
  },
  {
    title: 'Gurgaon House Price Predictor',
    period: '08/25 - 09/25',
    summary:
      'Created a machine learning pipeline using Random Forest Regressor to predict house prices accurately.',
    highlights: [
      'Handled missing values, scaling, and categorical features.',
      'Automated reusable preprocessing and model packaging with joblib.',
      'Built an end-to-end deployment-ready prediction pipeline.',
    ],
  },
  {
    title: 'Live Face Recognition using DeepFace',
    period: '05/25 - 06/25',
    summary:
      'Developed a realtime face recognition system with DeepFace and OpenCV for reliable verification flows.',
    highlights: [
      'Detected faces from live video streams.',
      'Matched captured faces against a pretrained 3D face model.',
      'Improved authentication speed and reliability.',
    ],
  },
  {
    title: 'Plant Disease Prediction using CNN',
    period: '03/25 - 04/25',
    summary:
      'Built a deep learning image classification system using CNNs and the PlantVillage dataset.',
    highlights: [
      'Trained and evaluated convolutional models for plant disease detection.',
      'Supported faster agricultural decision-making with automated diagnosis support.',
    ],
  },
];

const certifications = [
  'Data Science with Python Certification by codewithharry.com',
  'Business Analytics for Decision Making by University of Colorado Boulder',
  'Advanced Graph Theory Programming Camp by AlgoUniversity',
];

const sectionVariants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.42 } },
};

const Founder = () => {
  return (
    <div className="min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-20 top-24 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-insight/5 blur-3xl" />
      </div>

      <header className="relative z-10 px-6 py-6 md:px-12">
        <div className="mx-auto max-w-6xl">
          <div className="space-y-4 md:hidden">
            <div className="flex items-center justify-between gap-3">
              <BackButton fallbackTo="/" className="-ml-2 px-2.5 text-[15px]" />
              <Link to="/" className="inline-flex min-w-0 items-center justify-end">
                <img
                  src="/emoiva-logo.png"
                  alt="Emoiva"
                  className="h-11 w-auto max-w-[170px] object-contain"
                />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="ghost" asChild className="h-11 w-full rounded-2xl">
                <Link to="/support">Contact</Link>
              </Button>
              <Button variant="hero" asChild className="h-11 w-full rounded-2xl">
                <a href="mailto:arpitshivhare525@gmail.com">Hire Him</a>
              </Button>
            </div>
          </div>

          <div className="hidden items-center justify-between md:flex">
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
                <Link to="/support">Contact</Link>
              </Button>
              <Button variant="hero" asChild>
                <a href="mailto:arpitshivhare525@gmail.com">Hire Him</a>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 px-6 pb-20 md:px-12">
        <motion.div
          initial="hidden"
          animate="show"
          transition={{ staggerChildren: 0.08 }}
          className="mx-auto max-w-6xl space-y-8"
        >
          <motion.section
            variants={sectionVariants}
            className="grid gap-6 rounded-[2rem] border border-border/70 bg-card/70 p-6 shadow-xl backdrop-blur md:grid-cols-[1.3fr_0.7fr] md:p-10"
          >
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
                <Sparkles className="h-4 w-4" />
                Portfolio
              </div>
              <div className="space-y-3">
                <h1 className="text-4xl font-extrabold tracking-tight text-foreground md:text-6xl">
                  Arpit Shivhare
                </h1>
                <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
                  Data Science-focused engineering professional with hands-on experience in data
                  analysis, feature engineering, machine learning, and deployment-ready systems.
                </p>
                <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
                  He builds practical AI products that move from notebooks to real users, spanning
                  predictive modeling, realtime systems, and polished user-facing delivery.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <a
                  href="tel:+916260962016"
                  className="flex items-center gap-3 rounded-2xl border border-border bg-background/60 px-4 py-3 text-sm text-foreground transition-colors hover:bg-secondary/70"
                >
                  <Phone className="h-4 w-4 text-primary" />
                  <span>+91-6260962016</span>
                </a>
                <a
                  href="mailto:arpitshivhare525@gmail.com"
                  className="flex items-center gap-3 rounded-2xl border border-border bg-background/60 px-4 py-3 text-sm text-foreground transition-colors hover:bg-secondary/70"
                >
                  <Mail className="h-4 w-4 text-primary" />
                  <span className="truncate">arpitshivhare525@gmail.com</span>
                </a>
                <a
                  href="https://github.com/whitedevil-cmd"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 rounded-2xl border border-border bg-background/60 px-4 py-3 text-sm text-foreground transition-colors hover:bg-secondary/70"
                >
                  <Briefcase className="h-4 w-4 text-primary" />
                  <span>GitHub</span>
                  <ArrowUpRight className="ml-auto h-4 w-4 text-muted-foreground" />
                </a>
                <a
                  href="https://linkedin.com/in/arpitshivhare/"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 rounded-2xl border border-border bg-background/60 px-4 py-3 text-sm text-foreground transition-colors hover:bg-secondary/70"
                >
                  <Linkedin className="h-4 w-4 text-primary" />
                  <span>LinkedIn</span>
                  <span className="ml-auto text-xs text-muted-foreground">linkedin.com/in/arpitshivhare</span>
                </a>
                <a
                  href="https://instagram.com/iarpitshivhare"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 rounded-2xl border border-border bg-background/60 px-4 py-3 text-sm text-foreground transition-colors hover:bg-secondary/70"
                >
                  <Instagram className="h-4 w-4 text-primary" />
                  <span>Instagram</span>
                  <span className="ml-auto text-xs text-muted-foreground">@iarpitshivhare</span>
                </a>
              </div>
            </div>

            <div className="flex flex-col justify-between gap-6 rounded-[1.75rem] bg-secondary/45 p-6">
              <div className="space-y-4">
                <div className="overflow-hidden rounded-[1.75rem] border border-border/70 bg-background/70">
                  <img
                    src="/arpit-photo.jpeg"
                    alt="Arpit Shivhare"
                    className="h-72 w-full object-cover object-top"
                  />
                </div>
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
                    Build Signal
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">Hire him</p>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Strong across AI systems, ML workflows, and product-minded engineering delivery.
                </p>
              </div>

              <div className="grid gap-3">
                <div className="rounded-2xl bg-background/70 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <GraduationCap className="h-4 w-4 text-primary" />
                    Education
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    B.Tech in Computer Science and Engineering
                  </p>
                </div>
                <div className="rounded-2xl bg-background/70 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <MapPin className="h-4 w-4 text-primary" />
                    Location
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">Bhubaneswar, India</p>
                </div>
              </div>
            </div>
          </motion.section>

          <motion.section variants={sectionVariants} className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="glass-card rounded-[2rem] p-6 md:p-8">
              <div className="mb-5 flex items-center gap-3">
                <Brain className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Profile</h2>
              </div>
              <p className="leading-relaxed text-muted-foreground">
                Data Science-focused engineering professional with hands-on experience in data
                analysis, exploratory data analysis, feature engineering, and machine learning.
                Skilled in building predictive models and deployment-ready pipelines using Python and
                modern data science libraries.
              </p>
            </div>

            <div className="glass-card rounded-[2rem] p-6 md:p-8">
              <div className="mb-5 flex items-center gap-3">
                <GraduationCap className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Education</h2>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-lg font-semibold text-foreground">
                    Kalinga Institute of Industrial Technology
                  </p>
                  <p className="text-sm text-muted-foreground">Bhubaneswar, India</p>
                </div>
                <div className="rounded-2xl border border-border bg-background/60 p-4">
                  <p className="font-medium text-foreground">
                    Bachelor of Technology in Computer Science and Engineering
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">2022 - 2026</p>
                  <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
                    <li>Built strong technical foundations through hands-on projects and applied coursework.</li>
                    <li>
                      Relevant coursework: Data Science, Machine Learning, Data Analytics, Frontend,
                      Backend, and Software Development.
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </motion.section>

          <motion.section variants={sectionVariants} className="glass-card rounded-[2rem] p-6 md:p-8">
            <div className="mb-5 flex items-center gap-3">
              <BookOpen className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">Skills</h2>
            </div>
            <div className="flex flex-wrap gap-3">
              {skills.map((skill) => (
                <span
                  key={skill}
                  className="rounded-full border border-border bg-secondary/60 px-4 py-2 text-sm font-medium text-foreground"
                >
                  {skill}
                </span>
              ))}
            </div>
          </motion.section>

          <motion.section variants={sectionVariants} className="space-y-4">
            <div className="flex items-center gap-3">
              <Briefcase className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">Projects</h2>
            </div>
            <div className="grid gap-4">
              {projects.map((project) => (
                <article key={project.title} className="glass-card rounded-[2rem] p-6 md:p-8">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h3 className="text-xl font-semibold text-foreground">{project.title}</h3>
                      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                        {project.summary}
                      </p>
                    </div>
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                      {project.period}
                    </span>
                  </div>
                  <ul className="mt-5 space-y-2 text-sm leading-relaxed text-muted-foreground">
                    {project.highlights.map((highlight) => (
                      <li key={highlight}>- {highlight}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </motion.section>

          <motion.section variants={sectionVariants} className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="glass-card rounded-[2rem] p-6 md:p-8">
              <div className="mb-5 flex items-center gap-3">
                <Award className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Certifications</h2>
              </div>
              <ul className="space-y-3 text-sm leading-relaxed text-muted-foreground">
                {certifications.map((item) => (
                  <li key={item} className="rounded-2xl border border-border bg-background/60 p-4">
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="glass-card rounded-[2rem] p-6 md:p-8">
              <div className="mb-5 flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Why Work With Him</h2>
              </div>
              <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                <p>
                  He combines data science depth with engineering execution, which makes him useful
                  across model development, backend APIs, and user-facing product delivery.
                </p>
                <p>
                  He is comfortable shipping practical systems, debugging real integration issues,
                  and turning technical ideas into working software that people can actually use.
                </p>
                <Button variant="hero" size="lg" asChild className="mt-2 w-full">
                  <a href="mailto:arpitshivhare525@gmail.com">Hire him</a>
                </Button>
              </div>
            </div>
          </motion.section>
        </motion.div>
      </main>
    </div>
  );
};

export default Founder;
