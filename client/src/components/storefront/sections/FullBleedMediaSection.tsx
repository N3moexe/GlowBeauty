import { ArrowRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "wouter";
import { MediaWithFallback } from "@/components/ui/media-with-fallback";

type FullBleedMediaSectionProps = {
  kicker: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  mediaAlt: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
  posterUrl?: string | null;
};

export default function FullBleedMediaSection({
  kicker,
  title,
  subtitle,
  ctaLabel,
  ctaHref,
  mediaAlt,
  imageUrl,
  videoUrl,
  posterUrl,
}: FullBleedMediaSectionProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section className="relative section-shell-lg">
      <motion.div
        initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
        whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.3, ease: "easeOut" }}
        className="relative overflow-hidden border-y border-brand-border/70"
      >
        <div className="absolute inset-0">
          {videoUrl ? (
            <video
              src={videoUrl}
              poster={posterUrl || undefined}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              className="h-[58vh] min-h-[420px] w-full object-cover md:h-[66vh] md:min-h-[520px]"
            />
          ) : (
            <MediaWithFallback
              src={imageUrl}
              alt={mediaAlt}
              className="h-[58vh] min-h-[420px] w-full object-cover md:h-[66vh] md:min-h-[520px]"
              width={1920}
              height={1080}
              sizes="100vw"
            />
          )}
        </div>

        <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(22,14,13,0.82)_14%,rgba(28,17,20,0.58)_48%,rgba(28,17,20,0.1)_100%)]" />
        <div className="relative container flex min-h-[420px] items-end py-10 md:min-h-[520px] md:py-14">
          <div className="max-w-xl space-y-4 rounded-[1.6rem] border border-white/25 bg-[#201412]/62 p-5 text-white shadow-[0_30px_56px_-34px_rgba(6,2,1,0.8)] backdrop-blur-lg md:p-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#ffd5c5]">{kicker}</p>
            <h2 className="type-h1 text-white">{title}</h2>
            <p className="type-body text-white/86">{subtitle}</p>
            <Link
              href={ctaHref}
              className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/12 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/20"
            >
              {ctaLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

