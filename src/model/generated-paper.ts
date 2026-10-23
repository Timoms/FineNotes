/** Editable, vault-backed paper templates created by FineNotes. */

import type { PageGeometry, SyntheticBackdrop } from "./document";
import { mmToPage, pageToMm } from "./units";

export const GENERATED_PAPER_EXTENSION = "finepaper";
export const GENERATED_PAPER_FORMAT = 1;

export type PaperTexture = "plain" | "fine" | "heavy";
export type PaperSide = "left" | "right" | "top" | "bottom";

export interface PaperInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface PaperBlankZone {
  side: PaperSide;
  size: number;
}

export interface PaperDivider {
  side: PaperSide;
  inset: number;
  color: string;
  width: number;
}

export interface GeneratedPaperFile {
  format: 1;
  geometry: PageGeometry;
  backdrop: SyntheticBackdrop;
}

const color = (value: unknown, fallback?: string): string | undefined =>
  typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : fallback;

const length = (value: unknown, max = 10_000): number =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(0, value)) : 0;

export function parseGeneratedPaper(value: unknown): GeneratedPaperFile | null {
  if (!value || typeof value !== "object") return null;
  const root = value as Record<string, unknown>;
  if (root.format !== GENERATED_PAPER_FORMAT || !root.geometry || !root.backdrop) return null;
  const g = root.geometry as Record<string, unknown>;
  const width = length(g.width, 20_000);
  const height = length(g.height, 20_000);
  if (width < 100 || height < 100) return null;
  const raw = root.backdrop as Record<string, unknown>;
  const kinds = ["blank", "dotted", "ruled-wide", "squared"] as const;
  const kind = kinds.find((candidate) => candidate === raw.kind);
  if (!kind) return null;
  const backdrop: SyntheticBackdrop = { kind };
  const paperColor = color(raw.paperColor);
  const ruleColor = color(raw.color);
  if (paperColor && paperColor !== "#ffffff") backdrop.paperColor = paperColor;
  if (ruleColor) backdrop.color = ruleColor;
  if (typeof raw.spacing === "number" && Number.isFinite(raw.spacing) && raw.spacing >= 4) {
    backdrop.spacing = Math.min(2_000, raw.spacing);
  }
  if (raw.texture === "fine" || raw.texture === "heavy") backdrop.texture = raw.texture;
  const margins = parseInsets(raw.margins);
  if (margins) backdrop.margins = margins;
  const zones = Array.isArray(raw.blankZones)
    ? raw.blankZones.flatMap((item): PaperBlankZone[] => {
        if (!item || typeof item !== "object") return [];
        const record = item as Record<string, unknown>;
        const side = paperSide(record.side);
        const size = length(record.size, Math.max(width, height));
        return side && size > 0 ? [{ side, size }] : [];
      })
    : [];
  if (zones.length) backdrop.blankZones = zones.slice(0, 4);
  const dividers = Array.isArray(raw.dividers)
    ? raw.dividers.flatMap((item): PaperDivider[] => {
        if (!item || typeof item !== "object") return [];
        const record = item as Record<string, unknown>;
        const side = paperSide(record.side);
        const dividerColor = color(record.color);
        if (!side || !dividerColor) return [];
        return [
          {
            side,
            inset: length(record.inset, Math.max(width, height)),
            color: dividerColor,
            width: Math.max(0.25, Math.min(20, length(record.width, 20) || 1)),
          },
        ];
      })
    : [];
  if (dividers.length) backdrop.dividers = dividers.slice(0, 4);
  return { format: 1, geometry: { width, height }, backdrop };
}

function parseInsets(value: unknown): PaperInsets | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const margins = {
    top: length(raw.top),
    right: length(raw.right),
    bottom: length(raw.bottom),
    left: length(raw.left),
  };
  return Object.values(margins).some((n) => n > 0) ? margins : undefined;
}

function paperSide(value: unknown): PaperSide | null {
  return value === "left" || value === "right" || value === "top" || value === "bottom"
    ? value
    : null;
}

export function encodeGeneratedPaper(paper: GeneratedPaperFile): string {
  return `${JSON.stringify(paper, null, 2)}\n`;
}

export function cloneGeneratedBackdrop(backdrop: SyntheticBackdrop): SyntheticBackdrop {
  return parseGeneratedPaper({
    format: 1,
    geometry: { width: 1024, height: 1448 },
    backdrop,
  })?.backdrop ?? { kind: "blank" };
}

export function mmInsets(allMm: number): PaperInsets {
  const value = mmToPage(allMm);
  return { top: value, right: value, bottom: value, left: value };
}

export function insetsInMm(insets: PaperInsets | undefined): PaperInsets {
  return {
    top: pageToMm(insets?.top ?? 0),
    right: pageToMm(insets?.right ?? 0),
    bottom: pageToMm(insets?.bottom ?? 0),
    left: pageToMm(insets?.left ?? 0),
  };
}
