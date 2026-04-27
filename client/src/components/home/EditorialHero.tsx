import { useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import {
  CMS_EDITORIAL_HERO_PUBLIC_QUERY_KEY,
  EDITORIAL_HERO_UPDATED_EVENT,
  EDITORIAL_HERO_UPDATED_STORAGE_KEY,
  fetchPublicEditorialHero,
  makeEditorialHeroFallback,
  type CmsEditorialHeroBlock,
} from "@/lib/cmsEditorialHero";

type EditorialHeroProps = {
  hero?: CmsEditorialHeroBlock | null;
  className?: string;
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

function clampOverlayOpacity(value: number) {
  if (!Number.isFinite(value)) return 55;
  return Math.max(0, Math.min(90, Math.round(value)));
}

export default function EditorialHero({ hero, className }: EditorialHeroProps) {
  const shouldReduceMotion = useReducedMotion();
  const query = useQuery({
    queryKey: CMS_EDITORIAL_HERO_PUBLIC_QUERY_KEY,
    queryFn: fetchPublicEditorialHero,
    enabled: hero === undefined,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    refetchInterval: 20_000,
  });

  useEffect(() => {
    if (hero !== undefined) return;

    const refresh = () => {
      void query.refetch();
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === EDITORIAL_HERO_UPDATED_STORAGE_KEY) refresh();
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener(EDITORIAL_HERO_UPDATED_EVENT, refresh as EventListener);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(EDITORIAL_HERO_UPDATED_EVENT, refresh as EventListener);
    };
  }, [hero, query.refetch]);

  const data = hero === undefined ? query.data || null : hero;
  if (!data || !data.isActive) return null;

  const fallback = makeEditorialHeroFallback();
  const badgeText = data.badgeText.trim() || fallback.badgeText;
  const title = data.title.trim() || fallback.title;
  const subtitle = data.subtitle.trim() || fallback.subtitle;
  const ctaText = data.ctaText.trim() || fallback.ctaText;
  const ctaLink = data.ctaLink.trim() || fallback.ctaLink;
  const backgroundImageUrl = data.backgroundImageUrl.trim() || "";
  const overlayOpacity = clampOverlayOpacity(data.overlayOpacity);
  const desktopCardPositionClass =
    data.cardPosition === "center"
      ? "md:justify-center"
      : data.cardPosition === "right"
        ? "md:justify-end"
        : "md:justify-start";

  return (
    <section className={cn("w-full", className)}>
      <div className="relative h-[520px] w-full overflow-hidden sm:h-[540px] lg:h-[560px]">
        {backgroundImageUrl ? (
          <img
            src={backgroundImageUrl}
            alt={title}
            className="absolute inset-0 h-full w-full object-cover"
            loading="eager"
            decoding="async"
          />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(196,130,145,0.24),transparent_42%),linear-gradient(135deg,#473b3a_0%,#2b2524_50%,#1e1a19_100%)]" />
        )}

        <div
          className="absolute inset-0 bg-black"
          style={{ opacity: overlayOpacity / 100 }}
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.78)_0%,rgba(0,0,0,0.38)_42%,rgba(0,0,0,0.22)_70%,rgba(0,0,0,0.2)_100%),linear-gradient(180deg,rgba(0,0,0,0.02)_0%,rgba(0,0,0,0.62)_100%)]"
          aria-hidden="true"
        />

        <div
          className={cn(
            "container relative z-10 flex h-full items-center justify-center",
            desktopCardPositionClass
          )}
        >
          <motion.article
            initial={shouldReduceMotion ? false : { opacity: 0, y: 18, scale: 0.985 }}
            whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
            className="w-[92%] max-w-[560px] rounded-[28px] border border-white/15 bg-[rgba(0,0,0,0.35)] p-7 text-white shadow-[0_34px_60px_-34px_rgba(0,0,0,0.78)] backdrop-blur-xl sm:p-10"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/82">
              {badgeText}
            </p>
            <h2 className="mt-4 text-[clamp(2rem,4.7vw,4rem)] font-semibold leading-[0.93] tracking-[-0.02em] text-white">
              {title}
            </h2>
            <p className="mt-4 max-w-[48ch] text-sm leading-relaxed text-white/70 sm:text-[15px]">
              {subtitle}
            </p>

            <div className="mt-7">
              <MaybeLink
                href={ctaLink}
                className="inline-flex items-center gap-2 rounded-full border border-white/45 bg-white/10 px-6 py-3 text-sm font-semibold text-white shadow-[0_16px_28px_-18px_rgba(0,0,0,0.8)] transition-transform duration-200 hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black/30"
              >
                {ctaText}
                <ArrowRight className="h-4 w-4" />
              </MaybeLink>
            </div>
          </motion.article>
        </div>
      </div>
    </section>
  );
}
