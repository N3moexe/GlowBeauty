import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SectionReveal from "@/components/storefront/SectionReveal";
import SeoHead from "@/components/storefront/SeoHead";
import {
  fetchPublicPage,
  STOREFRONT_PAGE_QUERY_KEY,
} from "@/lib/storefrontCms";

/**
 * Minimal, safe markdown-to-HTML renderer. We deliberately avoid a third-party
 * markdown library here — the admin editor stores user-authored content, so
 * anything we render needs to be HTML-escaped first. Formatting is restricted
 * to heading, paragraph, list, bold, italic, and links.
 */
function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderInline(raw: string): string {
  // Escape first, then apply inline formatting against the escaped string.
  let out = escapeHtml(raw);
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  // Links: [label](https://...) — only http(s) and relative /paths allowed.
  out = out.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    (_match, label: string, href: string) => {
      if (!/^(https?:\/\/|\/)/.test(href)) return `${label}`;
      const safeHref = escapeHtml(href);
      const safeLabel = label;
      return `<a href="${safeHref}" class="text-brand-accent underline hover:text-brand-accent-hover">${safeLabel}</a>`;
    }
  );
  return out;
}

function renderMarkdown(raw: string): string {
  const lines = raw.split(/\r?\n/);
  const out: string[] = [];
  let listBuffer: string[] = [];

  const flushList = () => {
    if (listBuffer.length === 0) return;
    out.push(
      `<ul class="my-4 space-y-1.5 pl-5 [list-style:disc] marker:text-brand-accent">${listBuffer.join(
        ""
      )}</ul>`
    );
    listBuffer = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.length === 0) {
      flushList();
      continue;
    }

    const listMatch = line.match(/^[-*]\s+(.+)$/);
    if (listMatch) {
      listBuffer.push(`<li>${renderInline(listMatch[1])}</li>`);
      continue;
    }
    flushList();

    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = renderInline(headingMatch[2]);
      const classes: Record<number, string> = {
        1: "mt-10 text-3xl font-semibold tracking-tight",
        2: "mt-8 text-2xl font-semibold tracking-tight",
        3: "mt-6 text-xl font-semibold",
        4: "mt-4 text-lg font-semibold",
      };
      out.push(`<h${level} class="${classes[level]}">${text}</h${level}>`);
      continue;
    }

    out.push(
      `<p class="my-3 text-[15px] leading-relaxed text-brand-muted">${renderInline(
        line
      )}</p>`
    );
  }

  flushList();
  return out.join("\n");
}

export default function PublicPage() {
  const [, params] = useRoute<{ slug: string }>("/page/:slug");
  const slug = params?.slug ?? "";

  const pageQuery = useQuery({
    queryKey: STOREFRONT_PAGE_QUERY_KEY(slug),
    queryFn: () => fetchPublicPage(slug),
    staleTime: 30_000,
    enabled: slug.length > 0,
  });

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [slug]);

  const bodyHtml = useMemo(() => {
    if (!pageQuery.data?.body) return "";
    return renderMarkdown(pageQuery.data.body);
  }, [pageQuery.data?.body]);

  const notFound = !pageQuery.isLoading && !pageQuery.data;

  return (
    <div className="page-shell flex min-h-screen flex-col">
      <SeoHead
        title={
          pageQuery.data
            ? `${pageQuery.data.title} | SenBonsPlans`
            : "Page | SenBonsPlans"
        }
        description={
          pageQuery.data?.metaDescription ||
          "Information officielle SenBonsPlans."
        }
        path={`/page/${slug}`}
        type="article"
      />

      <Navbar />

      <main className="container section-shell flex-1">
        <SectionReveal className="mx-auto max-w-3xl">
          {pageQuery.isLoading ? (
            <div className="space-y-4">
              <div className="h-8 w-3/4 animate-pulse rounded-md bg-muted/50" />
              <div className="h-4 w-full animate-pulse rounded-md bg-muted/50" />
              <div className="h-4 w-11/12 animate-pulse rounded-md bg-muted/50" />
              <div className="h-4 w-10/12 animate-pulse rounded-md bg-muted/50" />
            </div>
          ) : notFound ? (
            <div className="section-frame mx-auto max-w-xl p-10 text-center">
              <h1 className="text-2xl font-bold">Page introuvable</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Cette page n'existe pas ou n'est pas encore publiée.
              </p>
            </div>
          ) : (
            <article className="prose-ish">
              <header className="mb-6">
                <h1 className="text-3xl font-semibold tracking-tight text-brand-text md:text-4xl">
                  {pageQuery.data!.title}
                </h1>
                {pageQuery.data!.metaDescription ? (
                  <p className="mt-2 text-base text-brand-muted">
                    {pageQuery.data!.metaDescription}
                  </p>
                ) : null}
              </header>
              <div
                className="space-y-0"
                // Body is rendered from our HTML-escaped markdown renderer above.
                dangerouslySetInnerHTML={{ __html: bodyHtml }}
              />
            </article>
          )}
        </SectionReveal>
      </main>

      <Footer />
    </div>
  );
}
