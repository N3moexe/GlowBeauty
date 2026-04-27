import { Suspense } from "react";
import { Mail } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { LazyExoticComponent, ComponentType } from "react";

type EmailSubscriptionProps = {
  variant?: "inline" | "card";
  title?: string;
  description?: string;
};

type NewsletterStripProps = {
  title: string;
  subtitle: string;
  lazyEmailSubscription: LazyExoticComponent<ComponentType<EmailSubscriptionProps>>;
};

export default function NewsletterStrip({
  title,
  subtitle,
  lazyEmailSubscription: LazyEmailSubscription,
}: NewsletterStripProps) {
  return (
    <section className="container section-shell-sm">
      <div className="relative overflow-hidden rounded-[2rem] border border-brand-border/60 bg-[linear-gradient(130deg,#fbf4ee_0%,#f5e3d3_52%,#eecbb3_100%)] p-6 md:p-8">
        <div className="relative grid gap-6 lg:grid-cols-[1fr_1.05fr] lg:items-center">
          <div>
            <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-accent-2">
              <Mail className="h-3.5 w-3.5" />
              Newsletter privee
            </p>
            <h2 className="mt-3 type-h1 text-brand-text">{title}</h2>
            <p className="mt-2 type-body text-brand-muted">{subtitle}</p>
          </div>

          <div className="rounded-2xl border border-white/70 bg-white/85 p-4 backdrop-blur-sm shadow-[0_18px_34px_-26px_rgba(92,58,44,0.35)]">
            <Suspense
              fallback={
                <div className="space-y-2">
                  <Skeleton className="h-11 w-full rounded-xl" />
                  <Skeleton className="h-11 w-36 rounded-xl" />
                </div>
              }
            >
              <LazyEmailSubscription
                variant="inline"
                title="Restez informe"
                description="Promotions skincare, routines et nouveautes premium"
              />
            </Suspense>
          </div>
        </div>
      </div>
    </section>
  );
}

