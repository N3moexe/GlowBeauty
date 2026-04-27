import { ArrowRight, type LucideIcon } from "lucide-react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { useRef, type ReactNode } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { MediaWithFallback } from "@/components/ui/media-with-fallback";
import PaymentBadgesRow from "@/components/storefront/sections/PaymentBadgesRow";
import RevealText from "@/components/storefront/RevealText";
import Magnetic from "@/components/storefront/Magnetic";
import { storefrontMotion } from "@/lib/storefront-ui";

type Cta = {
  label: string;
  href: string;
};

type OverlayCard = {
  kicker: string;
  title: string;
  description: string;
  href: string;
  ctaLabel: string;
  icon: LucideIcon;
};

type EditorialHeroProps = {
  badgeText: string;
  title: string;
  subtitle: string;
  primaryCta: Cta;
  secondaryCta: Cta;
  mediaAlt: string;
  mediaImageUrl?: string | null;
  mediaVideoUrl?: string | null;
  mediaPosterUrl?: string | null;
  overlay: OverlayCard;
};

function MaybeLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  if (/^https?:\/\//.test(href)) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

export default function EditorialHero({
  badgeText,
  title,
  subtitle,
  primaryCta,
  secondaryCta,
  mediaAlt,
  mediaImageUrl,
  mediaVideoUrl,
  mediaPosterUrl,
  overlay,
}: EditorialHeroProps) {
  const shouldReduceMotion = useReducedMotion();
  const OverlayIcon = overlay.icon;

  // Scroll-linked parallax: image drifts up, card frame drifts down a touch.
  // Kept small so the page never feels like it's fighting the user.
  const sectionRef = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });
  const imageY = useTransform(
    scrollYProgress,
    [0, 1],
    shouldReduceMotion ? [0, 0] : [0, -48]
  );
  const imageScale = useTransform(
    scrollYProgress,
    [0, 1],
    shouldReduceMotion ? [1, 1] : [1, 1.06]
  );
  const cardY = useTransform(
    scrollYProgress,
    [0, 1],
    shouldReduceMotion ? [0, 0] : [0, 12]
  );

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden border-b border-brand-border/70"
    >
      {/* Warm-only gradient — the lavender radial that used to sit here is gone. */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_10%,rgba(227,116,78,0.24),transparent_46%),radial-gradient(circle_at_88%_18%,rgba(242,196,160,0.34),transparent_44%),linear-gradient(180deg,#fdf6f1_0%,#f7eee8_55%,#f9f2ed_100%)]" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="hero-blob hero-blob-a" />
        <div className="hero-blob hero-blob-b" />
      </div>

      <div className="container relative py-12 md:py-16 lg:py-20">
        <div className="grid items-center gap-8 lg:grid-cols-[1fr_0.98fr] lg:gap-10">
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
            animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={
              shouldReduceMotion
                ? { duration: 0 }
                : { duration: 0.34, ease: "easeOut" }
            }
            className="space-y-6"
          >
            <p className="inline-flex w-fit items-center gap-2 rounded-full border border-brand-border/70 bg-white/70 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-accent-2">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-accent" />
              {badgeText}
            </p>

            <RevealText
              as="h1"
              className="type-display block max-w-2xl text-balance text-brand-text"
            >
              {title}
            </RevealText>
            <motion.p
              initial={
                shouldReduceMotion ? false : { opacity: 0, filter: "blur(8px)" }
              }
              animate={
                shouldReduceMotion
                  ? undefined
                  : { opacity: 1, filter: "blur(0px)" }
              }
              transition={
                shouldReduceMotion
                  ? { duration: 0 }
                  : {
                      duration: storefrontMotion.duration.signature,
                      delay: 0.18,
                      ease: storefrontMotion.ease.poured,
                    }
              }
              className="type-body max-w-xl text-brand-muted"
            >
              {subtitle}
            </motion.p>

            <div className="hidden flex-wrap gap-3 md:flex">
              <Magnetic>
                <Button
                  asChild
                  variant="premium"
                  size="xl"
                  className="rounded-[1rem]"
                >
                  <MaybeLink href={primaryCta.href}>
                    {primaryCta.label}
                    <ArrowRight className="h-4 w-4" />
                  </MaybeLink>
                </Button>
              </Magnetic>
              <Button
                asChild
                variant="soft"
                size="xl"
                className="rounded-[1rem]"
              >
                <MaybeLink href={secondaryCta.href}>
                  {secondaryCta.label}
                </MaybeLink>
              </Button>
            </div>

            <PaymentBadgesRow className="hidden md:inline-flex" />

            <div className="sticky bottom-3 z-10 mt-5 grid grid-cols-2 gap-2 rounded-2xl border border-brand-border/60 bg-white/90 p-2 shadow-[0_20px_40px_-26px_rgba(34,22,18,0.45)] backdrop-blur md:hidden">
              <Button
                asChild
                variant="premium"
                size="sm"
                className="w-full rounded-xl"
              >
                <MaybeLink href={primaryCta.href}>{primaryCta.label}</MaybeLink>
              </Button>
              <Button
                asChild
                variant="soft"
                size="sm"
                className="w-full rounded-xl"
              >
                <MaybeLink href={secondaryCta.href}>
                  {secondaryCta.label}
                </MaybeLink>
              </Button>
            </div>
          </motion.div>

          <motion.div
            initial={
              shouldReduceMotion
                ? false
                : {
                    opacity: 0,
                    y: 12,
                    scale: 0.985,
                    clipPath: "inset(8% 8% 8% 8% round 1.45rem)",
                  }
            }
            animate={
              shouldReduceMotion
                ? undefined
                : {
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    clipPath: "inset(0% round 1.45rem)",
                  }
            }
            transition={
              shouldReduceMotion
                ? { duration: 0 }
                : {
                    duration: storefrontMotion.duration.signature,
                    ease: storefrontMotion.ease.poured,
                  }
            }
            style={shouldReduceMotion ? undefined : { y: cardY }}
            className="premium-card relative overflow-hidden rounded-[2rem] border border-brand-border/70 p-3 shadow-[0_32px_70px_-44px_rgba(64,37,36,0.68)]"
          >
            <div className="relative overflow-hidden rounded-[1.45rem] border border-brand-border/60 bg-brand-muted/20">
              {/* Image wrapped in a motion layer for parallax drift + slow Ken Burns. */}
              <motion.div
                style={
                  shouldReduceMotion
                    ? undefined
                    : { y: imageY, scale: imageScale }
                }
                className="will-change-transform"
              >
                {mediaVideoUrl ? (
                  <video
                    src={mediaVideoUrl}
                    poster={mediaPosterUrl || undefined}
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    className="h-[280px] w-full object-cover sm:h-[460px] lg:h-[600px]"
                  />
                ) : (
                  <MediaWithFallback
                    src={mediaImageUrl}
                    alt={mediaAlt}
                    className="h-[280px] w-full object-cover sm:h-[460px] lg:h-[600px]"
                    width={900}
                    height={1200}
                    loading="eager"
                    fetchPriority="high"
                    sizes="(min-width: 1280px) 42vw, (min-width: 1024px) 45vw, 100vw"
                  />
                )}
              </motion.div>

              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(27,20,18,0.06)_0%,rgba(27,20,18,0.28)_42%,rgba(18,11,10,0.68)_100%)]" />

              <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-white/30 bg-[#1d1312]/68 p-4 text-white backdrop-blur-xl sm:inset-x-6 sm:bottom-6 sm:p-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/75">
                  {overlay.kicker}
                </p>
                <p className="mt-2 text-lg font-semibold leading-tight text-white sm:text-xl">
                  {overlay.title}
                </p>
                <p className="mt-1 text-sm text-white/78">
                  {overlay.description}
                </p>
                <MaybeLink
                  href={overlay.href}
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[#ffd4c4] transition-colors hover:text-white"
                >
                  <OverlayIcon className="h-4 w-4" />
                  {overlay.ctaLabel}
                  <ArrowRight className="h-4 w-4" />
                </MaybeLink>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
