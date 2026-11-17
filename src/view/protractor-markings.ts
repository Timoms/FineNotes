/** Millimetre geometry for the 10 cm semicircle, its grip and measuring base. */
export function protractorGeometry(scale = 1) {
  const radius = 50 * scale;
  const margin = 5 * scale;
  const baseHeight = 18 * scale;
  return {
    width: radius * 2 + margin * 2,
    height: radius + baseHeight,
    center: { x: radius + margin, y: radius },
    radius,
    innerRadius: radius / 2,
    tabRadius: 3.5 * scale,
    margin,
    baseHeight,
  };
}

export interface ProtractorLabel {
  x: number;
  y: number;
  text: string;
  rotation: number;
  fontSize: number;
  kind: "degree" | "linear";
  direction?: "normal" | "reverse";
  /** Explicit SVG text width keeps theme fonts within their angular slot. */
  textLength?: number;
}

/** The angular print uses the outer half of the radius; the base print uses
 * its lower half. SVG coordinates keep both proportions fixed during zoom. */
export function protractorMarkings(scale = 1, unit: "cm" | "inch" = "cm") {
  const geometry = protractorGeometry(scale);
  const { radius, innerRadius, center, width, height, margin, baseHeight } = geometry;
  const outline = `M${margin},${radius}a${radius},${radius} 0 0 1 ${radius * 2},0H${width}V${height}H0V${radius}Z`;
  const opening = `M${center.x - innerRadius},${radius}a${innerRadius},${innerRadius} 0 0 1 ${innerRadius * 2},0Z`;
  const degreeTicks: string[] = [];
  const linearTicks: string[] = [];
  const labels: ProtractorLabel[] = [];
  const rows = [
    {
      direction: "normal",
      radius: radius * 0.71,
      fontSize: radius * 0.05,
      bandWidth: radius * 0.1,
    },
    {
      direction: "reverse",
      radius: radius * 0.56,
      fontSize: radius * 0.043,
      bandWidth: radius * 0.09,
    },
  ] as const;
  const bands = rows.map((row) => ({
    direction: row.direction,
    radius: row.radius,
    width: row.bandWidth,
    path: `M${center.x - row.radius},${radius}a${row.radius},${row.radius} 0 0 1 ${row.radius * 2},0`,
  }));
  for (let degree = 0; degree <= 180; degree++) {
    const radians = (degree * Math.PI) / 180;
    const dx = Math.cos(radians);
    const dy = -Math.sin(radians);
    const depth = radius * (degree % 10 === 0 ? 0.22 : degree % 5 === 0 ? 0.15 : 0.09);
    degreeTicks.push(
      `M${center.x + radius * dx},${radius + radius * dy}l${-depth * dx},${-depth * dy}`,
    );
    if (degree % 10 !== 0) continue;
    for (const row of rows) {
      const text = String(row.direction === "normal" ? degree : 180 - degree);
      // Reserve space on both sides of each value, including three-digit
      // values on the shorter inner arc and wider Obsidian theme fonts.
      const slotWidth = 2 * row.radius * Math.sin(Math.PI / 36);
      labels.push({
        x: center.x + row.radius * dx,
        y: radius + row.radius * dy,
        text,
        rotation: 90 - degree,
        fontSize: row.fontSize,
        kind: "degree",
        direction: row.direction,
        textLength: Math.min(row.fontSize * 0.65 * text.length, slotWidth * 0.76),
      });
    }
  }

  const majorMm = unit === "cm" ? 10 : 25.4;
  const divisions = unit === "cm" ? 10 : 16;
  const stepMm = majorMm / divisions;
  // Pinching adds/removes physical centimetres; page zoom scales the whole SVG.
  const count = Math.floor((radius * 2) / stepMm + 1e-9);
  for (let i = 0; i <= count; i++) {
    const x = margin + i * stepMm;
    const major = i % divisions === 0;
    const half = i % (divisions / 2) === 0;
    const depth = baseHeight * (major ? 0.36 : half ? 0.27 : 0.18);
    linearTicks.push(`M${x},${height}v${-depth}`);
    if (major) {
      labels.push({
        x,
        y: height - baseHeight * 0.44,
        text: String(i / divisions),
        rotation: 0,
        fontSize: baseHeight * 0.12,
        kind: "linear",
      });
    }
  }
  const crossSize = 2.5 * scale;
  const centerMark = `M${center.x - crossSize},${radius}h${crossSize * 2}M${center.x},${radius - crossSize}v${crossSize * 2}`;
  return {
    ...geometry,
    outline,
    opening,
    bands,
    degreeTicks: degreeTicks.join(""),
    linearTicks: linearTicks.join(""),
    centerMark,
    labels,
  };
}
