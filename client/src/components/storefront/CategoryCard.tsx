import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { cn } from "@/lib/utils";

type Category = {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
  coverImageUrl?: string | null;
};

const fallbackGradients = [
  "from-crimson/80 via-rose-600/75 to-slate-900/80",
  "from-sky-700/75 via-blue-700/70 to-slate-900/75",
  "from-green-700/75 via-emerald-700/65 to-slate-900/75",
  "from-amber-600/75 via-orange-600/65 to-slate-900/80",
  "from-indigo-700/75 via-violet-700/65 to-slate-900/80",
  "from-cyan-700/75 via-teal-700/65 to-slate-900/80",
];

function toWebpCandidate(src: string) {
  if (!src) return null;
  if (src.includes(".webp")) return src;
  if (/\.(jpg|jpeg|png)(\?.*)?$/i.test(src)) {
    return src.replace(/\.(jpg|jpeg|png)(\?.*)?$/i, ".webp$2");
  }
  return null;
}

export default function CategoryCard({
  category,
  index = 0,
  featured = false,
}: {
  category: Category;
  index?: number;
  featured?: boolean;
}) {
  const cardImage = category.coverImageUrl || category.imageUrl || "";
  const webpSource = toWebpCandidate(cardImage);
  const shouldReduceMotion = useReducedMotion();
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(cardImage) && !imageFailed;

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
      whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      whileHover={shouldReduceMotion ? undefined : { y: -5, scale: 1.012 }}
      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.24, ease: "easeOut" }}
      className="h-full"
    >
      <Link
        href={`/boutique?cat=${category.slug}`}
        className="group section-frame block h-full overflow-hidden p-0 transition-shadow duration-300 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className={cn("relative", featured ? "aspect-[16/11] md:aspect-[15/9]" : "aspect-[5/3]")}>
          {showImage ? (
            <picture>
              {webpSource && <source srcSet={webpSource} type="image/webp" />}
              <img
                src={cardImage}
                alt={category.name}
                className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-[1.05]"
                width={featured ? 1280 : 960}
                height={featured ? 768 : 576}
                loading="lazy"
                decoding="async"
                sizes={featured ? "(min-width: 1024px) 62vw, 100vw" : "(min-width: 1024px) 31vw, (min-width: 640px) 50vw, 100vw"}
                onError={() => setImageFailed(true)}
              />
            </picture>
          ) : (
            <div
              className={`h-full w-full bg-gradient-to-br ${
                fallbackGradients[index % fallbackGradients.length]
              }`}
            />
          )}

          <div className="noise-overlay pointer-events-none absolute inset-0" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/78 via-black/28 to-black/5" />

          <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-3 md:inset-x-5 md:bottom-5">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/70">
                Univers
              </p>
              <h3 className={cn("mt-1 truncate font-extrabold text-white", featured ? "text-2xl md:text-[1.75rem]" : "text-lg")}>
                {category.name}
              </h3>
              <p className="mt-1 line-clamp-2 max-w-md text-xs text-white/80 md:text-sm">
                {category.description || "Decouvrez les meilleures offres de cette categorie."}
              </p>
            </div>
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/40 bg-white/10 text-white opacity-90 transition-all duration-300 group-hover:translate-x-1.5 group-hover:scale-[1.03] group-hover:bg-white/20 group-hover:opacity-100">
              <ArrowRight className="h-4 w-4" />
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
