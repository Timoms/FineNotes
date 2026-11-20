export const MORE_ACTIONS = [
  { id: "collapse-menu", label: "Collapse menu strip", icon: "panel-right-close" },
  { id: "bookmark-page", label: "Toggle page bookmark", icon: "bookmark" },
  { id: "page-title", label: "Add or rename in contents", icon: "list" },
  { id: "copy-page-link", label: "Copy link to page", icon: "link" },
  { id: "duplicate-page", label: "Duplicate page", icon: "copy-plus" },
  { id: "page-template", label: "Change page template or cover", icon: "layout-template" },
  { id: "save-template", label: "Save page as template", icon: "file-plus" },
  { id: "go-to-page", label: "Go to page", icon: "navigation" },
  { id: "dark-pages", label: "Dark / Light Theme", icon: "moon" },
  { id: "shortcuts", label: "Keyboard shortcuts", icon: "keyboard" },
  { id: "home-link", label: "Copy home screen link", icon: "home" },
  { id: "clear-page", label: "Clear page", icon: "eraser" },
  { id: "delete-page", label: "Delete page", icon: "trash-2" },
  { id: "fullscreen", label: "Full screen", icon: "maximize" },
  { id: "no-touch", label: "Toggle touch navigation", icon: "hand" },
] as const;
export type MoreActionId = (typeof MORE_ACTIONS)[number]["id"];

export const TOOLBAR_LAYOUT_ITEMS = [
  { id: "fixed-space", label: "Fixed space", icon: "move-horizontal" },
  { id: "divider", label: "Divider", icon: "minus" },
  { id: "flexible-space", label: "Flexible space", icon: "unfold-horizontal" },
  { id: "group", label: "Group", icon: "group" },
  { id: "submenu", label: "Submenu", icon: "panel-left-open" },
  { id: "menu-strip", label: "Menu strip", icon: "panel-top" },
] as const;
export type ToolbarLayoutId = (typeof TOOLBAR_LAYOUT_ITEMS)[number]["id"];
export function isToolbarLayoutItem(id: string): id is ToolbarLayoutId {
  return TOOLBAR_LAYOUT_ITEMS.some((item) => item.id === id);
}

/** Every control that can appear in the notebook's main toolbar. */
export const TOOLBAR_ITEMS = [
  { id: "thumbnails", label: "Page thumbnails", icon: "panel-left" },
  { id: "search", label: "Search", icon: "search" },
  { id: "ai", label: "AI", icon: "sparkles" },
  { id: "calculator", label: "Calculator", icon: "calculator" },
  { id: "math-symbols", label: "Math symbols", icon: "sigma" },
  { id: "pencil-menu", label: "Radial menu", icon: "circle-dot" },
  { id: "colorwheel", label: "Colorwheel", icon: "palette" },
  { id: "ruler", label: "Ruler", icon: "ruler" },
  { id: "undo", label: "Undo", icon: "undo-2" },
  { id: "redo", label: "Redo", icon: "redo-2" },
  { id: "select", label: "Select", icon: "lasso" },
  { id: "pen", label: "Pen", icon: "pen-tool" },
  { id: "laser", label: "Laser pointer", icon: "pointer", defaultVisible: false },
  { id: "saved-pen-1", label: "Favorite pen 1", icon: "pen-tool", defaultVisible: false },
  { id: "saved-pen-2", label: "Favorite pen 2", icon: "pen-tool", defaultVisible: false },
  { id: "saved-pen-3", label: "Favorite pen 3", icon: "pen-tool", defaultVisible: false },
  { id: "saved-pen-4", label: "Favorite pen 4", icon: "pen-tool", defaultVisible: false },
  { id: "saved-pen-5", label: "Favorite pen 5", icon: "pen-tool", defaultVisible: false },
  { id: "saved-pen-6", label: "Favorite pen 6", icon: "pen-tool", defaultVisible: false },
  { id: "saved-pen-7", label: "Favorite pen 7", icon: "pen-tool", defaultVisible: false },
  { id: "saved-pen-8", label: "Favorite pen 8", icon: "pen-tool", defaultVisible: false },
  { id: "eraser", label: "Standard eraser", icon: "eraser" },
  { id: "eraser-stroke", label: "Whole stroke eraser", icon: "delete" },
  { id: "eraser-line", label: "Line eraser", icon: "list-minus" },
  { id: "lock", label: "Lock rectangle", icon: "lock" },
  { id: "smart-clip", label: "Smart Clip", icon: "camera" },
  { id: "paste", label: "Paste", icon: "clipboard-paste" },
  { id: "text", label: "Text box", icon: "type" },
  { id: "shape", label: "Shapes", icon: "shapes" },
  { id: "stickers", label: "Stickers", icon: "sticker" },
  { id: "sticky-notes", label: "Sticky Notes", icon: "sticky-note" },
  { id: "image", label: "Insert image", icon: "image" },
  { id: "pdf", label: "Insert PDF", icon: "file-text" },
  { id: "record", label: "Record audio", icon: "mic" },
  { id: "add-page", label: "Add page", icon: "plus" },
  { id: "share", label: "Export as PDF", icon: "share" },
  { id: "more", label: "More", icon: "more-horizontal" },
  { id: "settings", label: "Notebook settings", icon: "settings" },
  { id: "plugin-settings", label: "FineNotes settings", icon: "settings-2" },
  ...MORE_ACTIONS,
] as const;

