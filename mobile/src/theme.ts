// Go See mobile design system — dark, card-based UI.
// Deep charcoal surfaces, bright blue primary, colorful accent chips.

export const colors = {
  bg: "#0F1116",
  surface: "#1A1D24",
  surfaceAlt: "#232733",
  border: "#2B3040",

  primary: "#1e5fd8",
  primaryPressed: "#1a52bd",
  navy: "#0a2a5e",

  success: "#22C55E",
  warning: "#F59E0B",
  danger: "#EF4444",
  purple: "#A855F7",
  orange: "#F97316",
  teal: "#2DD4BF",

  text: "#F8FAFC",
  textMuted: "#8B93A7",
  textFaint: "#5B6272",
  onPrimary: "#FFFFFF",
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const font = {
  title: 28,
  heading: 20,
  body: 16,
  small: 13,
  tiny: 11,
};

/** Accent chip colors cycled across job cards, like the reference design. */
export const chipPalette = [colors.primary, colors.success, colors.purple, colors.orange, colors.teal];

export function chipColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return chipPalette[h % chipPalette.length];
}
