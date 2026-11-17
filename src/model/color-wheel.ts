import { recentColorsOf, type Hsv } from "./colors";

/** Hue turns clockwise from the right; saturation grows from the centre. */
export function wheelColor(x: number, y: number, value: number): Hsv {
  return {
    h: ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360,
    s: Math.min(1, Math.hypot(x, y)),
    v: Math.max(0, Math.min(1, value)),
  };
}

/** All pen colours, including built-in ones, belong in the quick history. */
export function rememberWheelColor(recent: readonly string[], color: string): string[] {
  return recentColorsOf([color, ...recent]);
}

export function wheelPosition(raw: unknown): { x: number; y: number } {
  const p = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const unit = (n: unknown, fallback: number): number =>
    typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback;
  return { x: unit(p.x, 1), y: unit(p.y, 0.3) };
}

/** Pins are stored by position, so new recent colors never displace them. */
export function wheelPins(raw: unknown): (string | null)[] {
  const values = Array.isArray(raw) ? raw : [];
  return Array.from({ length: 8 }, (_, i) => recentColorsOf([values[i]])[0] ?? null);
}

export function wheelSwatches(
  recent: readonly string[],
  rawPins: unknown,
): { slot: number; color: string; locked: boolean }[] {
  const pins = wheelPins(rawPins);
  const available = recentColorsOf(recent).filter((color) => !pins.includes(color));
  return pins.flatMap((pin, slot) => {
    const color = pin ?? available.shift();
    return color ? [{ slot, color, locked: pin !== null }] : [];
  });
}
