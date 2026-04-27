import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const cardVariants = cva(
  "bg-card text-card-foreground flex flex-col gap-6 rounded-[1.35rem] border py-6 shadow-sm transition-[transform,box-shadow,border-color,background-color] duration-200 motion-reduce:transition-none",
  {
    variants: {
      variant: {
        default: "border-brand-border/75",
        elevated: "border-brand-border/70 shadow-[0_20px_42px_-30px_rgba(58,37,33,0.52)]",
        subtle: "border-brand-border/65 bg-card/95",
        interactive:
          "border-brand-border/70 hover:-translate-y-1 hover:shadow-[0_26px_48px_-32px_rgba(58,37,33,0.58)] motion-reduce:hover:translate-y-0",
        premium:
          "border-brand-border/65 bg-[linear-gradient(155deg,#fffaf7_0%,#f5ece6_100%)] shadow-[0_24px_54px_-34px_rgba(58,37,33,0.54)]",
        glass:
          "border-white/25 bg-white/58 shadow-[0_18px_36px_-30px_rgba(35,22,19,0.42)] backdrop-blur dark:border-white/10 dark:bg-black/30",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Card({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof cardVariants>) {
  return (
    <div
      data-slot="card"
      className={cn(cardVariants({ variant }), className)}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("leading-none font-semibold", className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-6", className)}
      {...props}
    />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center px-6 [.border-t]:pt-6", className)}
      {...props}
    />
  );
}

export {
  Card,
  cardVariants,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
};
