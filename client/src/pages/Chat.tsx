import Navbar from "@/components/Navbar";
import ChatPanel from "@/components/chatbot/ChatPanel";
import SeoHead from "@/components/storefront/SeoHead";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

export default function Chat() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_0%_0%,rgba(182,124,134,0.12),transparent_34%),radial-gradient(circle_at_100%_100%,rgba(160,175,147,0.16),transparent_30%),linear-gradient(180deg,#fcf8f4_0%,#f5eee7_100%)]">
      <SeoHead
        title="Chat support | SenBonsPlans"
        description="Assistant support and shopping chat for SenBonsPlans."
      />
      <Navbar />
      <main className="mx-auto w-full max-w-6xl px-4 pb-8 pt-6 md:px-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#3f342f]">
              Customer assistant
            </h1>
            <p className="text-sm text-[#6c5f58]">
              Get product help, order tracking, shipping details, and live handoff.
            </p>
          </div>
          <Link href="/boutique">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#ddcdc2] bg-white/90 px-3 py-1.5 text-sm text-[#5a4f49] transition hover:bg-white">
              <ArrowLeft className="h-4 w-4" />
              Continue shopping
            </span>
          </Link>
        </div>

        <ChatPanel mode="page" />
      </main>
    </div>
  );
}
