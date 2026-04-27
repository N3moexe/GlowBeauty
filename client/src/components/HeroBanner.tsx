import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, CheckCircle2, ShieldCheck, Smartphone, Sparkles, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroSkeleton } from "@/components/storefront/Skeletons";

type HeroBannerPayload = {
  id: number;
  placement: "homepage_hero";
  title: string;
  subtitle: string;
  buttonText: string;
  buttonLink: string;
  imageUrl: string;
  imageUrlDesktop: string;
  imageUrlMobile: string;
  cropMeta: string | null;
  status: "draft" | "published";
  priority: number;
  startAt: string | null;
  endAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const fallbackHero: HeroBannerPayload = {
  id: 0,
  placement: "homepage_hero",
  title: "Shop the best deals in Senegal",
  subtitle: "Premium products, fast delivery, and trusted checkout every day.",
  buttonText: "Decouvrir la boutique",
  buttonLink: "/boutique",
  imageUrl: "",
  imageUrlDesktop: "",
  imageUrlMobile: "",
  cropMeta: null,
  status: "published",
  priority: 0,
  startAt: null,
  endAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function toWebpCandidate(src: string) {
  if (!src) return null;
  if (src.includes(".webp")) return src;
  if (/\.(jpg|jpeg|png)(\?.*)?$/i.test(src)) {
    return src.replace(/\.(jpg|jpeg|png)(\?.*)?$/i, ".webp$2");
  }
  return null;
}

const heroQuickFacts = [
  {
    icon: Truck,
    label: "Livraison 24h/72h",
  },
  {
    icon: Smartphone,
    label: "Wave & Orange Money",
  },
  {
    icon: ShieldCheck,
    label: "Checkout securise",
  },
];

const heroMetrics = [
  {
    value: "4.9/5",
    label: "Satisfaction clients",
  },
  {
    value: "24h",
    label: "Debut expedition Dakar",
  },
  {
    value: "7j/7",
    label: "Support local reactif",
  },
];

export default function HeroBanner() {
  const [banner, setBanner] = useState<HeroBannerPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const shouldReduceMotion = useReducedMotion();
  const firstLoadRef = useRef(true);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    const loadBanner = async () => {
      try {
        if (firstLoadRef.current) {
          setIsLoading(true);
        }
        setErrorMessage(null);
        const response = await fetch(
          `/api/public/banners?placement=homepage_hero&_ts=${Date.now()}`,
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
            headers: {
              "Cache-Control": "no-cache",
            },
            signal: controller.signal,
          }
        );

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error || "Unable to load hero banner.");
        }

        if (!mounted) return;
        setBanner(payload?.banner || null);
      } catch (error: any) {
        if (!mounted || error?.name === "AbortError") return;
        console.error("[HeroBanner] failed to load banner", error);
        setErrorMessage(error?.message || "Unable to load hero banner.");
        setBanner(null);
      } finally {
        if (mounted) setIsLoading(false);
        firstLoadRef.current = false;
      }
    };

    void loadBanner();

    const onFocus = () => {
      void loadBanner();
    };
    const onVisibilityChange = () => {
      if (!document.hidden) void loadBanner();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      mounted = false;
      controller.abort();
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  const hero = useMemo(() => banner || fallbackHero, [banner]);
  const ctaLabel = hero.buttonText?.trim() || "Decouvrir la boutique";
  const ctaHref = hero.buttonLink?.trim() || "/boutique";
  const desktopImage = hero.imageUrlDesktop || hero.imageUrl || "";
  const mobileImage = hero.imageUrlMobile || desktopImage;
  const desktopWebp = toWebpCandidate(desktopImage || mobileImage);
  const mobileWebp = toWebpCandidate(mobileImage || desktopImage);

  if (isLoading) {
    return <HeroSkeleton />;
  }

  return (
    <section className="relative isolate min-h-[72vh] w-full overflow-hidden">
      {desktopImage || mobileImage ? (
        <picture>
          {mobileWebp && <source media="(max-width: 767px)" srcSet={mobileWebp} type="image/webp" />}
          <source media="(max-width: 767px)" srcSet={mobileImage || desktopImage} />
          {desktopWebp && <source media="(min-width: 768px)" srcSet={desktopWebp} type="image/webp" />}
          <source media="(min-width: 768px)" srcSet={desktopImage || mobileImage} />
          <img
            src={desktopImage || mobileImage}
            alt={hero.title || "Homepage hero"}
            className="absolute inset-0 h-full w-full object-cover"
            fetchPriority="high"
            decoding="async"
            width={1920}
            height={960}
            sizes="100vw"
          />
        </picture>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-crimson via-crimson-dark to-slate-950" />
      )}

      <div className="absolute inset-0 bg-gradient-to-r from-black/86 via-black/56 to-black/48" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_14%,rgba(255,255,255,0.2),transparent_40%),radial-gradient(circle_at_82%_78%,rgba(255,255,255,0.15),transparent_42%)]" />
      <div className="noise-overlay pointer-events-none absolute inset-0" />

      {!shouldReduceMotion && (
        <>
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -left-20 top-16 h-64 w-64 rounded-full bg-crimson/28 blur-3xl"
            animate={{ opacity: [0.2, 0.44, 0.2], x: [0, 16, 0], y: [0, -14, 0] }}
            transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            aria-hidden
            className="pointer-events-none absolute bottom-10 right-10 h-72 w-72 rounded-full bg-green-accent/20 blur-3xl"
            animate={{ opacity: [0.18, 0.36, 0.18], x: [0, -12, 0], y: [0, 16, 0] }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          />
        </>
      )}

      <div className="container relative z-10 grid min-h-[72vh] items-end gap-6 py-12 md:py-16 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] lg:items-center">
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
          whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.5, ease: "easeOut" }}
          className="w-full max-w-3xl text-white"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/35 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/90 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" />
            Collection premium
          </span>

          <h1 className="mt-4 text-balance text-4xl font-extrabold leading-[1.05] md:text-6xl">
            {hero.title}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/88 md:text-xl">
            {hero.subtitle}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href={ctaHref}>
              <Button size="2xl" variant="premium" className="rounded-xl px-8 shadow-lg shadow-black/20">
                {ctaLabel}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/track">
              <Button size="2xl" variant="soft" className="rounded-xl border-white/30 bg-white/12 text-white hover:bg-white/22">
                Suivre commande
              </Button>
            </Link>
          </div>

          <div className="mt-6 grid gap-2 sm:grid-cols-3">
            {heroQuickFacts.map((item) => (
              <span
                key={item.label}
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white/92 backdrop-blur"
              >
                <item.icon className="h-4 w-4 text-white/85" />
                {item.label}
              </span>
            ))}
          </div>

          {errorMessage && <p className="mt-3 text-xs text-white/70">{errorMessage}</p>}
        </motion.div>

        <motion.aside
          initial={shouldReduceMotion ? false : { opacity: 0, y: 18 }}
          whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.55, ease: "easeOut", delay: 0.12 }}
          className="hidden lg:block"
        >
          <div className="rounded-3xl border border-white/20 bg-white/10 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/70">
              Pourquoi choisir SenBonsPlans
            </p>
            <div className="mt-4 grid gap-3">
              {heroMetrics.map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-xl border border-white/18 bg-black/15 px-3.5 py-3"
                >
                  <p className="text-2xl font-extrabold leading-none text-white">{metric.value}</p>
                  <p className="mt-1 text-xs text-white/75">{metric.label}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-2xl border border-white/18 bg-white/8 p-3.5">
              <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-white">
                <CheckCircle2 className="h-4 w-4 text-green-accent-light" />
                Paiements locaux verifies
              </p>
              <p className="mt-1 text-xs text-white/75">
                Wave, Orange Money, cartes internationales et confirmation immediate.
              </p>
            </div>
          </div>
        </motion.aside>
      </div>
    </section>
  );
}
