import { describe, expect, it } from "vitest";
import { sanitizeCmsHtml } from "./html-sanitizer";

describe("sanitizeCmsHtml", () => {
  it("preserves allowed block tags and typography", () => {
    const input = "<h1>Titre</h1><p>Premier <strong>paragraphe</strong></p>";
    const out = sanitizeCmsHtml(input);
    expect(out).toContain("<h1>Titre</h1>");
    expect(out).toContain("<p>");
    expect(out).toContain("<strong>paragraphe</strong>");
  });

  it("preserves links but forces rel=noopener and strips unsafe protocols", () => {
    const safe = sanitizeCmsHtml('<a href="https://example.com">ok</a>');
    expect(safe).toMatch(/<a [^>]*href="https:\/\/example\.com"/);
    expect(safe).toMatch(/rel="[^"]*noopener[^"]*"/);

    const js = sanitizeCmsHtml('<a href="javascript:alert(1)">bad</a>');
    expect(js).not.toContain("javascript:");
    expect(js).not.toContain("alert");
  });

  it("strips <script> tags and their content entirely", () => {
    const out = sanitizeCmsHtml(
      '<p>hi</p><script>alert("xss")</script><p>bye</p>'
    );
    expect(out).not.toContain("<script");
    expect(out).not.toContain("alert");
    expect(out).toContain("<p>hi</p>");
    expect(out).toContain("<p>bye</p>");
  });

  it("strips inline event handlers like onclick", () => {
    const out = sanitizeCmsHtml('<p onclick="alert(1)">hello</p>');
    expect(out).not.toMatch(/onclick/i);
    expect(out).not.toContain("alert");
    expect(out).toContain("hello");
  });

  it("strips <iframe>, <object>, <embed>", () => {
    const out = sanitizeCmsHtml(
      '<iframe src="https://evil.example"></iframe><object data="x"></object><embed src="x" />'
    );
    expect(out).not.toContain("<iframe");
    expect(out).not.toContain("<object");
    expect(out).not.toContain("<embed");
  });

  it("strips <style> and style attributes to avoid CSS-based exfil", () => {
    const out = sanitizeCmsHtml(
      '<style>body{background:url(javascript:alert(1))}</style><p style="color:red">hi</p>'
    );
    expect(out).not.toContain("<style");
    expect(out).not.toContain("javascript:");
    expect(out).toContain("hi");
    expect(out).not.toMatch(/style=/i);
  });

  it("returns empty string for empty / null-ish input", () => {
    expect(sanitizeCmsHtml("")).toBe("");
    expect(sanitizeCmsHtml(null as any)).toBe("");
    expect(sanitizeCmsHtml(undefined as any)).toBe("");
  });

  it("leaves plain text intact", () => {
    expect(sanitizeCmsHtml("Texte simple sans HTML.")).toBe(
      "Texte simple sans HTML."
    );
  });

  it("allows img tags with safe src and alt but strips unsafe protocols", () => {
    const safe = sanitizeCmsHtml(
      '<img src="https://cdn.example/pic.jpg" alt="photo" />'
    );
    expect(safe).toContain('src="https://cdn.example/pic.jpg"');
    expect(safe).toContain('alt="photo"');

    const unsafe = sanitizeCmsHtml(
      '<img src="javascript:alert(1)" alt="bad" />'
    );
    expect(unsafe).not.toContain("javascript:");
    expect(unsafe).not.toContain("alert");
  });
});
