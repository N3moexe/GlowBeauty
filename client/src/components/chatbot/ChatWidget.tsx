import ChatPanel from "@/components/chatbot/ChatPanel";
import { Button } from "@/components/ui/button";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, X } from "lucide-react";
import { useEffect, useState } from "react";

const WIDGET_OPEN_KEY = "sbp_chat_widget_open_v1";

type ChatWidgetProps = {
  defaultOpen?: boolean;
};

export default function ChatWidget({ defaultOpen = false }: ChatWidgetProps) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    const persisted = window.localStorage.getItem(WIDGET_OPEN_KEY);
    if (persisted === "1") setOpen(true);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(WIDGET_OPEN_KEY, open ? "1" : "0");
  }, [open]);

  return (
    <div className="pointer-events-none fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-[120] flex max-w-[calc(100vw-24px)] flex-col items-end gap-3 md:bottom-6 md:right-6">
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-auto w-[min(420px,calc(100vw-24px))]"
          >
            <ChatPanel mode="widget" onClose={() => setOpen(false)} />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <Button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        aria-label={open ? "Fermer le chat" : "Besoin d'aide — ouvrir le chat"}
        className="group pointer-events-auto h-12 w-12 overflow-hidden rounded-full bg-brand-accent p-0 text-white shadow-[0_18px_38px_-22px_rgba(193,39,79,0.55)] transition-[width] duration-200 ease-out hover:w-auto hover:bg-brand-accent/95 hover:px-4 focus-visible:w-auto focus-visible:px-4"
      >
        {open ? (
          <X className="h-5 w-5 shrink-0" />
        ) : (
          <MessageCircle className="h-5 w-5 shrink-0" />
        )}
        <span className="ml-0 max-w-0 overflow-hidden whitespace-nowrap text-sm font-semibold opacity-0 transition-[max-width,margin,opacity] duration-200 ease-out group-hover:ml-2 group-hover:max-w-[160px] group-hover:opacity-100 group-focus-visible:ml-2 group-focus-visible:max-w-[160px] group-focus-visible:opacity-100">
          {open ? "Fermer" : "Besoin d'aide ?"}
        </span>
      </Button>
    </div>
  );
}
