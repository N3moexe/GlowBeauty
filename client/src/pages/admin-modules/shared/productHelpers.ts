import type {
  ProductRoutine,
  ProductRoutineStep,
} from "@shared/product-content";

export const PRODUCT_MAX_BULLETS = 10;
export const PRODUCT_DEFAULT_ROUTINE_STEPS = 3;
export const PRODUCT_MAX_ROUTINE_STEPS = 5;
export const ROUTINE_TITLE_PRESETS = [
  "Nettoyer",
  "Traiter",
  "Proteger",
] as const;
export const ROUTINE_CUSTOM_VALUE = "__custom__";

export function sanitizeBulletArray(
  input: unknown,
  maxItems = PRODUCT_MAX_BULLETS
) {
  if (!Array.isArray(input)) return [];
  return input
    .map(entry => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry): entry is string => entry.length > 0)
    .slice(0, maxItems);
}

export function sanitizeRoutineSteps(
  input: unknown,
  fallback: ProductRoutineStep[]
): ProductRoutineStep[] {
  if (!Array.isArray(input)) return fallback;
  const normalized = input
    .map(entry => {
      if (!entry || typeof entry !== "object") return null;
      const rawTitle = (entry as { title?: unknown }).title;
      const rawText = (entry as { text?: unknown }).text;
      const title = typeof rawTitle === "string" ? rawTitle.trim() : "";
      const text = typeof rawText === "string" ? rawText.trim() : "";
      if (!title && !text) return null;
      return {
        title: title.slice(0, 80),
        text: text.slice(0, 700),
      };
    })
    .filter((entry): entry is ProductRoutineStep => Boolean(entry))
    .slice(0, PRODUCT_MAX_ROUTINE_STEPS);
  return normalized.length > 0 ? normalized : fallback;
}

export function createDefaultRoutineSteps(): ProductRoutineStep[] {
  return ROUTINE_TITLE_PRESETS.slice(0, PRODUCT_DEFAULT_ROUTINE_STEPS).map(
    title => ({
      title,
      text: "",
    })
  );
}

export function createDefaultRoutine(): ProductRoutine {
  return {
    am: createDefaultRoutineSteps(),
    pm: createDefaultRoutineSteps(),
  };
}

export function sanitizeRoutine(input: unknown): ProductRoutine {
  if (!input || typeof input !== "object") {
    return createDefaultRoutine();
  }
  const candidate = input as { am?: unknown; pm?: unknown };
  return {
    am: sanitizeRoutineSteps(candidate.am, createDefaultRoutineSteps()),
    pm: sanitizeRoutineSteps(candidate.pm, createDefaultRoutineSteps()),
  };
}

export function resolveRoutinePresetValue(title: string) {
  const normalized = title.trim();
  if (!normalized) return ROUTINE_CUSTOM_VALUE;
  const matched = ROUTINE_TITLE_PRESETS.find(
    preset => preset.toLowerCase() === normalized.toLowerCase()
  );
  return matched || ROUTINE_CUSTOM_VALUE;
}

export function createEmptyRoutineStep(): ProductRoutineStep {
  return {
    title: "",
    text: "",
  };
}
