import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "framer-motion";
import { cn } from "@/lib/utils";
import { storefrontMotion } from "@/lib/storefront-ui";

type MagneticProps = {
  children: ReactNode;
  className?: string;
  range?: number;
  disabled?: boolean;
};

export default function Magnetic({
  children,
  className,
  range = storefrontMotion.magnetic.range,
  disabled = false,
}: MagneticProps) {
  const shouldReduceMotion = useReducedMotion();
  const ref = useRef<HTMLSpanElement | null>(null);
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(pointer: coarse)");
    const update = () => setIsCoarsePointer(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const xs = useSpring(x, storefrontMotion.magnetic.spring);
  const ys = useSpring(y, storefrontMotion.magnetic.spring);

  const inactive = shouldReduceMotion || isCoarsePointer || disabled;

  const handleMouseMove = (event: React.MouseEvent<HTMLSpanElement>) => {
    if (inactive || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const relX = event.clientX - rect.left - rect.width / 2;
    const relY = event.clientY - rect.top - rect.height / 2;
    const half = Math.max(rect.width, rect.height) / 2 || 1;
    x.set((relX / half) * range);
    y.set((relY / half) * range);
  };

  const handleMouseLeave = () => {
    if (inactive) return;
    x.set(0);
    y.set(0);
  };

  if (inactive) {
    return <span className={cn("inline-flex", className)}>{children}</span>;
  }

  return (
    <motion.span
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ x: xs, y: ys }}
      className={cn("inline-flex will-change-transform", className)}
    >
      {children}
    </motion.span>
  );
}
