import { motion, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";
import { Link } from "wouter";
import { MediaWithFallback } from "@/components/ui/media-with-fallback";

type ShowcaseItem = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  ctaLabel: string;
  imageUrl?: string | null;
  gradient: string;
  icon: LucideIcon;
};

type GridShowcaseSectionProps = {
  kicker: string;
  title: string;
  subtitle: string;
  items: ShowcaseItem[];
  actionHref?: string;
  actionLabel?: string;
};

export default function GridShowcaseSection({
  kicker,
  title,
  subtitle,
  items,
  actionHref,
  actionLabel,
}: GridShowcaseSectionProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section className="container section-shell">
      <div className="ui-stack-3">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="ui-stack-1">
            <p className="section-kicker text-brand-accent-2">{kicker}</p>
            <h2 className="section-title">{title}</h2>
            <p className="section-description">{subtitle}</p>
          </div>
          {actionHref && actionLabel ? (
            <Link
              href={actionHref}
              className="link-chip border-brand-border/80 bg-white/75 text-brand-accent-2 hover:border-brand-accent/40 hover:text-brand-accent"
            >
              {actionLabel}
            </Link>
          ) : null}
        </header>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 xl:grid-rows-2 xl:auto-rows-[minmax(0,1fr)]">
          {items.map((item, index) => {
            const isFeature = index === 0;
            const isWide = index === 3;
            const span = isFeature
              ? "md:col-span-2 xl:col-span-2 xl:row-span-2"
              : isWide
                ? "md:col-span-2 xl:col-span-2"
                : "";

            return (
              <motion.article
                key={item.id}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
                whileInView={
                  shouldReduceMotion ? undefined : { opacity: 1, y: 0 }
                }
                viewport={{ once: true, amount: 0.2 }}
                transition={
                  shouldReduceMotion
                    ? { duration: 0 }
                    : {
                        duration: 0.32,
                        delay: index * 0.05,
                        ease: [0.22, 1, 0.36, 1],
                      }
                }
                whileHover={shouldReduceMotion ? undefined : { y: -4 }}
                className={`group premium-card relative flex flex-col overflow-hidden rounded-[1.6rem] border border-brand-border/75 bg-white shadow-[0_24px_48px_-34px_rgba(59,40,36,0.62)] ${span}`}
              >
                <div
                  className="absolute inset-0 opacity-70"
                  style={{ background: item.gradient }}
                />
                <div
                  className={`relative overflow-hidden border-b border-brand-border/50 ${
                    isFeature ? "min-h-72 flex-1" : "min-h-44 md:min-h-52"
                  }`}
                >
                  {item.imageUrl ? (
                    <MediaWithFallback
                      src={item.imageUrl}
                      alt={item.title}
                      className="h-full w-full object-cover transition-transform duration-[800ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.05]"
                      width={isFeature ? 1200 : 720}
                      height={isFeature ? 900 : 520}
                      sizes={
                        isFeature || isWide
                          ? "(min-width: 1280px) 50vw, (min-width: 768px) 100vw, 100vw"
                          : "(min-width: 1280px) 25vw, (min-width: 768px) 50vw, 100vw"
                      }
                    />
                  ) : (
                    <div className="flex h-full min-h-44 w-full items-center justify-center">
                      <item.icon
                        className={`text-brand-accent ${isFeature ? "h-16 w-16" : "h-12 w-12"}`}
                      />
                    </div>
                  )}
                  {/* Veil — opaque at rest so the title reads, eases out on hover so the image breathes. */}
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,rgba(34,22,18,0.55)_100%)] transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:opacity-30" />
                </div>

                <div className="relative space-y-3 p-5">
                  <div className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-brand-border/70 bg-white/84 text-brand-accent shadow-[0_12px_22px_-18px_rgba(58,33,26,0.55)] transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:rotate-[9deg]">
                    <item.icon className="h-4.5 w-4.5" />
                  </div>
                  <h3
                    className={`type-h2 text-brand-text transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-translate-y-0.5 ${
                      isFeature
                        ? "text-[1.65rem] xl:text-[1.95rem]"
                        : "text-[1.35rem]"
                    }`}
                  >
                    {item.title}
                  </h3>
                  <p className="type-body text-[0.95rem] leading-relaxed text-brand-muted">
                    {item.subtitle}
                  </p>
                  <Link
                    href={item.href}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-accent-2 transition-all duration-300 group-hover:gap-2 group-hover:text-brand-accent"
                  >
                    {item.ctaLabel}
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </div>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
