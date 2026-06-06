import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type HeadingProps = {
  children: ReactNode;
  level?: 1 | 2 | 3;
  className?: string;
};

export function Heading({ children, level = 2, className }: HeadingProps) {
  const Tag = `h${level}` as "h1" | "h2" | "h3";
  const sizes = {
    1: "text-3xl md:text-4xl",
    2: "text-2xl md:text-3xl",
    3: "text-xl",
  };
  return (
    <Tag
      className={cn(
        "font-semibold tracking-tight text-[var(--admin-ink)]",
        "[font-family:var(--font-admin-display)]",
        sizes[level],
        className
      )}
    >
      {children}
    </Tag>
  );
}
