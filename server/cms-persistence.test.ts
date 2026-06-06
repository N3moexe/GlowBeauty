import { describe, expect, it } from "vitest";
import {
  getHomepageLayout,
  setHomepageLayout,
  hydrateStorefrontCmsFromDb,
} from "./storefront-cms-store";
import { getStoreSetting, setStoreSetting } from "./db";

// These run against the DB-less demo store (no DATABASE_URL in the test env),
// which uses the same getStoreSetting/setStoreSetting calls the production
// MySQL path uses — so the round-trip contract is exercised either way.

type AnySection = { type: string; title?: string };

function heroTitle(layout: { sections: AnySection[] }) {
  return layout.sections.find(s => s.type === "hero")?.title;
}

describe("storefront CMS persistence", () => {
  it("setHomepageLayout persists to the store and hydrate reloads it", async () => {
    const base = getHomepageLayout();
    expect(heroTitle(base)).toBeTruthy();

    const edited = JSON.parse(JSON.stringify(base));
    const hero = edited.sections.find((s: AnySection) => s.type === "hero");
    const MARK = "PERSIST-TEST-TITLE";
    hero.title = MARK;

    await setHomepageLayout(edited);

    // It reached the persistence layer...
    const raw = await getStoreSetting("cms.homepageLayout");
    expect(raw).toBeTruthy();
    expect(heroTitle(JSON.parse(raw as string))).toBe(MARK);

    // ...and hydration loads it back into the in-memory state.
    await hydrateStorefrontCmsFromDb();
    expect(heroTitle(getHomepageLayout())).toBe(MARK);
  });

  it("ignores an invalid stored record and keeps a valid layout", async () => {
    await setStoreSetting("cms.homepageLayout", "{ this is not valid json");

    // Must not throw, and must leave a structurally valid layout in place.
    await expect(hydrateStorefrontCmsFromDb()).resolves.toBeUndefined();
    const layout = getHomepageLayout();
    expect(Array.isArray(layout.sections)).toBe(true);
    expect(layout.sections.length).toBeGreaterThan(0);
  });
});
