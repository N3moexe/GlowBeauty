import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchStorefrontIntegrations,
  STOREFRONT_INTEGRATIONS_QUERY_KEY,
} from "@/lib/storefrontCms";

/**
 * Injects marketing / analytics scripts when the admin has configured them.
 * Nothing loads when the corresponding ID is empty — zero cost when unused,
 * zero third-party requests, clean dev experience.
 *
 * Each pixel attaches a single <script> with a deduping data attribute so
 * React StrictMode double-mounts don't duplicate the load.
 */
function attachScript(attrKey: string, src: string, async = true) {
  if (document.querySelector(`script[${attrKey}]`)) return;
  const script = document.createElement("script");
  script.setAttribute(attrKey, "1");
  script.src = src;
  script.async = async;
  document.head.appendChild(script);
}

function attachInlineScript(attrKey: string, contents: string) {
  if (document.querySelector(`script[${attrKey}]`)) return;
  const script = document.createElement("script");
  script.setAttribute(attrKey, "1");
  script.text = contents;
  document.head.appendChild(script);
}

function attachNoscriptImg(attrKey: string, src: string) {
  if (document.querySelector(`noscript[${attrKey}]`)) return;
  const noscript = document.createElement("noscript");
  noscript.setAttribute(attrKey, "1");
  const img = document.createElement("img");
  img.setAttribute("height", "1");
  img.setAttribute("width", "1");
  img.setAttribute("style", "display:none");
  img.src = src;
  noscript.appendChild(img);
  document.head.appendChild(noscript);
}

export default function IntegrationsLoader() {
  const lastIntegrations = useRef<string>("");
  const integrationsQuery = useQuery({
    queryKey: STOREFRONT_INTEGRATIONS_QUERY_KEY,
    queryFn: fetchStorefrontIntegrations,
    staleTime: 60_000,
  });

  useEffect(() => {
    const data = integrationsQuery.data;
    if (!data) return;

    // Serialized for dedupe; if the admin changes a value, this effect re-runs.
    const fingerprint = JSON.stringify(data);
    if (fingerprint === lastIntegrations.current) return;
    lastIntegrations.current = fingerprint;

    // ── Google Analytics 4 ──
    if (data.ga4MeasurementId && /^G-[A-Z0-9]+$/i.test(data.ga4MeasurementId)) {
      const id = data.ga4MeasurementId;
      attachScript("data-ga4-src", `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`);
      attachInlineScript(
        "data-ga4-init",
        `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}',{anonymize_ip:true});`
      );
    }

    // ── Meta (Facebook) Pixel ──
    if (data.metaPixelId && /^\d+$/.test(data.metaPixelId)) {
      const id = data.metaPixelId;
      attachInlineScript(
        "data-meta-pixel",
        `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${id}');fbq('track','PageView');`
      );
      attachNoscriptImg(
        "data-meta-pixel-ns",
        `https://www.facebook.com/tr?id=${encodeURIComponent(id)}&ev=PageView&noscript=1`
      );
    }

    // ── TikTok Pixel ──
    if (data.tiktokPixelId && /^[A-Z0-9]+$/i.test(data.tiktokPixelId)) {
      const id = data.tiktokPixelId;
      attachInlineScript(
        "data-tiktok-pixel",
        `!function (w, d, t) {w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${id}');ttq.page();}(window, document, 'ttq');`
      );
    }
  }, [integrationsQuery.data]);

  return null;
}
