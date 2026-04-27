import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  subscribeNewsletter,
  confirmNewsletter,
  unsubscribeNewsletter,
  getNewsletterSubscriberByEmail,
  __resetDemoNewsletterForTests,
} from "./db";

beforeEach(() => {
  __resetDemoNewsletterForTests();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("newsletter double opt-in (demo branch)", () => {
  it("subscribe sets status to PENDING and issues a confirmation token", async () => {
    const result = await subscribeNewsletter({
      email: "alice@example.com",
      source: "homepage",
      locale: "fr",
      ip: "::1",
    });

    expect(result.already).toBe(false);
    expect(result.pending).toBe(true);
    expect(result.confirmationToken).toBeTruthy();
    expect(result.confirmationToken!.length).toBeGreaterThanOrEqual(32);

    const row = await getNewsletterSubscriberByEmail("alice@example.com");
    expect(row?.status).toBe("PENDING");
    expect(row?.confirmedAt).toBeNull();
  });

  it("subscribing the same email again re-issues a fresh token while pending", async () => {
    const first = await subscribeNewsletter({ email: "bob@example.com" });
    const second = await subscribeNewsletter({ email: "bob@example.com" });

    expect(second.already).toBe(false);
    expect(second.pending).toBe(true);
    expect(second.confirmationToken).not.toBe(first.confirmationToken);
  });

  it("confirmNewsletter flips a PENDING subscriber to SUBSCRIBED and clears the token", async () => {
    const { confirmationToken } = await subscribeNewsletter({
      email: "carol@example.com",
    });
    expect(confirmationToken).toBeTruthy();

    const result = await confirmNewsletter(confirmationToken!);

    expect(result.ok).toBe(true);
    expect(result.email).toBe("carol@example.com");

    const row = await getNewsletterSubscriberByEmail("carol@example.com");
    expect(row?.status).toBe("SUBSCRIBED");
    expect(row?.confirmedAt).toBeInstanceOf(Date);
    expect(row?.confirmationToken).toBeNull();
  });

  it("confirmNewsletter rejects an unknown token", async () => {
    const result = await confirmNewsletter(
      "not-a-real-token-xxxxxxxxxxxxxxxxx"
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("unknown");
  });

  it("confirmNewsletter rejects an expired token", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));

    const { confirmationToken } = await subscribeNewsletter({
      email: "dave@example.com",
    });
    expect(confirmationToken).toBeTruthy();

    // Advance past the 24h expiry window.
    vi.setSystemTime(new Date("2026-01-03T00:00:00Z"));

    const result = await confirmNewsletter(confirmationToken!);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("expired");
  });

  it("subscribing an already-SUBSCRIBED email returns already=true and sends no new token", async () => {
    const { confirmationToken } = await subscribeNewsletter({
      email: "erin@example.com",
    });
    await confirmNewsletter(confirmationToken!);

    const again = await subscribeNewsletter({ email: "erin@example.com" });
    expect(again.already).toBe(true);
    expect(again.pending).toBe(false);
    expect(again.confirmationToken).toBeNull();
  });

  it("unsubscribe erases PII (ip, userAgent) but keeps the email for suppression", async () => {
    await subscribeNewsletter({
      email: "frank@example.com",
      ip: "203.0.113.7",
      userAgent: "Mozilla/ExampleUA",
    });

    await unsubscribeNewsletter("frank@example.com");

    const row = await getNewsletterSubscriberByEmail("frank@example.com");
    expect(row?.status).toBe("UNSUBSCRIBED");
    expect(row?.ip).toBeNull();
    expect(row?.userAgent).toBeNull();
    expect(row?.email).toBe("frank@example.com");
  });
});
