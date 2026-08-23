import assert from "node:assert/strict";
import test from "node:test";
import { AI_DIFFICULTIES, createOctagonAI } from "./ai-engine.mjs";
import {
  RULESET_IDS,
  applyMove,
  createInitialState,
  getLegalMoves,
  positionKey,
} from "./game-engine.mjs";

const noYield = async () => {};

function state({ red, blue, turn = "red", ruleset = RULESET_IDS.PROPER, winner = null, drawReason = null, positionHistory, ply = 0 }) {
  const value = { red, blue, turn, ruleset, winner, drawReason, ply };
  value.positionHistory = positionHistory ?? [positionKey(value)];
  return value;
}

test("difficulty presets are named, documented, and increasingly deep", () => {
  assert.deepEqual(Object.keys(AI_DIFFICULTIES), ["easy", "medium", "hard"]);
  assert.ok(AI_DIFFICULTIES.easy.description);
  assert.ok(AI_DIFFICULTIES.medium.maxDepth > AI_DIFFICULTIES.easy.maxDepth);
  assert.ok(AI_DIFFICULTIES.hard.maxDepth > AI_DIFFICULTIES.medium.maxDepth);
});

test("hard searches the opening instead of consulting solved guidance", async () => {
  const opening = createInitialState(RULESET_IDS.PROPER);
  const analysis = await createOctagonAI({
    difficulty: "hard",
    seed: "search-only",
    timeLimitMs: 1_000,
    maxNodes: 5_000,
    yieldControl: noYield,
  }).analyze({ state: opening });
  assert.ok(getLegalMoves(opening).some((move) => move.from === analysis.move.from && move.to === analysis.move.to));
  assert.ok(analysis.nodes > 0);
  assert.ok(analysis.depth > 0);
});

test("every tier takes an immediate tactical win", async () => {
  const winningPosition = state({
    red: [6, 8, 10, 12],
    blue: [1, 3, 5, 7],
  });

  for (const difficulty of Object.keys(AI_DIFFICULTIES)) {
    const ai = createOctagonAI({ difficulty, seed: 41, timeLimitMs: 1_000, yieldControl: noYield });
    const move = await ai.chooseMove({ state: winningPosition });
    assert.deepEqual(move, { from: 6, to: 14 }, `${difficulty} should finish the inner square`);
    assert.equal(applyMove(winningPosition, move).winner, "red");
  }
});

test("easy and deeper tiers block a unique one-move loss", async () => {
  const mustBlock = state({
    red: [1, 3, 5, 13],
    blue: [6, 8, 10, 12],
  });

  for (const difficulty of Object.keys(AI_DIFFICULTIES)) {
    const ai = createOctagonAI({ difficulty, seed: "block", timeLimitMs: 1_000, yieldControl: noYield });
    const move = await ai.chooseMove({ state: mustBlock });
    assert.deepEqual(move, { from: 13, to: 14 }, `${difficulty} should occupy blue's only winning target`);
  }
});

test("all chosen moves are legal across short games in both rulesets", async () => {
  const red = createOctagonAI({ difficulty: "medium", seed: "red", timeLimitMs: 1_000, yieldControl: noYield });
  const blue = createOctagonAI({ difficulty: "medium", seed: "blue", timeLimitMs: 1_000, yieldControl: noYield });
  for (const ruleset of Object.values(RULESET_IDS)) {
    let current = createInitialState(ruleset);
    for (let ply = 0; ply < 20 && !current.winner && !current.drawReason; ply += 1) {
      const legalMoves = getLegalMoves(current);
      const move = await (current.turn === "red" ? red : blue).chooseMove({ state: current, legalMoves });
      assert.ok(legalMoves.some(({ from, to }) => from === move.from && to === move.to));
      current = applyMove(current, move);
    }
  }
});

