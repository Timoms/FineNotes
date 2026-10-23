export const COMPANION_ACTIONS = [
  { id: "pen", label: "Pen", icon: "pen-tool" },
  { id: "eraser", label: "Eraser", icon: "eraser" },
  { id: "highlighter", label: "Highlighter", icon: "highlighter" },
  { id: "select", label: "Lasso", icon: "lasso" },
  { id: "shape", label: "Shapes", icon: "shapes" },
  { id: "text", label: "Text", icon: "type" },
  { id: "ruler", label: "Ruler", icon: "ruler" },
  { id: "stickers", label: "Stickers", icon: "sticker" },
  { id: "sticky", label: "Sticky notes", icon: "sticky-note" },
] as const;

export type CompanionAction = (typeof COMPANION_ACTIONS)[number]["id"];

export const DEFAULT_COMPANION_ACTIONS: CompanionAction[] = [
  "pen",
  "eraser",
  "highlighter",
  "select",
  "ruler",
  "stickers",
  "sticky",
];

export function companionActionsOf(value: unknown): CompanionAction[] {
  if (!Array.isArray(value)) return [...DEFAULT_COMPANION_ACTIONS];
  const allowed = new Set<string>(COMPANION_ACTIONS.map((item) => item.id));
  const unique = new Set<CompanionAction>();
  for (const item of value) {
    if (typeof item === "string" && allowed.has(item)) unique.add(item as CompanionAction);
  }
  return unique.size > 0 ? [...unique] : [...DEFAULT_COMPANION_ACTIONS];
}
