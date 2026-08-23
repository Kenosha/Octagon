import assert from "node:assert/strict";
import test from "node:test";
import {
  RULESETS,
  RULESET_IDS,
  applyMove,
  createInitialState,
  destinationsFrom,
  getLegalMoves,
  getWinningPatterns,
  getWinner,
  positionKey,
} from "./game-engine.mjs";

test("both rulesets share the audited 24-position state representation", () => {
  const state = createInitialState(RULESET_IDS.PROPER);
  assert.deepEqual(state.red, [0, 2, 4, 6]);
  assert.deepEqual(state.blue, [1, 3, 5, 7]);
  assert.equal(state.turn, "red");
  assert.equal(state.ruleset, "proper");
  assert.equal(getLegalMoves(state).length, 16);
  assert.equal(createInitialState(RULESET_IDS.LEGACY).ruleset, "legacy");
});

test("legacy move graph preserves all three 2024 Python MOVE groups", () => {
  assert.deepEqual(destinationsFrom(0, RULESET_IDS.LEGACY), [15, 8, 23, 16]);
  assert.deepEqual(destinationsFrom(10, RULESET_IDS.LEGACY), [9, 11, 17, 19]);
  assert.deepEqual(destinationsFrom(20, RULESET_IDS.LEGACY), [11, 13]);
});

test("proper move graph restores the photographed dense inner web", () => {
  assert.deepEqual(destinationsFrom(0, RULESET_IDS.PROPER), [15, 8, 23, 16]);
  assert.deepEqual(destinationsFrom(10, RULESET_IDS.PROPER), [8, 9, 11, 12, 13, 14, 15, 17, 18, 19]);
  assert.deepEqual(destinationsFrom(20, RULESET_IDS.PROPER), [11, 12, 13]);
});

test("a legal move changes one piece and alternates the turn", () => {
  const before = createInitialState(RULESET_IDS.PROPER);
  const after = applyMove(before, { from: 0, to: 8 });
  assert.deepEqual(after.red, [2, 4, 6, 8]);
  assert.deepEqual(before.red, [0, 2, 4, 6]);
  assert.equal(after.turn, "blue");
  assert.equal(after.ply, 1);
});

test("illegal and occupied destinations are rejected", () => {
  const state = createInitialState(RULESET_IDS.PROPER);
  assert.throws(() => applyMove(state, { from: 0, to: 1 }), RangeError);
  assert.throws(() => applyMove(state, { from: 1, to: 8 }), RangeError);
});

test("all formations are recognized in their own ruleset", () => {
  for (const [ruleset, expectedCount] of [[RULESET_IDS.LEGACY, 28], [RULESET_IDS.PROPER, 20]]) {
    const patterns = getWinningPatterns(ruleset);
    assert.equal(patterns.length, expectedCount);
    for (const pattern of patterns) {
      assert.equal(getWinner({ red: pattern, blue: [], turn: "blue", ruleset }), "red");
      assert.equal(getWinner({ red: [], blue: pattern, turn: "red", ruleset }), "blue");
    }
  }
});

test("proper Karo includes both small and large squares, four patterns total", () => {
  assert.deepEqual(getWinningPatterns(RULESET_IDS.PROPER).slice(0, 4), [
    [8, 10, 12, 14],
    [16, 18, 20, 22],
    [9, 11, 13, 15],
    [17, 19, 21, 23],
  ]);
});

test("ruleset tables are unique, immutable, and permanent moves are reciprocal", () => {
  for (const definition of Object.values(RULESETS)) {
    assert.equal(new Set(definition.winningPatterns.map((entry) => entry.join(","))).size, definition.winningPatterns.length);
    assert.ok(Object.isFrozen(definition.adjacency));
    for (let from = 8; from < 24; from += 1) {
      assert.ok(definition.adjacency[from].every((to) => to >= 8));
      for (const to of definition.adjacency[from]) {
        assert.ok(definition.adjacency[to].includes(from), `${definition.id}: ${from}-${to} must be reciprocal`);
      }
    }
  }
  assert.deepEqual(RULESETS.proper.formations.map(({ variants }) => variants.length), [4, 4, 4, 8]);
});

test("a third occurrence of the same position and turn is a draw", () => {
  let state = {
    red: [8, 11, 13, 14],
    blue: [9, 10, 12, 15],
    turn: "red",
    winner: null,
    drawReason: null,
    ruleset: RULESET_IDS.LEGACY,
    ply: 0,
  };
  state.positionHistory = [positionKey(state)];
  const cycle = [
    { from: 8, to: 23 },
    { from: 9, to: 16 },
    { from: 23, to: 8 },
    { from: 16, to: 9 },
  ];
  for (const move of [...cycle, ...cycle]) state = applyMove(state, move);
  assert.equal(state.winner, null);
  assert.equal(state.drawReason, "threefold-repetition");
  assert.deepEqual(getLegalMoves(state), []);
});

test("a non-winning position with no legal moves is a stalemate draw", () => {
  const path = [
    [0, 8], [1, 9], [6, 14], [9, 10],
    [4, 11], [10, 9], [14, 15], [3, 10],
    [15, 16], [5, 12], [8, 17], [9, 8],
    [2, 9], [7, 15], [11, 18], [12, 11],
  ];
  let state = createInitialState(RULESET_IDS.LEGACY);
  for (const [from, to] of path) state = applyMove(state, { from, to });
  assert.deepEqual(state.red, [9, 16, 17, 18]);
  assert.deepEqual(state.blue, [8, 10, 11, 15]);
  assert.equal(state.winner, null);
  assert.equal(state.turn, "red");
  assert.equal(state.drawReason, "stalemate");
  assert.deepEqual(getLegalMoves(state), []);
});
