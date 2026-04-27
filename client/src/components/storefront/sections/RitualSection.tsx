import { useRef } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { ArrowRight, Moon, Sparkles, Sun, type LucideIcon } from "lucide-react";
import { Link } from "wouter";
import { MediaWithFallback } from "@/components/ui/media-with-fallback";

type RitualStep = {
  id: string;
  kicker: string;
  title: string;
  description: string;
  icon: LucideIcon;
};

type RitualSectionProps = {
  kicker?: string;
  title?: string;
  subtitle?: string;
  imageUrl?: string | null;
  imageAlt?: string;
  ctaLabel?: string;
  ctaHref?: string;
  steps?: RitualStep[];
};

const defaultSteps: RitualStep[] = [
  {
    id: "matin",
    kicker: "01 — Matin",
    title: "Éveiller la peau.",
    description:
      "Nettoyer en douceur, hydrater, protéger. Sérum vitamine C et SPF — la peau démarre prête.",
    icon: Sun,
  },
  {
    id: "soir",
    kicker: "02 — Soir",
    title: "Réparer en profondeur.",
    description:
      "Démaquillage attentif, actif ciblé, soin de nuit. La peau récupère pendant que vous dormez.",
    icon: Moon,
  },
  {
    id: "hebdo",
    kicker: "03 — Une fois par semaine",
    title: "Le rituel signature.",
    description:
      "Masque exfoliant, soin booster. Le moment qui transforme la routine en rendez-vous.",
    icon: Sparkles,
  },
];

function RitualStepCard({
  step,
  scrollYProgress,
  start,
  end,
  isFirst,
  isLast,
}: {
  step: RitualStep;
  scrollYProgress: MotionValue<number>;
  start: number;
  end: number;
  isFirst: boolean;
  isLast: boolean;
}) {
  const range: [number, number, number, number] = [
    Math.max(0, start - 0.02),
    start + 0.05,
    end - 0.05,
    Math.min(1, end + 0.02),
  ];
  const opacityStops: [number, number, number, number] = [
    isFirst ? 1 : 0,
    1,
    1,
    isLast ? 1 : 0,
  ];
  const opacity = useTransform(scrollYProgress, range, opacityStops);
  const y = useTransform(scrollYProgress, range, [
    isFirst ? 0 : 36,
    0,
    0,
    isLast ? 0 : -36,
  ]);

  const Icon = step.icon;

  return (
    <motion.article
      style={{ opacity, y }}
      className="absolute inset-0 flex flex-col justify-center"
    >
      <div className="surface-card-strong space-y-4 rounded-[1.6rem] border border-brand-border/70 bg-card/95 p-7 shadow-[0_28px_60px_-40px_rgba(60,36,31,0.6)] backdrop-blur-sm md:p-8">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-accent/12 text-brand-accent">
          <Icon className="h-6 w-6" />
        </div>
        <p className="section-kicker text-brand-accent-2">{step.kicker}</p>
        <h3 className="type-h2 text-[1.6rem] leading-tight text-brand-text md:text-[1.95rem]">
          {step.title}
        </h3>
        <p className="type-body text-[0.98rem] leading-relaxed text-brand-muted">
          {step.description}
        </p>
      </div>
    </motion.article>
  );
}

function RitualImageBadge({
  step,
  scrollYProgress,
  start,
  end,
}: {
  step: RitualStep;
  scrollYProgress: MotionValue<number>;
  start: number;
  end: number;
}) {
  const opacity = useTransform(
    scrollYProgress,
    [start, start + 0.05, end - 0.05, end],
    [0, 1, 1, 0]
  );
  const Icon = step.icon;

  return (
    <motion.span
      style={{ opacity }}
      className="absolute left-6 top-6 z-10 inline-flex items-center gap-2 rounded-full border border-white/30 bg-[#1d1312]/60 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white backdrop-blur-md"
    >
      <Icon className="h-3.5 w-3.5 text-[#ffd4c4]" />
      {step.kicker}
    </motion.span>
  );
}

function RitualProgressDot({
  scrollYProgress,
  start,
  end,
}: {
  scrollYProgress: MotionValue<number>;
  start: number;
  end: number;
}) {
  const opacity = useTransform(
    scrollYProgress,
    [start, start + 0.04, end - 0.04, end],
    [0.28, 1, 1, 0.28]
  );
  const scaleX = useTransform(
    scrollYProgress,
    [start, start + 0.04, end - 0.04, end],
    [0.6, 1, 1, 0.6]
  );

  return (
    <motion.span
      style={{ opacity, scaleX }}
      className="block h-[3px] w-10 origin-left rounded-full bg-brand-accent"
    />
  );
}

