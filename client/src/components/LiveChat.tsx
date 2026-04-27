import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { MessageCircle, X, Send } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { nanoid } from "nanoid";

export default function LiveChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [sessionId] = useState(() => nanoid());
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: chatHistory } = trpc.chat.history.useQuery(
    { sessionId },
    { enabled: isOpen }
  );

  const sendMessageMutation = trpc.chat.send.useMutation({
    onSuccess: () => {
      setMessage("");
      // Refetch chat history
      const fetchHistory = async () => {
        const history = await trpc.useUtils().client.chat.history.query({
          sessionId,
        });
        setMessages(history || []);
      };
      fetchHistory();
    },
    onError: (error) => {
      toast.error(error.message || "Erreur");
    },
  });

  useEffect(() => {
    if (chatHistory) {
      setMessages(chatHistory);
    }
  }, [chatHistory]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!message.trim() || !customerName || !customerEmail) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }

    setIsLoading(true);
    try {
      await sendMessageMutation.mutateAsync({
        sessionId,
        customerName,
        customerEmail,
        message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-crimson hover:bg-crimson-light text-white shadow-lg flex items-center justify-center transition-all hover:scale-110 z-40"
      >
        <MessageCircle className="h-6 w-6" />
      </button>
    );
  }

  return (
    <Card className="fixed bottom-6 right-6 w-96 max-h-96 flex flex-col shadow-2xl z-50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-crimson text-white rounded-t-lg">
        <h3 className="font-semibold">Support Client</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="hover:bg-crimson-light p-1 rounded transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Bienvenue ! Comment pouvons-nous vous aider ?
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.isFromCustomer ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                  msg.isFromCustomer
                    ? "bg-crimson text-white"
                    : "bg-muted text-foreground"
                }`}
              >
                {msg.message}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t p-4 space-y-2 bg-muted/50 rounded-b-lg">
        {messages.length === 0 && (
          <>
            <Input
              placeholder="Votre nom"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              disabled={isLoading}
              className="text-sm"
            />
            <Input
              type="email"
              placeholder="Votre email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              disabled={isLoading}
              className="text-sm"
            />
          </>
        )}
        <div className="flex gap-2">
          <Input
            placeholder="Votre message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
            disabled={isLoading}
            className="text-sm"
          />
          <Button
            onClick={handleSendMessage}
            disabled={isLoading || !message.trim()}
            size="sm"
            className="bg-crimson hover:bg-crimson-light text-white px-3"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
