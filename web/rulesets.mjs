/**
 * Audited Octagon ruleset definitions.
 *
 * Both variants use the same 24-position state model:
 *   0-7   starting positions S0-S7
 *   8-15  inner positions I0-I7
 *   16-23 outer positions O0-O7
 *
 * `legacy` preserves the 2024 Python implementation. `proper` reconstructs
 * the photographed family board in octagon_proper_layout.jpg and the earlier
 * dense movement topology still visible in the repository history.
 */

export const RULESET_IDS = Object.freeze({ LEGACY: "legacy", PROPER: "proper" });
export const DEFAULT_RULESET = RULESET_IDS.PROPER;

const mod8 = (value) => ((value % 8) + 8) % 8;
const ringPosition = (ring, index) => ring + mod8(index);
const pattern = (...positions) => Object.freeze(positions);

function buildAdjacency(kind) {
  return Object.freeze(Array.from({ length: 24 }, (_, position) => {
    if (position < 8) {
      return Object.freeze([
        ringPosition(8, position - 1), ringPosition(8, position),
        ringPosition(16, position - 1), ringPosition(16, position),
      ]);
    }

    const index = position % 8;
    if (kind === RULESET_IDS.PROPER) {
      if (position < 16) {
        return Object.freeze([
          ...Array.from({ length: 8 }, (_, inner) => 8 + inner).filter((inner) => inner !== position),
          ringPosition(16, index - 1), ringPosition(16, index), ringPosition(16, index + 1),
        ]);
      }
      return Object.freeze([
        ringPosition(8, index - 1), ringPosition(8, index), ringPosition(8, index + 1),
      ]);
    }

    if (position < 16) {
      return Object.freeze([
        ringPosition(8, index - 1), ringPosition(8, index + 1),
        ringPosition(16, index - 1), ringPosition(16, index + 1),
      ]);
    }
    return Object.freeze([ringPosition(8, index - 1), ringPosition(8, index + 1)]);
  }));
}

const KARO_PATTERNS = Object.freeze([0, 1].flatMap((parity) => [
  pattern(...[0, 2, 4, 6].map((index) => ringPosition(8, index + parity))),
  pattern(...[0, 2, 4, 6].map((index) => ringPosition(16, index + parity))),
]));

const LEGACY_ANGLES = Object.freeze(Array.from({ length: 8 }, (_, index) => pattern(
  ringPosition(8, index), ringPosition(8, index + 2),
  ringPosition(16, index), ringPosition(16, index + 2),
)));

const LEGACY_CROWNS = Object.freeze(Array.from({ length: 8 }, (_, index) => pattern(
  ringPosition(8, index), ringPosition(8, index + 1),
  ringPosition(16, index), ringPosition(16, index + 1),
)));

const DIAGONAL_LINES = Object.freeze(Array.from({ length: 8 }, (_, index) => pattern(
  ringPosition(8, index + 1), ringPosition(8, index + 2),
  ringPosition(16, index), ringPosition(16, index + 3),
)));

const STRAIGHT_LINES = Object.freeze(Array.from({ length: 4 }, (_, index) => pattern(
  ringPosition(8, index), ringPosition(8, index + 4),
  ringPosition(16, index), ringPosition(16, index + 4),
)));

// The photographed crown spans the two points on either side of a cardinal
// axis. Four quarter-turns are printed on the board, hence centers 0,2,4,6.
const PROPER_CROWNS = Object.freeze([0, 2, 4, 6].map((center) => pattern(
  ringPosition(8, center - 1), ringPosition(8, center + 1),
  ringPosition(16, center - 1), ringPosition(16, center + 1),
)));

const LEGACY_WINNING_PATTERNS = Object.freeze([
  ...KARO_PATTERNS,
  ...LEGACY_ANGLES,
  ...LEGACY_CROWNS,
  ...DIAGONAL_LINES,
]);

const PROPER_WINNING_PATTERNS = Object.freeze([
  ...KARO_PATTERNS,
  ...PROPER_CROWNS,
  ...STRAIGHT_LINES,
  ...DIAGONAL_LINES,
]);

const legacyFormations = Object.freeze([
  Object.freeze({ name: "Square", description: "Every other point on a single ring.", pattern: KARO_PATTERNS[0], variants: KARO_PATTERNS }),
  Object.freeze({ name: "Angle", description: "Two matching corners across both rings.", pattern: LEGACY_ANGLES[0], variants: LEGACY_ANGLES }),
  Object.freeze({ name: "Crown", description: "Two neighboring stones on each ring.", pattern: LEGACY_CROWNS[0], variants: LEGACY_CROWNS }),
  Object.freeze({ name: "Line", description: "A complete formation on one diagonal board line.", pattern: DIAGONAL_LINES[0], variants: DIAGONAL_LINES }),
]);

const properFormations = Object.freeze([
  Object.freeze({ name: "Karo", description: "A small or large four-corner square.", pattern: KARO_PATTERNS[0], variants: KARO_PATTERNS }),
  Object.freeze({ name: "Crown", description: "Four corners forming a crown around one point.", pattern: PROPER_CROWNS[0], variants: PROPER_CROWNS }),
  Object.freeze({ name: "Straight line", description: "A complete formation across an axis of the board.", pattern: STRAIGHT_LINES[0], variants: STRAIGHT_LINES }),
  Object.freeze({ name: "Diagonal line", description: "A complete formation along one slanted board line.", pattern: DIAGONAL_LINES[0], variants: DIAGONAL_LINES }),
]);

export const RULESETS = Object.freeze({
  [RULESET_IDS.LEGACY]: Object.freeze({
    id: RULESET_IDS.LEGACY,
    label: "2024 layout",
    shortLabel: "2024",
    description: "The simplified layout originally implemented in this repository.",
    adjacency: buildAdjacency(RULESET_IDS.LEGACY),
    winningPatterns: LEGACY_WINNING_PATTERNS,
    formations: legacyFormations,
  }),
  [RULESET_IDS.PROPER]: Object.freeze({
    id: RULESET_IDS.PROPER,
    label: "Family board",
    shortLabel: "Original",
    description: "The denser family layout reconstructed from the photographed board.",
    adjacency: buildAdjacency(RULESET_IDS.PROPER),
    winningPatterns: PROPER_WINNING_PATTERNS,
    formations: properFormations,
  }),
});

export function getRuleset(ruleset = DEFAULT_RULESET) {
  const definition = RULESETS[ruleset];
  if (!definition) throw new RangeError(`Unknown Octagon ruleset: ${ruleset}`);
  return definition;
}

export function rotatePermanentPosition(position, steps) {
  if (!Number.isInteger(position) || position < 8 || position >= 24) return position;
  const ringStart = position < 16 ? 8 : 16;
  return ringPosition(ringStart, position - ringStart + steps);
}

// Backward-compatible alias for consumers of the first browser engine.
export const WINNING_PATTERNS = LEGACY_WINNING_PATTERNS;