export type ToolbarItemId = (typeof TOOLBAR_ITEMS)[number]["id"] | ToolbarLayoutId;
export type ToolbarGroup = "left" | "center" | "right" | "more" | "strip";

const LEFT = new Set<ToolbarItemId>([
  "thumbnails",
  "search",
  "ai",
  "calculator",
  "math-symbols",
  "pencil-menu",
  "ruler",
]);
const RIGHT = new Set<ToolbarItemId>(["add-page", "share", "more", "settings"]);

export function defaultToolbarGroup(id: ToolbarItemId): ToolbarGroup {
  if (MORE_ACTIONS.some((item) => item.id === id)) return "more";
  if (LEFT.has(id)) return "left";
  if (RIGHT.has(id)) return "right";
  return "center";
}

export interface ToolbarItemChoice {
  id: ToolbarItemId;
  /** Stable identity for repeatable layout pieces. */
  key?: string;
  name?: string;
  icon?: string;
  position?: "top" | "bottom" | "left" | "right";
  alignment?: "left" | "right" | "center" | "stretch";
  /** Identity of the containing group or submenu. */
  container?: string;
  visible: boolean;
  group: ToolbarGroup;
}

export const DEFAULT_TOOLBAR_ITEMS: ToolbarItemChoice[] = TOOLBAR_ITEMS.map(({ id, ...spec }) => ({
  id,
  visible: !("defaultVisible" in spec) || spec.defaultVisible,
  group: defaultToolbarGroup(id),
}));

/** The saved pen behind a toolbar action, or -1 for another action. */
export function savedPenToolbarIndex(id: ToolbarItemId): number {
  const match = /^saved-pen-([1-8])$/.exec(id);
  return match ? Number(match[1]) - 1 : -1;
}

/** A complete, unique order; new controls append visibly to older settings. */
export function toolbarItemsOf(value: unknown): ToolbarItemChoice[] {
  const known = new Set<ToolbarItemId>(
    [...TOOLBAR_ITEMS, ...TOOLBAR_LAYOUT_ITEMS].map(({ id }) => id),
  );
  const linear =
    Array.isArray(value) &&
    value.some(
      (item: unknown) =>
        !!item && typeof item === "object" && (item as { group?: unknown }).group === "strip",
    );
  const seen = new Set<ToolbarItemId>();
  const out: ToolbarItemChoice[] = [];
  const keys = new Set<string>();
  if (Array.isArray(value)) {
    for (const raw of value) {
      if (!raw || typeof raw !== "object") continue;
      const item = raw as {
        id?: unknown;
        visible?: unknown;
        group?: unknown;
        key?: unknown;
        container?: unknown;
        name?: unknown;
        icon?: unknown;
        position?: unknown;
        alignment?: unknown;
      };
      if (item.id === "color-wheel" || item.id === "intelligent-strip") continue;
      if (typeof item.id !== "string" || !known.has(item.id as ToolbarItemId)) continue;
      const id = item.id as ToolbarItemId;
      if (!isToolbarLayoutItem(id) && seen.has(id)) continue;
      seen.add(id);
      const group =
        item.group === "left" ||
        item.group === "center" ||
        item.group === "right" ||
        item.group === "more" ||
        item.group === "strip"
          ? item.group
          : defaultToolbarGroup(id);
      let key = typeof item.key === "string" && item.key ? item.key : `layout-${out.length}`;
      while (keys.has(key)) key += "-copy";
      if (isToolbarLayoutItem(id)) keys.add(key);
      out.push({
        id,
        visible: item.visible !== false,
        group,
        ...(isToolbarLayoutItem(id) ? { key } : {}),
        ...(id === "submenu"
          ? {
              name: typeof item.name === "string" ? item.name.slice(0, 60) : "Submenu",
              icon: typeof item.icon === "string" ? item.icon.slice(0, 60) : "panel-left-open",
            }
          : {}),
        ...(id === "menu-strip"
          ? {
              position:
                item.position === "bottom" || item.position === "left" || item.position === "right"
                  ? item.position
                  : "top",
              alignment:
                item.alignment === "left" ||
                item.alignment === "right" ||
                item.alignment === "stretch"
                  ? item.alignment
                  : "center",
            }
          : {}),
        ...(typeof item.container === "string" ? { container: item.container } : {}),
      });
    }
  }
  for (const { id } of TOOLBAR_ITEMS)
    if (!seen.has(id))
      out.push({
        id,
        visible: DEFAULT_TOOLBAR_ITEMS.find((item) => item.id === id)?.visible !== false,
        group: linear && defaultToolbarGroup(id) !== "more" ? "strip" : defaultToolbarGroup(id),
      });
  return out;
}

