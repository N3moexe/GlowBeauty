export function safeJsonParse<T>(text: string | null | undefined, fallback: T): T {
  if (typeof text !== "string" || text.trim().length === 0) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(text) as T;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}
