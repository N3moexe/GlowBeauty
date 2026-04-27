import { trpc } from "@/lib/trpc";
import { trackAnalyticsEvent } from "@/lib/analyticsEvents";
import { useEffect, useRef } from "react";
import { useLocation } from "wouter";

function getVisitorId(): string {
  const key = "sbp_vid";
  let id = localStorage.getItem(key);
  if (!id) {
    id = Math.random().toString(36).substring(2) + Date.now().toString(36);
    localStorage.setItem(key, id);
  }
  return id;
}

function getSessionId(): string {
  const key = "sbp_sid";
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = Math.random().toString(36).substring(2) + Date.now().toString(36);
    sessionStorage.setItem(key, id);
  }
  return id;
}

export function usePageTracking() {
  const [location] = useLocation();
  const track = trpc.analytics.track.useMutation();
  const lastTracked = useRef("");

  useEffect(() => {
    if (location === lastTracked.current) return;
    lastTracked.current = location;

    const visitorId = getVisitorId();
    const sessionId = getSessionId();

    track.mutate({
      page: location,
      visitorId,
      sessionId,
      referrer: document.referrer || undefined,
    });

    trackAnalyticsEvent({
      type: "page_view",
      path: location,
      meta: {
        referrer: document.referrer || undefined,
      },
    });
  }, [location]);
}
