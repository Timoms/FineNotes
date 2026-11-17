/** Geometry in millimetres, matching a 16 cm, 45°–45°–90° school set square. */
export const TRIANGLE_WIDTH_MM = 160;
export const TRIANGLE_HEIGHT_MM = TRIANGLE_WIDTH_MM / 2;

export interface TriangleLabel {
  x: number;
  y: number;
  text: string;
  rotation?: number;
  kind: "cm" | "degree";
  fontSize?: number;
  textLength?: number;
}

export interface TriangleMarkings {
  outline: string;
  edgeTicks: string;
  grid: string;
  degreeTicks: string;
  degreeBand: string;
  labels: TriangleLabel[];
}

/** One coordinate system for all markings; the SVG scales without distorting angles. */
export function triangleMarkings(widthMm = TRIANGLE_WIDTH_MM): TriangleMarkings {
  const half = widthMm / 2;
  const ratio = widthMm / TRIANGLE_WIDTH_MM;
  const edgeTicks: string[] = [];
  const grid: string[] = [];
  const degreeTicks: string[] = [];
  const labels: TriangleLabel[] = [];
  const line = (paths: string[], x: number, y: number, dx: number, dy: number): void => {
    paths.push(`M${x},${y}l${dx},${dy}`);
  };

  // The hypotenuse reads 7 … 0 … 7, with a millimetre between every tick.
  const markedHalf = Math.floor((half - 10) / 10) * 10;
  for (let mm = -markedHalf; mm <= markedHalf; mm++) {
    const x = half + mm;
    const depth = mm % 10 === 0 ? 4.5 : mm % 5 === 0 ? 3 : 1.8;
    line(edgeTicks, x, 0, 0, depth);
    if (mm % 10 === 0) labels.push({ x, y: 6.6, text: String(Math.abs(mm / 10)), kind: "cm" });
  }

  // Millimetres measured along each leg, with labels aligned to its 45° edge.
  const legLength = Math.hypot(half, half);
  for (const side of [-1, 1]) {
    for (let mm = 1; mm < legLength - 3; mm++) {
      const along = mm * Math.SQRT1_2;
      const x = side === -1 ? along : widthMm - along;
      const y = along;
      const depth = mm % 10 === 0 ? 4.5 : mm % 5 === 0 ? 3 : 1.8;
      const nx = -side * Math.SQRT1_2;
      const ny = -Math.SQRT1_2;
      line(edgeTicks, x, y, nx * depth, ny * depth);
      const labelX = x + nx * 6.2;
      const labelY = y + ny * 6.2;
      const labelRadius = Math.hypot(labelX - half, labelY);
      // Keep leg numbers out of the degree band; centimetre ticks remain on
      // every leg even where the two measuring systems cross.
      const clearOfDegrees = labelRadius > 56 * ratio + 3 || labelRadius < 56 * ratio - 14;
      if (mm % 10 === 0 && mm >= 20 && mm < legLength - 10 && clearOfDegrees) {
        labels.push({
          x: labelX,
          y: labelY,
          text: String(mm / 10),
          rotation: side === -1 ? 45 : -45,
          kind: "cm",
        });
      }
    }
  }

  // Broken centimetre parallels leave the content underneath easy to see.
  // A central vertical scale measures depth from the hypotenuse.
  const gridRadius = 56 * ratio - 14;
  const gridHalf = Math.floor((gridRadius * 0.75) / 10) * 10;
  const gridDepth = Math.floor((gridRadius - 4) / 10) * 10;
  for (let y = 10; y <= gridDepth; y += 10) {
    for (let x = half - gridHalf; x <= half + gridHalf; x += 10) {
      if (x === half || Math.hypot(x - half, y + 6) > gridRadius) continue;
      line(grid, x - 3, y, 6, 0);
      if (y < gridDepth) line(grid, x, y + 2, 0, 6);
    }
    line(grid, half - 2.5, y, 5, 0);
    labels.push({ x: half, y: y + 3.2, text: String(y / 10), kind: "cm" });
  }
  // Half-centimetre dashes on the depth scale.
  for (let y = 5; y < gridDepth; y += 10) line(grid, half - 1.5, y, 3, 0);

  // Opposing 0–180° scales share the midpoint of the hypotenuse as their origin.
  // Both read 90° toward the right-angle tip, as on the reference instrument.
  for (let degree = 0; degree <= 180; degree++) {
    const radians = (degree * Math.PI) / 180;
    const dx = Math.cos(radians);
    const dy = Math.sin(radians);
    const depth = degree % 10 === 0 ? 4.5 : degree % 5 === 0 ? 3 : 1.5;
    line(degreeTicks, half + 56 * ratio * dx, 56 * ratio * dy, -depth * dx, -depth * dy);
    // Preserve room beside the top cm scale and the long endpoint values.
    // Small tools use fewer numbers while retaining every degree tick.
    const labelStep = ratio < 1 ? 30 : 10;
    const crowdedEndpoint =
      degree === 10 || degree === 170 || (ratio < 0.75 && (degree === 30 || degree === 150));
    if (degree % labelStep === 0 && !crowdedEndpoint) {
      for (const [radius, value, fontSize] of [
        [56 * ratio - 6.8, degree, 2.3],
        [56 * ratio - 10.5, 180 - degree, 2],
      ]) {
        const text = String(value);
        const slotWidth = 2 * radius * Math.sin((labelStep * Math.PI) / 360);
        labels.push({
          x: half + radius * dx,
          y: degree === 0 || degree === 180 ? 11 : radius * dy,
          text,
          rotation: degree - 90,
          kind: "degree",
          fontSize,
          textLength: Math.min(fontSize * 0.65 * text.length, slotWidth * 0.76),
        });
      }
    }
  }

  return {
    outline: `M0,0H${widthMm}L${half},${half}Z`,
    edgeTicks: edgeTicks.join(""),
    grid: grid.join(""),
    degreeTicks: degreeTicks.join(""),
    degreeBand: `M${half + 56 * ratio - 4},0a${56 * ratio - 4},${56 * ratio - 4} 0 0 1 ${-2 * (56 * ratio - 4)},0h4a${56 * ratio - 8},${56 * ratio - 8} 0 0 0 ${2 * (56 * ratio - 8)},0Z`,
    labels,
  };
}
