import * as React from "react";

function toWebpCandidate(src: string) {
  if (!src) return null;
  if (src.includes(".webp")) return src;
  if (/\.(jpg|jpeg|png)(\?.*)?$/i.test(src)) {
    return src.replace(/\.(jpg|jpeg|png)(\?.*)?$/i, ".webp$2");
  }
  return null;
}

type OptimizedImageProps = Omit<React.ComponentPropsWithoutRef<"img">, "src"> & {
  src: string;
};

export function OptimizedImage({
  src,
  alt,
  loading = "lazy",
  decoding = "async",
  ...props
}: OptimizedImageProps) {
  const webpSource = toWebpCandidate(src);

  return (
    <picture>
      {webpSource ? <source srcSet={webpSource} type="image/webp" /> : null}
      <img src={src} alt={alt} loading={loading} decoding={decoding} {...props} />
    </picture>
  );
}