test("a seed makes easy choices reproducible and can vary equal choices", async () => {
  const initial = createInitialState();
  const first = await createOctagonAI({ difficulty: "easy", seed: "repeatable" }).chooseMove({ state: initial });
  const second = await createOctagonAI({ difficulty: "easy", seed: "repeatable" }).chooseMove({ state: initial });
  assert.deepEqual(first, second);

  const choices = new Set();
  for (let seed = 0; seed < 12; seed += 1) {
    const move = await createOctagonAI({ difficulty: "easy", seed }).chooseMove({ state: initial });
    choices.add(`${move.from}-${move.to}`);
  }
  assert.ok(choices.size > 1);
});

test("analysis exposes deterministic bounds and obeys a node cap", async () => {
  const opening = createInitialState(RULESET_IDS.LEGACY);
  const options = {
    difficulty: "hard",
    seed: "bounded",
    timeLimitMs: 1_000,
    maxNodes: 60,
    now: () => 0,
    yieldControl: noYield,
  };
  const left = await createOctagonAI(options).analyze({ state: opening });
  const right = await createOctagonAI(options).analyze({ state: opening });
  assert.deepEqual(left, right);
  assert.ok(left.nodes <= options.maxNodes);
  assert.equal(left.completed, false);
  assert.ok(getLegalMoves(opening).some((move) => move.from === left.move.from && move.to === left.move.to));
});

test("terminal and empty supplied move sets return no move cleanly", async () => {
  const ai = createOctagonAI({ difficulty: "hard" });
  const drawn = state({
    red: [0, 2, 4, 6],
    blue: [1, 3, 5, 7],
    drawReason: "threefold-repetition",
  });
  assert.equal(await ai.chooseMove({ state: drawn }), null);
  assert.equal(await ai.chooseMove({ state: createInitialState(), legalMoves: [] }), null);
});

test("a third occurrence is evaluated as a draw", async () => {
  const before = state({
    red: [0, 2, 4, 6],
    blue: [1, 3, 5, 7],
  });
  const repeatingMove = { from: 0, to: 8 };
  const repeatedKey = positionKey(applyMove(before, repeatingMove));
  before.positionHistory = [positionKey(before), repeatedKey, repeatedKey];

  const next = applyMove(before, repeatingMove);
  assert.equal(next.drawReason, "threefold-repetition");

  const analysis = await createOctagonAI({
    difficulty: "medium",
    seed: "draw",
    timeLimitMs: 1_000,
    yieldControl: noYield,
  }).analyze({ state: before, legalMoves: [repeatingMove] });
  assert.deepEqual(analysis.move, repeatingMove);
  assert.equal(analysis.score, 0);
});

test("an aborted request rejects with AbortError", async () => {
  const controller = new AbortController();
  controller.abort();
  const ai = createOctagonAI({ difficulty: "hard" });
  await assert.rejects(
    ai.chooseMove({ state: createInitialState(), signal: controller.signal }),
    { name: "AbortError" },
  );
});

test("a request can be cancelled between root branches", async () => {
  const controller = new AbortController();
  let yields = 0;
  const ai = createOctagonAI({
    difficulty: "hard",
    timeLimitMs: 1_000,
    yieldControl: async () => {
      yields += 1;
      if (yields === 2) controller.abort();
    },
  });
  await assert.rejects(
    ai.chooseMove({ state: createInitialState(RULESET_IDS.LEGACY), signal: controller.signal }),
    { name: "AbortError" },
  );
  assert.equal(yields, 2);
});

test("invalid configuration and illegal supplied moves fail safely", async () => {
  assert.throws(() => createOctagonAI({ difficulty: "impossible" }), RangeError);
  assert.throws(() => createOctagonAI({ maxNodes: -1 }), RangeError);
  assert.throws(() => createOctagonAI({ branchLimit: 0 }), RangeError);
  const ai = createOctagonAI({ difficulty: "easy" });
  assert.equal(await ai.chooseMove({
    state: createInitialState(),
    legalMoves: [{ from: 0, to: 1 }],
  }), null);
});
