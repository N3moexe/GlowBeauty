import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SectionHeaderProps = {
  kicker?: string;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  actionHref?: string;
  className?: string;
};

export default function SectionHeader({
  kicker,
  title,
  subtitle,
  actionLabel,
  actionHref,
  className,
}: SectionHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-end justify-between gap-3",
        className
      )}
    >
      <div className="ui-stack-1">
        {kicker ? <p className="section-kicker">{kicker}</p> : null}
        <h2 className="section-title">{title}</h2>
        {subtitle ? <p className="section-description">{subtitle}</p> : null}
      </div>

      {actionLabel && actionHref ? (
        <Link href={actionHref}>
          <Button variant="ghost-brand" className="rounded-xl">
            {actionLabel}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      ) : null}
    </header>
  );
}
