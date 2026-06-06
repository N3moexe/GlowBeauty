const flags = {
  ADMIN_V2: import.meta.env.VITE_ADMIN_V2 === "true",
} as const;

export type FeatureFlag = keyof typeof flags;

export function isEnabled(flag: FeatureFlag): boolean {
  return flags[flag];
}
