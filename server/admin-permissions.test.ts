import { describe, expect, it } from "vitest";
import { buildPermissions } from "./routers";

// The canonical set of admin module keys the sidebar/dispatch understands.
// A buildPermissions entry outside this set silently mis-gates an admin
// section (the sidebar just hides it), so every returned module must be valid.
const CANONICAL_MODULES = [
  "analytics",
  "orders",
  "customers",
  "products",
  "categories",
  "reviews",
  "inventory",
  "coupons",
  "banners",
  "reports",
  "cms",
  "settings",
  "newsletter",
  "activity",
];

describe("buildPermissions RBAC matrix", () => {
  it("returns only valid module keys for every role", () => {
    for (const role of ["ADMIN", "MANAGER", "STAFF"] as const) {
      const p = buildPermissions(role);
      for (const mod of p.allowedModules) {
        expect(CANONICAL_MODULES).toContain(mod);
      }
    }
  });

  it("ADMIN can reach every module and write/delete/settings", () => {
    const p = buildPermissions("ADMIN");
    for (const mod of CANONICAL_MODULES) {
      expect(p.allowedModules).toContain(mod);
    }
    // Regression guard for the bug this branch fixed: these were missing.
    expect(p.allowedModules).toEqual(
      expect.arrayContaining(["newsletter", "activity", "customers"])
    );
    expect(p.canWriteOrders).toBe(true);
    expect(p.canWriteProducts).toBe(true);
    expect(p.canWriteCms).toBe(true);
    expect(p.canDelete).toBe(true);
    expect(p.canAccessSettings).toBe(true);
    expect(p.readOnly).toBe(false);
  });

  it("MANAGER gets expanded modules but no settings access", () => {
    const p = buildPermissions("MANAGER");
    expect(p.allowedModules).toEqual(
      expect.arrayContaining([
        "orders",
        "products",
        "categories",
        "cms",
        "customers",
        "reviews",
        "inventory",
        "coupons",
        "newsletter",
        "activity",
      ])
    );
    expect(p.allowedModules).not.toContain("settings");
    expect(p.canAccessSettings).toBe(false);
    expect(p.canWriteProducts).toBe(true);
    expect(p.readOnly).toBe(false);
  });

  it("STAFF is read-only and cannot write, delete, or access settings", () => {
    const p = buildPermissions("STAFF");
    expect(p.readOnly).toBe(true);
    expect(p.canWriteOrders).toBe(false);
    expect(p.canWriteProducts).toBe(false);
    expect(p.canWriteCms).toBe(false);
    expect(p.canDelete).toBe(false);
    expect(p.canAccessSettings).toBe(false);
    expect(p.allowedModules).not.toContain("settings");
  });
});
