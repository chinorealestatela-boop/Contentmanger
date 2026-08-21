// Validated categorical palette (fixed hue order — never cycled/re-ranked).
// See the dataviz skill's references/palette.md for the validation basis.
export const CATEGORICAL_PALETTE = [
  "#2a78d6", // blue
  "#eb6834", // orange
  "#1baf7a", // aqua
  "#eda100", // yellow
  "#e87ba4", // magenta
  "#008300", // green
  "#4a3aa7", // violet
  "#e34948", // red
];

export const SEQUENTIAL_BLUE = "#2a78d6";

/** Assigns a stable color per entity name so a series keeps its color even
 * as filters change which entities are present — color follows the
 * entity, never its rank in the current result set. */
export function stableColor(name: string, knownOrder: string[]): string {
  const idx = knownOrder.indexOf(name);
  if (idx >= 0) return CATEGORICAL_PALETTE[idx % CATEGORICAL_PALETTE.length];
  // Unknown entity (custom source/reason added later): hash to a slot.
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % CATEGORICAL_PALETTE.length;
  return CATEGORICAL_PALETTE[hash];
}
