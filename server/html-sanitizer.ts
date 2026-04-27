import sanitizeHtml from "sanitize-html";

/**
 * Sanitizes admin-authored HTML that will land on the storefront via
 * `dangerouslySetInnerHTML`. Whitelist-based: anything not on the allow list
 * is dropped, including <script>, <iframe>, inline event handlers, and
 * unsafe URL schemes like javascript:.
 *
 * Must remain side-effect free — callers rely on idempotency.
 */
const ALLOWED_TAGS = [
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "br",
  "hr",
  "strong",
  "em",
  "u",
  "s",
  "blockquote",
  "code",
  "pre",
  "ul",
  "ol",
  "li",
  "a",
  "img",
  "figure",
  "figcaption",
  "span",
  "div",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
];

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "title", "width", "height", "loading"],
    th: ["colspan", "rowspan", "scope"],
    td: ["colspan", "rowspan"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: {
    img: ["http", "https"],
  },
  disallowedTagsMode: "discard",
  nonTextTags: ["style", "script", "textarea", "option", "noscript"],
  allowedSchemesAppliedToAttributes: ["href", "src"],
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", {
      rel: "noopener noreferrer",
      target: "_blank",
    }),
  },
};

export function sanitizeCmsHtml(input: unknown): string {
  if (input == null) return "";
  if (typeof input !== "string") return "";
  if (input.length === 0) return "";
  return sanitizeHtml(input, SANITIZE_OPTIONS);
}
