import { useChatbotSession, type ChatAttachmentInput } from "@/hooks/useChatbotSession";
import { useCart } from "@/contexts/CartContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Link, useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpRight,
  Bot,
  ImagePlus,
  Loader2,
  MessageCircle,
  Send,
  User,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { toast } from "sonner";

type ChatPanelProps = {
  mode: "widget" | "page";
  onClose?: () => void;
};

const ENTER_SUBMIT_DEBOUNCE_MS = 300;

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function formatCfa(value: number) {
  return `${new Intl.NumberFormat("fr-FR").format(Math.round(value || 0))} CFA`;
}

function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Unable to read image"));
    };
    reader.onerror = () => reject(new Error("Unable to read image"));
    reader.readAsDataURL(file);
  });
}

export default function ChatPanel({ mode, onClose }: ChatPanelProps) {
  const { items, addItem } = useCart();
  const [location] = useLocation();
  const {
    settings,
    messages,
    quickReplies,
    loading,
    sending,
    isTyping,
    error,
    sendMessage,
    startWhatsAppHandoff,
  } = useChatbotSession("fr-SN");

  const [input, setInput] = useState("");
  const [attachment, setAttachment] = useState<ChatAttachmentInput | null>(null);
  const [handoffPending, setHandoffPending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const previousMessageCountRef = useRef(0);
  const submitLockRef = useRef(false);
  const lastEnterSubmitAtRef = useRef(0);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const behavior: ScrollBehavior =
      messages.length > previousMessageCountRef.current ? "smooth" : "auto";
    bottomRef.current?.scrollIntoView({ behavior, block: "end" });
    previousMessageCountRef.current = messages.length;
  }, [messages]);

  useEffect(() => {
    if (!error) return;
    toast.error(error);
  }, [error]);

  const preparedCartItems = useMemo(
    () =>
      items.slice(0, 10).map((item) => ({
        productId: item.productId,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
      })),
    [items]
  );
  const uniqueQuickReplies = useMemo(
    () => Array.from(new Set(quickReplies.filter(Boolean))),
    [quickReplies]
  );
  const shouldShowTyping = useMemo(() => {
    if (!isTyping) return false;
    const last = messages[messages.length - 1];
    if (!last) return true;
    if (last.role !== "assistant") return true;
    return (last.content || "").trim().length === 0;
  }, [isTyping, messages]);

  const handleSubmit = async (value: string) => {
    const text = value.trim();
    if (!text || sending || submitLockRef.current) return;
    submitLockRef.current = true;
    const context = {
      page: location,
      cartItems: preparedCartItems,
      attachments: attachment ? [attachment] : undefined,
    };
    try {
      const sent = await sendMessage(text, context);
      if (sent) {
        setInput("");
        setAttachment(null);
      }
    } finally {
      submitLockRef.current = false;
      window.requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  };

  const handleAttachmentPick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Only image attachments are supported.");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast.error("Image is too large (max 3 MB).");
      return;
    }
    try {
      const dataUrl = await toDataUrl(file);
      setAttachment({
        name: file.name,
        type: file.type,
        dataUrl,
      });
      toast.success("Image attached");
    } catch {
      toast.error("Failed to process image");
    } finally {
      event.target.value = "";
    }
  };

  const handleHandoff = async () => {
    setHandoffPending(true);
    try {
      const url = await startWhatsAppHandoff(
        "Bonjour, j'ai besoin d'assistance humaine pour ma commande."
      );
      if (!url) {
        toast.error("WhatsApp number is not configured.");
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setHandoffPending(false);
    }
  };

  return (
    <div
      className={
        mode === "widget"
          ? "flex h-[min(78vh,680px)] min-h-0 w-full max-w-[420px] flex-col overflow-hidden rounded-2xl border border-[#e6d7cd] bg-[linear-gradient(180deg,#fffdfa_0%,#f8f2ec_100%)] shadow-[0_34px_74px_-44px_rgba(58,36,27,0.52)]"
          : "flex h-[calc(100vh-132px)] min-h-[560px] w-full flex-col overflow-hidden rounded-2xl border border-[#e6d7cd] bg-[linear-gradient(180deg,#fffdfa_0%,#f8f2ec_100%)] shadow-[0_28px_60px_-48px_rgba(58,36,27,0.52)]"
      }
    >
      <div className="relative overflow-hidden border-b border-[#e7d9ce] bg-[linear-gradient(120deg,#8f5f68_0%,#b57a84_100%)] px-4 py-3 text-white">
        <div className="pointer-events-none absolute -left-8 -top-10 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -right-6 bottom-0 h-20 w-20 rounded-full bg-white/15 blur-2xl" />
        <div className="relative flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Avatar className="h-9 w-9 border border-white/40 bg-white/20">
              <AvatarFallback className="bg-transparent text-white">
                <Bot className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-semibold">{settings?.businessName || "SenBonsPlans"}</p>
              <p className="text-[11px] text-white/85">
                {sending ? "Typing..." : "Assistant skincare et commandes"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {mode === "widget" ? (
              <Link href="/chat">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-8 border-0 bg-white/20 text-white hover:bg-white/30"
                >
                  Full chat
                  <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              </Link>
            ) : null}
            {onClose ? (
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                className="h-8 w-8 text-white hover:bg-white/20"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1 px-3 py-3 md:px-4">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-[#6e625b]">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Preparing your assistant...
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => {
              const isUser = message.role === "user";
              return (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.16 }}
                  className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                >
                  <div className={`flex max-w-[78%] items-end gap-2 ${isUser ? "flex-row-reverse" : ""}`}>
                    <Avatar className={`h-7 w-7 ${isUser ? "bg-[#b57a84]" : "bg-[#d9c5bb]"}`}>
                      <AvatarFallback
                        className={`text-[11px] ${isUser ? "bg-[#b57a84] text-white" : "bg-[#d9c5bb] text-[#5b4d47]"}`}
                      >
                        {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                      </AvatarFallback>
                    </Avatar>
                    <div
                      className={
                        isUser
                          ? "rounded-[20px] rounded-br-md bg-[linear-gradient(135deg,#8f5f68_0%,#b57a84_100%)] px-4 py-2.5 text-white shadow-[0_14px_28px_-20px_rgba(62,35,45,0.7)]"
                          : "rounded-[20px] rounded-bl-md border border-[#e8ddd4] bg-white/95 px-4 py-2.5 text-[#433833] shadow-[0_10px_24px_-22px_rgba(62,45,39,0.55)]"
                      }
                    >
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content || "..."}</p>

                      {!isUser && message.recommendedProducts?.length ? (
                        <div className="mt-2.5 space-y-2">
                          {message.recommendedProducts.slice(0, 3).map((product) => (
                            <div
                              key={`${message.id}-${product.id}`}
                              className="block rounded-xl border border-[#e5d8cc] bg-[#faf5f0] p-2 transition hover:border-[#cfb3a4]"
                            >
                              <a href={product.url} className="block">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="truncate text-xs font-semibold text-[#4a3f39]">
                                      {product.name}
                                    </p>
                                    <p className="text-[11px] text-[#766963]">
                                      {formatCfa(product.price)}
                                    </p>
                                  </div>
                                  <Badge
                                    variant="outline"
                                    className="border-[#d6c1b4] bg-white text-[10px] text-[#6f5f57]"
                                  >
                                    {product.inStock ? "In stock" : "Out"}
                                  </Badge>
                                </div>
                              </a>
                              <div className="mt-2 flex justify-end">
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={!product.inStock}
                                  onClick={() => {
                                    addItem(
                                      {
                                        productId: product.id,
                                        name: product.name,
                                        price: product.price,
                                        imageUrl: product.imageUrl || "",
                                      },
                                      1
                                    );
                                    toast.success("Produit ajoute au panier");
                                  }}
                                  className="h-7 rounded-full bg-[#8f5f68] px-3 text-[11px] text-white hover:bg-[#7f525a]"
                                >
                                  Ajouter au panier
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      <div className={`mt-1.5 text-[11px] ${isUser ? "text-white/80" : "text-[#8b7c74]"}`}>
                        <span>{formatTime(message.createdAt)}</span>
                        {message.status === "error" ? (
                          <span className="ml-1.5">• Echec</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}

            <AnimatePresence>
              {shouldShowTyping ? (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  className="flex justify-start"
                >
                  <div className="rounded-2xl rounded-bl-md border border-[#e6dbd2] bg-white/90 px-3 py-2 text-[#5f534d]">
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8f5f68]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8f5f68] [animation-delay:100ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8f5f68] [animation-delay:200ms]" />
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>

            <div ref={bottomRef} />
          </div>
        )}
      </ScrollArea>

      <div className="border-t border-[#e8ddd2] bg-[#fffaf6] px-3 py-3 md:px-4">
        {uniqueQuickReplies.length ? (
          <div className="mb-2 flex flex-wrap gap-2">
            {uniqueQuickReplies.slice(0, 6).map((reply) => (
              <Button
                key={reply}
                type="button"
                size="sm"
                variant="outline"
                disabled={sending}
                onClick={() => {
                  void handleSubmit(reply);
                }}
                className="h-7 rounded-full border-[#d8c6bc] bg-white text-[11px] text-[#5d4d46] hover:bg-[#f7efea]"
              >
                {reply}
              </Button>
            ))}
          </div>
        ) : null}

        {attachment ? (
          <div className="mb-2 flex items-center justify-between rounded-xl border border-[#e3d3c7] bg-white px-2 py-1.5 text-xs text-[#5f534d]">
            <span className="truncate pr-2">{attachment.name}</span>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className="h-6 w-6"
              onClick={() => setAttachment(null)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : null}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit(input);
          }}
          className="flex items-center gap-2"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAttachmentPick}
          />
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            disabled={sending}
            onClick={() => fileInputRef.current?.click()}
            className="h-9 w-9 border-[#dbc8bd] bg-white text-[#735f56]"
          >
            <ImagePlus className="h-4 w-4" />
          </Button>
          <Input
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
              const now = Date.now();
              if (sending || now - lastEnterSubmitAtRef.current < ENTER_SUBMIT_DEBOUNCE_MS) {
                event.preventDefault();
                return;
              }
              lastEnterSubmitAtRef.current = now;
            }}
            placeholder="Ask about products, orders, shipping..."
            className="h-9 border-[#dbc8bd] bg-white"
          />
          <Button
            type="submit"
            size="icon-sm"
            disabled={sending || input.trim().length === 0}
            className="h-9 w-9 bg-[#8f5f68] text-white hover:bg-[#7f525a]"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>

        <div className="mt-2 flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              void handleHandoff();
            }}
            disabled={handoffPending}
            className="h-8 px-2 text-xs text-[#5f4e47] hover:bg-[#f3e8e0]"
          >
            {handoffPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
            )}
            Talk to human on WhatsApp
          </Button>
          <span className="text-[11px] text-[#8c7c73]">Fast replies, 7j/7</span>
        </div>
      </div>
    </div>
  );
}


