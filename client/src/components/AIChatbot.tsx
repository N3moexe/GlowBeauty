import ChatWidget from "@/components/chatbot/ChatWidget";

type AIChatbotProps = {
  isOpen?: boolean;
};

export default function AIChatbot({ isOpen = false }: AIChatbotProps) {
  return <ChatWidget defaultOpen={isOpen} />;
}
