import { useState } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

function toWebpCandidate(src: string) {
  if (!src) return null;
  if (src.includes(".webp")) return src;
  if (/\.(jpg|jpeg|png)(\?.*)?$/i.test(src)) {
    return src.replace(/\.(jpg|jpeg|png)(\?.*)?$/i, ".webp$2");
  }
  return null;
}

type MediaWithFallbackProps = Omit<React.ComponentProps<"img">, "src"> & {
  src?: string | null;
  wrapperClassName?: string;
  fallbackClassName?: string;
  fallbackLabel?: string;
};

export function MediaWithFallback({
  src,
  alt,
  className,
  wrapperClassName,
  fallbackClassName,
  fallbackLabel = "Image indisponible",
  loading = "lazy",
  decoding = "async",
  onError,
  ...props
}: MediaWithFallbackProps) {
  const [failed, setFailed] = useState(false);
  const resolvedSrc = (src || "").trim();
  const canRenderImage = resolvedSrc.length > 0 && !failed;
  const webpSource = toWebpCandidate(resolvedSrc);

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
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em]">{fallbackLabel}</p>
      </div>
    );
  }

  return (
    <picture className={cn("block h-full w-full", wrapperClassName)}>
      {webpSource ? <source srcSet={webpSource} type="image/webp" /> : null}
      <img
        src={resolvedSrc}
        alt={alt}
        loading={loading}
        decoding={decoding}
        className={cn("h-full w-full object-cover", className)}
        onError={(event) => {
          setFailed(true);
          onError?.(event);
        }}
        {...props}
      />
    </picture>
  );
}