export default function RitualSection({
  kicker = "Le rituel",
  title = "Trois temps. Une peau qui répond.",
  subtitle = "Matin, soir, semaine. Chaque geste a sa place dans la routine.",
  imageUrl,
  imageAlt = "Routine skincare premium",
  ctaLabel = "Construire ma routine",
  ctaHref = "/boutique?q=routine",
  steps = defaultSteps,
}: RitualSectionProps) {
  const shouldReduceMotion = useReducedMotion();
  const ref = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });
  const stepCount = steps.length;

  if (shouldReduceMotion) {
    return (
      <section className="container section-shell">
        <div className="ui-stack-3">
          <header className="ui-stack-1 max-w-2xl">
            <p className="section-kicker text-brand-accent-2">{kicker}</p>
            <h2 className="section-title">{title}</h2>
            <p className="section-description">{subtitle}</p>
          </header>
          <ol className="space-y-4">
            {steps.map(step => {
              const Icon = step.icon;
              return (
                <li
                  key={step.id}
                  className="surface-card flex gap-4 rounded-[1.4rem] border border-brand-border/70 bg-card p-5"
                >
                  <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-accent/12 text-brand-accent">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="section-kicker text-brand-accent-2">
                      {step.kicker}
                    </p>
                    <h3 className="type-h3">{step.title}</h3>
                    <p className="type-body text-[0.95rem]">
                      {step.description}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
          {ctaHref && ctaLabel ? (
            <Link
              href={ctaHref}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-accent-2 transition-colors hover:text-brand-accent"
            >
              {ctaLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section
      ref={ref}
      className="relative"
      style={{ minHeight: `${stepCount * 100}vh` }}
    >
      <div className="sticky top-0 h-screen overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,rgba(227,116,78,0.18),transparent_45%),linear-gradient(180deg,#fdf6f1_0%,#f8ede5_60%,#fbf4ee_100%)]" />

        <div className="container relative h-full py-10 md:py-14 lg:py-16">
          <div className="grid h-full items-center gap-8 lg:grid-cols-[1fr_0.95fr] lg:gap-14">
            <div className="relative hidden h-[72vh] overflow-hidden rounded-[2rem] border border-brand-border/70 shadow-[0_38px_80px_-50px_rgba(64,37,36,0.7)] lg:block">
              {imageUrl ? (
                <MediaWithFallback
                  src={imageUrl}
                  alt={imageAlt}
                  className="h-full w-full object-cover"
                  width={1200}
                  height={1500}
                  sizes="(min-width: 1280px) 45vw, 50vw"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(160deg,#fff8f4_0%,#f6ece6_100%)]">
                  <Sparkles className="h-20 w-20 text-brand-accent/35" />
                </div>
              )}
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(27,16,15,0.04)_0%,rgba(27,16,15,0.36)_100%)]" />
              {steps.map((step, idx) => (
                <RitualImageBadge
                  key={step.id}
                  step={step}
                  scrollYProgress={scrollYProgress}
                  start={idx / stepCount}
                  end={(idx + 1) / stepCount}
                />
              ))}
            </div>

            <div className="relative flex h-full flex-col justify-center">
              <header className="mb-6 max-w-lg space-y-3 md:mb-8">
                <p className="section-kicker text-brand-accent-2">{kicker}</p>
                <h2 className="section-title">{title}</h2>
                <p className="section-description">{subtitle}</p>
              </header>

              <div className="relative min-h-[44vh] md:min-h-[42vh]">
                {steps.map((step, idx) => (
                  <RitualStepCard
                    key={step.id}
                    step={step}
                    scrollYProgress={scrollYProgress}
                    start={idx / stepCount}
                    end={(idx + 1) / stepCount}
                    isFirst={idx === 0}
                    isLast={idx === stepCount - 1}
                  />
                ))}
              </div>

              <div className="mt-6 flex items-center gap-2.5">
                {steps.map((step, idx) => (
                  <RitualProgressDot
                    key={`dot-${step.id}`}
                    scrollYProgress={scrollYProgress}
                    start={idx / stepCount}
                    end={(idx + 1) / stepCount}
                  />
                ))}
              </div>

              {ctaHref && ctaLabel ? (
                <Link
                  href={ctaHref}
                  className="mt-5 inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-brand-accent-2 transition-colors hover:text-brand-accent"
                >
                  {ctaLabel}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
