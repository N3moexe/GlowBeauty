import { Sparkles } from "lucide-react";
import type { CmsResultsSection } from "@/lib/cmsResultsSection";

type EditorialResultsSectionProps = {
  section: CmsResultsSection;
};

function ImagePlaceholder({ tone }: { tone: "before" | "after" }) {
  if (tone === "before") {
    return (
      <div className="flex h-36 items-center justify-center rounded-xl bg-[linear-gradient(150deg,#f7ede6_0%,#edd9cb_100%)]">
        <div className="h-24 w-20 rounded-full bg-[#e5c8b8]/70" />
      </div>
    );
  }

  return (
    <div className="flex h-36 items-center justify-center rounded-xl bg-[linear-gradient(150deg,#eef6e9_0%,#dbe8d1_100%)]">
      <div className="h-24 w-20 rounded-full bg-[#bad0ac]/75" />
    </div>
  );
}

export default function EditorialResultsSection({ section }: EditorialResultsSectionProps) {
  const metrics = [
    {
      value: section.stat1Value,
      title: section.stat1Title,
      description: section.stat1Desc,
    },
    {
      value: section.stat2Value,
      title: section.stat2Title,
      description: section.stat2Desc,
    },
    {
      value: section.stat3Value,
      title: section.stat3Title,
      description: section.stat3Desc,
    },
  ];

  return (
    <div className="rounded-[2rem] border border-[#e2d7ce] bg-white p-6 md:p-8">
      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div className="space-y-4">
          <p className="section-kicker text-[#8f5f68]">Editorial results</p>
          <h2 className="section-title">{section.title}</h2>
          <p className="section-description">{section.subtitle}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="overflow-hidden rounded-2xl border border-[#e4d9cf] bg-[#f5ece6] p-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7b6559]">
                {section.beforeLabel}
              </p>
              {section.beforeImageUrl ? (
                <img
                  src={section.beforeImageUrl}
                  alt={section.beforeLabel}
                  className="h-36 w-full rounded-xl object-cover"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <ImagePlaceholder tone="before" />
              )}
            </div>
            <div className="overflow-hidden rounded-2xl border border-[#d8dfd2] bg-[#ecf4e8] p-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#5d7650]">
                {section.afterLabel}
              </p>
              {section.afterImageUrl ? (
                <img
                  src={section.afterImageUrl}
                  alt={section.afterLabel}
                  className="h-36 w-full rounded-xl object-cover"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <ImagePlaceholder tone="after" />
              )}
            </div>
          </div>
        </div>
        <div className="space-y-3">
          {metrics.map((metric) => (
            <article key={metric.title} className="rounded-2xl border border-[#e2d7ce] bg-[#faf6f2] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7b6e64]">
                Resultat moyen
              </p>
              <p className="mt-1 text-3xl font-extrabold leading-none text-[#2f2a27]">
                {metric.value}
              </p>
              <p className="mt-1 text-sm font-semibold text-[#403935]">{metric.title}</p>
              <p className="mt-1 text-xs text-[#645a53]">{metric.description}</p>
            </article>
          ))}
          <div className="rounded-2xl border border-dashed border-[#d8cbc1] bg-[#fffaf7] px-4 py-3 text-xs text-[#665c55]">
            {section.footerNote}
          </div>
          {!section.beforeImageUrl || !section.afterImageUrl ? (
            <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              Image manquante: un placeholder premium est affiche.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
