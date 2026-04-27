import { useEffect, useMemo } from "react";

type JsonLdPayload = Record<string, unknown>;

type SeoHeadProps = {
  title: string;
  description: string;
  path?: string;
  image?: string;
  robots?: string;
  type?: "website" | "product" | "article";
  jsonLd?: JsonLdPayload | JsonLdPayload[];
};

function normalizePath(path: string) {
  if (!path) return "/";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return path.startsWith("/") ? path : `/${path}`;
}

function upsertMetaByName(name: string, content: string) {
  let meta = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", name);
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", content);
}

function upsertMetaByProperty(property: string, content: string) {
  let meta = document.head.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("property", property);
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", content);
}

function upsertCanonicalLink(url: string) {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    document.head.appendChild(link);
  }
  link.setAttribute("href", url);
}

export default function SeoHead({
  title,
  description,
  path = "/",
  image,
  robots = "index, follow",
  type = "website",
  jsonLd,
}: SeoHeadProps) {
  const payloads = useMemo(() => {
    if (!jsonLd) return [];
    return Array.isArray(jsonLd) ? jsonLd : [jsonLd];
  }, [jsonLd]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    const normalizedPath = normalizePath(path);
    const canonicalUrl =
      normalizedPath.startsWith("http://") || normalizedPath.startsWith("https://")
        ? normalizedPath
        : `${window.location.origin}${normalizedPath}`;

    document.documentElement.setAttribute("lang", "fr");
    document.title = title;

    upsertMetaByName("description", description);
    upsertMetaByName("robots", robots);

    upsertMetaByProperty("og:title", title);
    upsertMetaByProperty("og:description", description);
    upsertMetaByProperty("og:type", type);
    upsertMetaByProperty("og:url", canonicalUrl);

    upsertMetaByName("twitter:card", image ? "summary_large_image" : "summary");
    upsertMetaByName("twitter:title", title);
    upsertMetaByName("twitter:description", description);

    if (image) {
      upsertMetaByProperty("og:image", image);
      upsertMetaByName("twitter:image", image);
    }

    upsertCanonicalLink(canonicalUrl);

    const createdScripts: HTMLScriptElement[] = [];
    payloads.forEach((payload) => {
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.setAttribute("data-seo-jsonld", "true");
      script.textContent = JSON.stringify(payload);
      document.head.appendChild(script);
      createdScripts.push(script);
    });

    return () => {
      createdScripts.forEach((script) => script.remove());
    };
  }, [description, image, path, payloads, robots, title, type]);

  return null;
}
