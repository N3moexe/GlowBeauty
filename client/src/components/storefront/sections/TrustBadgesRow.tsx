import { motion, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

type TrustBadgeItem = {
  title: string;
  subtitle: string;
  icon: LucideIcon;
};

type TrustBadgesRowProps = {
  items: TrustBadgeItem[];
};

export default function TrustBadgesRow({ items }: TrustBadgesRowProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section className="container section-shell-sm">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item, index) => (
          <motion.article
            key={item.title}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
            whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={
              shouldReduceMotion ? { duration: 0 } : { duration: 0.22, delay: index * 0.04, ease: "easeOut" }
            }
            whileHover={shouldReduceMotion ? undefined : { y: -2 }}
            className="premium-card group flex items-center gap-3 rounded-2xl border border-brand-border/70 bg-white/88 p-3.5 shadow-[0_18px_34px_-28px_rgba(58,38,34,0.5)]"
          >
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(150deg,rgba(227,116,78,0.18)_0%,rgba(181,141,204,0.2)_100%)] text-brand-accent transition-transform duration-300 group-hover:rotate-[8deg]">
              <item.icon className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0">
              <p className="type-h3 text-[1rem] text-brand-text">{item.title}</p>
              <p className="type-caption text-brand-muted">{item.subtitle}</p>
            </div>
          </motion.article>
        ))}
      </div>
    </section>
  );
}

