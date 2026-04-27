import { useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { storefrontMotion } from "@/lib/storefront-ui";

type SectionRevealProps = {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  yOffset?: number;
};

export default function SectionReveal({
  children,
  className,
  delay = 0,
  yOffset = storefrontMotion.section.yOffset,
}: SectionRevealProps) {
  const shouldReduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement | null>(null);
  const isInView = useInView(ref, { once: true, margin: storefrontMotion.section.inViewMargin });

  if (shouldReduceMotion) {
    return (
      <div ref={ref} className={className}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      ref={ref}
      className={cn(className)}
      initial={{ opacity: 0, y: yOffset }}
      animate={isInView ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: storefrontMotion.duration.reveal, delay, ease: storefrontMotion.ease.reveal }}
    >
      {children}
    </motion.div>
  );
}
