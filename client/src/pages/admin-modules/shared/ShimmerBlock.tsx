import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function ShimmerBlock({ className }: { className?: string }) {
  return (
    <motion.div
      className={cn(
        "rounded-md bg-[linear-gradient(110deg,rgba(233,223,214,0.45)_8%,rgba(255,247,240,0.9)_18%,rgba(233,223,214,0.45)_33%)] bg-[length:220%_100%]",
        className
      )}
      initial={{ backgroundPosition: "200% 0" }}
      animate={{ backgroundPosition: "-200% 0" }}
      transition={{ repeat: Infinity, duration: 1.1, ease: "linear" }}
    />
  );
}
