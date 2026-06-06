import { useState } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

type MediaWithFallbackProps = Omit<React.ComponentProps<"img">, "src"> & {
  src?: string | null;
  wrapperClassName?: string;
  fallbackClassName?: string;
  fallbackLabel?: string;
  /**
   * How the image fills its box. "cover" (default) fills and crops overflow;
   * "contain" shows the whole image centered on a neutral surface (no crop).
   */
  fit?: "cover" | "contain";
};

export function MediaWithFallback({
  src,
  alt,
  className,
  wrapperClassName,
  fallbackClassName,
  fallbackLabel = "Image indisponible",
  fit = "cover",
  loading = "lazy",
  decoding = "async",
  onError,
  ...props
}: MediaWithFallbackProps) {
  const [failed, setFailed] = useState(false);
  const resolvedSrc = (src || "").trim();
  const canRenderImage = resolvedSrc.length > 0 && !failed;

  if (!canRenderImage) {
    return (
      <div
        className={cn(
          "flex h-full w-full flex-col items-center justify-center gap-2 bg-[linear-gradient(145deg,#f6ece6_0%,#e8d8cf_100%)] text-[#70524f]",
          wrapperClassName,
          fallbackClassName
        )}
      >
        <ImageOff className="h-6 w-6" aria-hidden="true" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em]">
          {fallbackLabel}
        </p>
      </div>
    );
  }

  return (
    <picture
      className={cn(
        "block h-full w-full",
        fit === "contain" && "bg-brand-muted/10",
        wrapperClassName
      )}
    >
      <img
        src={resolvedSrc}
        alt={alt}
        loading={loading}
        decoding={decoding}
        className={cn(
          "h-full w-full",
          fit === "contain" ? "object-contain" : "object-cover",
          className
        )}
        onError={event => {
          setFailed(true);
          onError?.(event);
        }}
        {...props}
      />
    </picture>
  );
}