/** Migrate the old three lanes once; the strip itself has no alignment lanes. */
export function stripLayoutOf(value: unknown): ToolbarItemChoice[] {
  const items = toolbarItemsOf(value);
  if (items.some((i) => ["left", "center", "right"].includes(i.group))) {
    const migrated: ToolbarItemChoice[] = [];
    for (const side of ["left", "center", "right", "strip", "more"] as const) {
      const lane = items.filter((i) => i.group === side);
      if ((side === "center" || side === "right") && lane.some((i) => i.visible))
        migrated.push({
          id: "flexible-space",
          key: `migrated-${side}`,
          visible: true,
          group: "strip",
        });
      let container: string | undefined;
      for (const item of lane) {
        if (item.id === "group") container = item.key;
        else if (isToolbarLayoutItem(item.id)) container = undefined;
        migrated.push({
          ...item,
          group: side === "more" ? "more" : "strip",
          ...(item.id !== "group" && container ? { container } : {}),
        });
      }
    }
    return limitStrip(cleanContainers(migrated));
  }
  return limitStrip(cleanContainers(items));
}

function cleanContainers(items: ToolbarItemChoice[]): ToolbarItemChoice[] {
  return items.map((item) => {
    const copy = { ...item };
    const parent = items.find(
      (p) =>
        (p.id === "group" || p.id === "submenu" || p.id === "menu-strip") &&
        p.key === copy.container &&
        p.visible &&
        p.group === copy.group,
    );
    if (
      (copy.id === "group" && parent?.id !== "submenu" && parent?.id !== "menu-strip") ||
      copy.id === "submenu" ||
      copy.id === "menu-strip" ||
      !parent ||
      !copy.visible
    )
      delete copy.container;
    return copy;
  });
}

/** Move one item or a whole pill, preserving its children's order and ownership. */
export function moveStripItem(
  items: readonly ToolbarItemChoice[],
  index: number,
  group: "strip" | "more" | "library",
  container?: string,
  before?: number,
): ToolbarItemChoice[] {
  const moving = items[index];
  if (!moving || ((moving.id === "submenu" || moving.id === "menu-strip") && container))
    return [...items];
  const parent = container
    ? items.find(
        (p) =>
          (p.id === "group" || p.id === "submenu" || p.id === "menu-strip") &&
          p.key === container &&
          p.visible &&
          p.group === group,
      )
    : undefined;
  if (container && !parent) return [...items];
  if (moving.id === "group" && parent?.id === "group") return [...items];
  const indices = new Set([index]);
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (let i = 0; i < items.length; i++) {
      if (
        !indices.has(i) &&
        items[i].container &&
        [...indices].some((at) => items[at].key === items[i].container)
      ) {
        indices.add(i);
        expanded = true;
      }
    }
  }
  if (parent && [...indices].some((i) => items[i] === parent)) return [...items];
  if (before !== undefined && indices.has(before)) return [...items];
  const block = [...indices]
    .sort((a, b) => a - b)
    .map((i) => {
      const copy = {
        ...items[i],
        visible: group !== "library",
        group: group === "library" ? ("strip" as const) : group,
      };
      if (i === index || group === "library") {
        delete copy.container;
        if (container) copy.container = container;
      }
      return copy;
    });
  const out = items.filter((_, i) => !indices.has(i));
  const at =
    before === undefined
      ? out.length
      : items.slice(0, before).filter((_, i) => !indices.has(i)).length;
  out.splice(at, 0, ...block);
  if (
    stripSlots(out) > STRIP_SLOTS ||
    out.some(
      (item) =>
        (item.id === "submenu" || item.id === "menu-strip") &&
        stripSlots(out, item.key) > STRIP_SLOTS,
    )
  )
    return [...items];
  return out;
}

