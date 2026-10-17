// RGB channels preserve Tailwind opacity modifiers. Metadata is never CSS code.
export function tenantPalette(value: string): Record<string, string> {
  const hex = /^#[0-9a-f]{6}$/i.test(value) ? value : "#2269ef";
  const base = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const weights: Record<string, number> = {
    50: 0.96,
    100: 0.9,
    200: 0.77,
    300: 0.58,
    400: 0.32,
    500: 0.12,
    600: 0,
    700: -0.15,
    800: -0.3,
    900: -0.45,
  };
  return Object.fromEntries(
    Object.entries(weights).map(([shade, weight]) => [
      shade,
      base
        .map((c) =>
          Math.round(weight >= 0 ? c + (255 - c) * weight : c * (1 + weight)),
        )
        .join(" "),
    ]),
  );
}
