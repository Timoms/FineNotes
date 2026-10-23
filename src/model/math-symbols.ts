/** Symbols offered by the draggable ink palette, grouped for quick scanning. */
export interface MathSymbolGroup {
  id: string;
  label: string;
  symbols: readonly string[];
}

export const MATH_SYMBOL_GROUPS: readonly MathSymbolGroup[] = [
  { id: "basic", label: "Basic", symbols: ["+", "−", "×", "/", "=", "±", "≠"] },
  { id: "compare", label: "Compare", symbols: ["<", ">", "≤", "≥", "≈", "∝", "∞"] },
  { id: "calculus", label: "Calculus", symbols: ["√", "∫", "∑", "∏", "∂", "Δ"] },
  { id: "greek", label: "Greek", symbols: ["π", "θ"] },
  { id: "sets", label: "Sets", symbols: ["∈", "∉", "⊂", "∪", "∩"] },
  { id: "arrows", label: "Arrows", symbols: ["→", "↔", "°", "%"] },
];

export const MATH_SYMBOLS: readonly string[] = MATH_SYMBOL_GROUPS.flatMap((group) => group.symbols);
