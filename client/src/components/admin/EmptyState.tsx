import { type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  title: string;
  description?: string;
  ctaLabel?: string;
  onCtaClick?: () => void;
  icon?: ReactNode;
  className?: string;
};

export default function EmptyState({
  title,
  description,
  ctaLabel,
  onCtaClick,
  icon,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center",
        className
      )}
    >
      {icon ? <div className="mx-auto mb-3 flex justify-center text-muted-foreground">{icon}</div> : null}
      <h3 className="text-base font-semibold tracking-tight">{title}</h3>
      {description ? (
        <p className="mt-1 text-sm text-muted-foreground max-w-lg mx-auto">{description}</p>
      ) : null}
      {ctaLabel && onCtaClick ? (
        <Button className="mt-4" onClick={onCtaClick}>
          {ctaLabel}
        </Button>
      ) : null}
    </div>
  );
}

