import { evaluate, formatValue } from "./calculator";

export type CalculationNoteResult =
  | { kind: "assignment"; name: string; expression: string }
  | { kind: "answer"; expression: string; answer: string }
  | { kind: "none" };

const UNITS: Record<string, { dimension: string; factor: number }> = {
  mm: { dimension: "length", factor: 1 },
  cm: { dimension: "length", factor: 10 },
  m: { dimension: "length", factor: 1000 },
  km: { dimension: "length", factor: 1_000_000 },
  in: { dimension: "length", factor: 25.4 },
  ft: { dimension: "length", factor: 304.8 },
  yd: { dimension: "length", factor: 914.4 },
  mg: { dimension: "mass", factor: 0.001 },
  g: { dimension: "mass", factor: 1 },
  kg: { dimension: "mass", factor: 1000 },
  oz: { dimension: "mass", factor: 28.349523125 },
  lb: { dimension: "mass", factor: 453.59237 },
  ms: { dimension: "time", factor: 0.001 },
  s: { dimension: "time", factor: 1 },
  min: { dimension: "time", factor: 60 },
  h: { dimension: "time", factor: 3600 },
};

/** Parse one recognised line as an assignment or an equation whose answer should be ink. */
export function calculateNote(
  raw: string,
  variables: ReadonlyMap<string, string>,
): CalculationNoteResult {
  const text = normalize(raw);
  const assignment = /^([a-zA-Z])\s*=\s*(.+)$/.exec(text);
  if (assignment && !assignment[2].endsWith("=")) {
    const expression = resolveVariables(assignment[2].trim(), variables, assignment[1]);
    if (!valueOf(expression)) return { kind: "none" };
    return { kind: "assignment", name: assignment[1].toLowerCase(), expression };
  }
  if (!text.endsWith("=")) return { kind: "none" };
  const expression = resolveVariables(text.slice(0, -1).trim(), variables);
  const answer = valueOf(expression);
  return answer ? { kind: "answer", expression, answer } : { kind: "none" };
}

function normalize(text: string): string {
  return text.trim().replace(/[×·]/g, "*").replace(/÷/g, "/").replace(/−/g, "-");
}

function resolveVariables(
  expression: string,
  variables: ReadonlyMap<string, string>,
  assigning = "",
): string {
  let resolved = expression;
  for (let pass = 0; pass < 8; pass++) {
    let changed = false;
    resolved = resolved.replace(/\b([a-zA-Z])\b/g, (whole, raw: string) => {
      const name = raw.toLowerCase();
      const value = name === assigning.toLowerCase() ? undefined : variables.get(name);
      if (!value) return whole;
      changed = true;
      return `(${value})`;
    });
    if (!changed) break;
  }
  return resolved;
}

function valueOf(expression: string): string | null {
  const converted = unitValue(expression);
  if (converted) return converted;
  const result = evaluate(expression);
  return result.ok ? formatValue(result.value, { fractions: true }) : null;
}

function unitValue(expression: string): string | null {
  const conversion = /^\s*([+-]?\d+(?:\.\d+)?)\s*([a-z]+)\s+(?:in|to)\s+([a-z]+)\s*$/i.exec(
    expression,
  );
  if (conversion) {
    const from = UNITS[conversion[2].toLowerCase()];
    const to = UNITS[conversion[3].toLowerCase()];
    if (!from || !to || from.dimension !== to.dimension) return null;
    return `${shown((Number(conversion[1]) * from.factor) / to.factor)} ${conversion[3].toLowerCase()}`;
  }

  const flat = expression.replace(/[()]/g, " ");
  const token = /\s*([+-]?)\s*(\d+(?:\.\d+)?)\s*([a-z]+)\s*/giy;
  let at = 0;
  let base = 0;
  let dimension = "";
  let shownUnit = "";
  let count = 0;
  while (at < flat.length) {
    token.lastIndex = at;
    const match = token.exec(flat);
    if (!match || match.index !== at) return null;
    const unitName = match[3].toLowerCase();
    const unit = UNITS[unitName];
    if (!unit || (dimension && unit.dimension !== dimension)) return null;
    if (!dimension) {
      dimension = unit.dimension;
      shownUnit = unitName;
    }
    const sign = match[1] === "-" ? -1 : 1;
    base += sign * Number(match[2]) * unit.factor;
    count++;
    at = token.lastIndex;
  }
  if (count === 0 || !shownUnit) return null;
  return `${shown(base / UNITS[shownUnit].factor)} ${shownUnit}`;
}

function shown(value: number): string {
  return Number(value.toPrecision(12)).toString();
}
