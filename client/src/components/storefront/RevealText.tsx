import {
  useRef,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { storefrontMotion } from "@/lib/storefront-ui";

type RevealTextProps = {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  delay?: number;
  stagger?: number;
  yOffset?: number;
  replay?: boolean;
  style?: CSSProperties;
};

function toWords(value: ReactNode): string[] {
  if (typeof value === "string") {
    return value.split(/\s+/).filter(Boolean);
  }
  if (typeof value === "number") {
    return [String(value)];
  }
  if (Array.isArray(value)) {
    return value.flatMap(toWords);
  }
  return [];
}

export default function RevealText({
  children,
  as,
  className,
  delay = 0,
  stagger = storefrontMotion.stagger.headline,
  yOffset = 26,
  replay = false,
  style,
}: RevealTextProps) {
  const Tag = (as ?? "span") as ElementType;
  const shouldReduceMotion = useReducedMotion();
  const ref = useRef<HTMLElement | null>(null);
  const isInView = useInView(ref, {
    once: !replay,
    margin: storefrontMotion.section.inViewMargin,
  });

  const words = toWords(children);

  if (shouldReduceMotion || words.length === 0) {
    return (
      <Tag ref={ref} className={className} style={style}>
        {children}
      </Tag>
    );
  }

  const container = {
    hidden: {},
    visible: {
      transition: {
        delayChildren: delay,
        staggerChildren: stagger,
      },
    },
  };

  const word = {
    hidden: { y: yOffset, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: storefrontMotion.duration.signature,
        ease: storefrontMotion.ease.poured,
      },
    },
  };

  return (
    <Tag ref={ref} className={className} style={style}>
      <motion.span
        aria-hidden="true"
        className="inline"
        initial="hidden"
        animate={isInView ? "visible" : "hidden"}
        variants={container}
      >
        {words.map((token, index) => (
          <motion.span
            key={`${token}-${index}`}
            variants={word}
            className="inline-block whitespace-pre will-change-transform"
          >
            {token}
            {index < words.length - 1 ? " " : ""}
          </motion.span>
        ))}
      </motion.span>
      <span className="sr-only">{words.join(" ")}</span>
    </Tag>
  );
}