/** Short menu wording; tooltips and accessible names retain the full action label. */
export function compactToolbarLabel(label: string): string {
  const labels: Readonly<Record<string, string>> = {
    "Toggle page bookmark": "Bookmark page",
    "Add or rename in contents": "Contents…",
    "Change page template or cover": "Page template…",
    "Toggle dark pages": "Dark pages",
    "Keyboard shortcuts": "Shortcuts",
    "Copy home screen link": "Copy notebook link",
    "Toggle touch navigation": "Prevent touch scrolling",
    "Customize menu strip…": "Customize strip…",
  };
  return labels[label] ?? label;
}

export const STRIP_SLOTS = 25;
export function stripItemSlots(
  item: ToolbarItemChoice,
  items: readonly ToolbarItemChoice[],
  flexibleSlots = 1,
): number {
  if (item.id === "flexible-space") return flexibleSlots;
  if (item.id === "group")
    return Math.max(
      1,
      items
        .filter((child) => child.visible && child.container === item.key)
        .reduce((n, child) => n + stripItemSlots(child, items, flexibleSlots), 0),
    );
  return 1;
}
export function stripFlexibleSpaces(
  item: ToolbarItemChoice,
  items: readonly ToolbarItemChoice[],
): number {
  if (item.id === "flexible-space") return 1;
  if (item.id !== "group") return 0;
  return items
    .filter((child) => child.visible && child.container === item.key)
    .reduce((count, child) => count + stripFlexibleSpaces(child, items), 0);
}
function stripCapacitySlots(item: ToolbarItemChoice, items: readonly ToolbarItemChoice[]): number {
  if (item.id === "flexible-space" || item.id === "menu-strip") return 0;
  if (item.id === "group")
    return items
      .filter((child) => child.visible && child.container === item.key)
      .reduce((n, child) => n + stripCapacitySlots(child, items), 0);
  return 1;
}
export function stripSlots(items: readonly ToolbarItemChoice[], container?: string): number {
  return (
    items
      .filter(
        (item) =>
          item.visible &&
          (container !== undefined || item.group === "strip") &&
          item.container === container,
      )
      .reduce((n, item) => n + stripCapacitySlots(item, items), 0) +
    (container === undefined &&
    !items.some(
      (item) => item.id === "more" && item.visible && item.group === "strip" && !item.container,
    )
      ? 1
      : 0)
  );
}
/** Older, longer bars keep every action; excess containers move intact to More. */
function limitStrip(items: ToolbarItemChoice[]): ToolbarItemChoice[] {
  // Reserve the always-accessible overflow trigger if it is not placed explicitly.
  let used = items.some(
    (item) => item.id === "more" && item.visible && item.group === "strip" && !item.container,
  )
    ? 0
    : 1;
  const overflow = new Set<string>();
  const out = items.map((item) => {
    if (!item.visible || item.group !== "strip" || item.container) return { ...item };
    const cost = stripCapacitySlots(item, items);
    if (used + cost > STRIP_SLOTS - (item.id !== "more" && outMorePending(items, item) ? 1 : 0)) {
      if (item.key) overflow.add(item.key);
      return { ...item, group: "more" as const };
    }
    used += cost;
    return { ...item };
  });
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of out)
      if (item.container && overflow.has(item.container) && item.group !== "more") {
        item.group = "more";
        if (item.key) overflow.add(item.key);
        changed = true;
      }
  }
  return out;
}

function outMorePending(items: readonly ToolbarItemChoice[], current: ToolbarItemChoice): boolean {
  const at = items.indexOf(current);
  return items.some(
    (item, index) =>
      index > at && item.id === "more" && item.visible && item.group === "strip" && !item.container,
  );
}
