import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, CheckCircle2, ShieldCheck, Truck } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "wouter";
import type { CmsHomeHeroBlock } from "@/lib/cmsHomeHero";

type HomeHeroProps = {
  hero: CmsHomeHeroBlock;
  fallbackImageUrl?: string | null;
};

const trustItems = [
  { title: "Livraison 24h-72h", subtitle: "Dakar + regions", icon: Truck },
  {
    title: "Paiement securise",
    subtitle: "Wave, Orange Money, cartes",
    icon: ShieldCheck,
  },
  {
    title: "Support humain",
    subtitle: "Conseils routine rapides",
    icon: CheckCircle2,
  },
] as const;

const textContainerVariants = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1],
      staggerChildren: 0.08,
    },
  },
} as const;

const textChildVariants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] },
  },
} as const;

function maybeExternalLink(
  href: string,
  className: string,
  children: ReactNode
) {
  if (/^https?:\/\//.test(href)) {
    return (
      <a href={href} className={className} target="_blank" rel="noreferrer">
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

export default function HomeHero({ hero, fallbackImageUrl }: HomeHeroProps) {
  const shouldReduceMotion = useReducedMotion();
  const mediaUrl = hero.imageUrl || fallbackImageUrl || "";
  const title =
    hero.title.trim() || "Routine premium, peau claire, glow durable.";
  const subtitle =
    hero.subtitle.trim() ||
    "Des formules cibles, une routine simple et une experience d'achat elegante pour des resultats visibles.";
  const badgeText = hero.badgeText.trim() || "Editorial skincare";
  const ctaText = hero.ctaText.trim() || "Voir la boutique";
  const ctaLink = hero.ctaLink.trim() || "/boutique";
  const secondaryCtaText =
    hero.secondaryCtaText.trim() || "Trouver mon type de peau";
  const secondaryCtaLink =
    hero.secondaryCtaLink.trim() || "/boutique?q=routine";

  return (
    <section className="relative overflow-hidden border-b border-[#e3d7ce]/80">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_16%,rgba(179,124,137,0.2),transparent_40%),radial-gradient(circle_at_88%_12%,rgba(143,163,133,0.2),transparent_42%),linear-gradient(180deg,#f9f6f3_0%,#f5efe8_54%,#f8f4ef_100%)]" />
      <div className="container relative py-16 md:py-20 lg:py-24 xl:py-28">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.96fr)] lg:gap-12">
          <motion.div
            initial={shouldReduceMotion ? false : "hidden"}
            animate={shouldReduceMotion ? undefined : "show"}
            variants={textContainerVariants}
            className="space-y-8"
          >
            <div className="space-y-5">
              <motion.p
                variants={textChildVariants}
                className="inline-flex w-fit items-center gap-2 rounded-full border border-[#d9cbc1]/85 bg-white/78 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#7f5862] backdrop-blur-sm"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-[#9e717a]" />
                {badgeText}
              </motion.p>
              <motion.h1
                variants={textChildVariants}
                className="max-w-2xl text-balance text-[clamp(2.35rem,5.5vw,4.85rem)] font-black leading-[0.94] tracking-[-0.03em] text-[#2c2622]"
              >
                {title}
              </motion.h1>
              <motion.p
                variants={textChildVariants}
                className="max-w-2xl text-[1.02rem] leading-relaxed text-[#5f5550]"
              >
                {subtitle}
              </motion.p>
            </div>

            <motion.div
              variants={textChildVariants}
              className="flex flex-wrap gap-3.5"
            >
              {maybeExternalLink(
                ctaLink,
                "inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#a96f7a] via-[#ba7d87] to-[#ca929a] px-6 text-sm font-semibold text-white shadow-[0_16px_36px_-16px_rgba(132,79,91,0.52)] transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.02] hover:shadow-[0_20px_42px_-16px_rgba(132,79,91,0.58)] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/65 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                <>
                  {ctaText}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
              {maybeExternalLink(
                secondaryCtaLink,
                "inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-[#d5c6bc] bg-white/90 px-6 text-sm font-semibold text-[#3f3733] shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.02] hover:border-[#c2a4a9] hover:bg-[#fcf7f3] hover:text-[#7a4f59] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/55 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                <>
                  {secondaryCtaText}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </motion.div>

            <motion.div variants={textChildVariants}>
              <Link
                href="/boutique?q=routine"
                className="inline-flex items-center gap-2 rounded-full border border-[#d8c8bf] bg-white/76 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7a5a62] transition-colors duration-200 hover:border-[#c7aeb2] hover:text-[#66414a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/55 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Routine finder
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </motion.div>
          </motion.div>

          <motion.div
            initial={
              shouldReduceMotion ? false : { opacity: 0, scale: 0.98, y: 12 }
            }
            animate={
              shouldReduceMotion ? undefined : { opacity: 1, scale: 1, y: 0 }
            }
            transition={
              shouldReduceMotion
                ? { duration: 0 }
                : { duration: 0.52, ease: [0.22, 1, 0.36, 1] }
            }
            className="group relative overflow-hidden rounded-[2.15rem] border border-[#e3d7ce] bg-[#f9f4ee] p-4 shadow-[0_36px_80px_-42px_rgba(74,56,48,0.52)]"
          >
            <div className="relative overflow-hidden rounded-[1.6rem] border border-[#e2d4ca]/95 bg-[#f2e8df]">
              {mediaUrl ? (
                <img
                  src={mediaUrl}
                  alt={title}
                  className="h-[430px] w-full object-cover transition-transform duration-700 group-hover:scale-[1.04] sm:h-[500px] lg:h-[620px]"
                  loading="eager"
                  decoding="async"
                />
              ) : (
                <div className="h-[430px] w-full bg-[linear-gradient(145deg,#f4e9df_0%,#e7d6c8_100%)] sm:h-[500px] lg:h-[620px]" />
              )}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,rgba(255,244,237,0.28),transparent_42%),linear-gradient(180deg,rgba(43,34,30,0.06)_0%,rgba(43,34,30,0.18)_38%,rgba(32,25,22,0.72)_100%)]" />
              <div className="absolute left-5 top-5 inline-flex items-center gap-1.5 rounded-full border border-white/38 bg-white/16 px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/95 backdrop-blur-md">
                Featured routine
              </div>
              <div className="absolute inset-x-5 bottom-5 rounded-2xl border border-white/22 bg-[#1e1815]/62 p-4 text-white shadow-[0_18px_36px_-18px_rgba(0,0,0,0.72)] backdrop-blur-xl">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/72">
                  Selection du moment
                </p>
                <p className="mt-2 text-lg font-semibold leading-snug text-white sm:text-xl">
                  {title}
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="mt-8 grid gap-3 sm:mt-10 sm:grid-cols-3">
          {trustItems.map((item, index) => (
            <motion.article
              key={item.title}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
              animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
              transition={
                shouldReduceMotion
                  ? { duration: 0 }
                  : {
                      duration: 0.32,
                      delay: 0.16 + index * 0.06,
                      ease: [0.22, 1, 0.36, 1],
                    }
              }
              className="flex items-center gap-3 rounded-2xl border border-[#dfd1c8] bg-white/84 p-3.5 shadow-[0_14px_32px_-24px_rgba(76,61,53,0.55)] backdrop-blur-sm"
            >
              <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f3e8e5] text-[#8f5f68]">
                <item.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#342e2b]">
                  {item.title}
                </p>
                <p className="text-xs text-[#6a615b]">{item.subtitle}</p>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
