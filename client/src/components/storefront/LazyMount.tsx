import { useRef } from "react";
import { useInView } from "framer-motion";
import { cn } from "@/lib/utils";

type LazyMountProps = {
  children: React.ReactNode;
  className?: string;
  rootMargin?: string;
  minHeight?: number | string;
  fallback?: React.ReactNode;
};

export default function LazyMount({
  children,
  className,
  rootMargin = "200px 0px 200px 0px",
  minHeight,
  fallback = null,
}: LazyMountProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const isInView = useInView(ref, { once: true, margin: rootMargin as any });

  const style =
    !isInView && minHeight
      ? { minHeight: typeof minHeight === "number" ? `${minHeight}px` : minHeight }
      : undefined;

  return (
    <div ref={ref} className={cn(className)} style={style}>
      {isInView ? children : fallback}
    </div>
  );
}
