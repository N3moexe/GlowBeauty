import { describe, expect, it } from "vitest";
import { renderTemplateString } from "./email-service";

describe("renderTemplateString", () => {
  it("replaces a single {{var}} placeholder", () => {
    expect(renderTemplateString("Bonjour {{name}}", { name: "Moussa" })).toBe(
      "Bonjour Moussa"
    );
  });

  it("replaces multiple placeholders", () => {
    const out = renderTemplateString(
      "Cmd {{orderNumber}} — {{customerName}} ({{totalAmount}} CFA)",
      {
        orderNumber: "SBP-X-1",
        customerName: "Fatou",
        totalAmount: "12 000",
      }
    );
    expect(out).toBe("Cmd SBP-X-1 — Fatou (12 000 CFA)");
  });

  it("coerces numeric values to strings", () => {
    expect(renderTemplateString("Total: {{amount}}", { amount: 12000 })).toBe(
      "Total: 12000"
    );
  });

  it("replaces repeated placeholders with the same value", () => {
    expect(renderTemplateString("{{n}} / {{n}} / {{n}}", { n: "SBP-1" })).toBe(
      "SBP-1 / SBP-1 / SBP-1"
    );
  });

  it("leaves unknown placeholders unchanged (safer than silent data loss)", () => {
    expect(
      renderTemplateString("Bonjour {{unknown}}", { name: "Moussa" })
    ).toBe("Bonjour {{unknown}}");
  });

  it("tolerates placeholders containing whitespace inside the braces", () => {
    expect(renderTemplateString("Hi {{ name }}", { name: "Aicha" })).toBe(
      "Hi Aicha"
    );
  });

  it("does not substitute values inside already-replaced text (no double-pass)", () => {
    expect(renderTemplateString("Hello {{name}}", { name: "{{pwned}}" })).toBe(
      "Hello {{pwned}}"
    );
  });

  it("returns the template unchanged when vars is empty", () => {
    expect(renderTemplateString("Hello {{x}}", {})).toBe("Hello {{x}}");
  });

  it("handles empty template string", () => {
    expect(renderTemplateString("", { x: "1" })).toBe("");
  });
});
