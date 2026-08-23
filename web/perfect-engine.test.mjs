import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  RULESET_IDS,
  applyMove,
  createInitialState,
  getLegalMoves,
  positionKey,
} from "./game-engine.mjs";
import {
  createPerfectOctagonAI,
  parsePerfectTablebase,
} from "./perfect-engine.mjs";

const file = await readFile(new URL("./perfect-tablebase.bin", import.meta.url));
const buffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
const tablebase = parsePerfectTablebase(buffer);
const perfect = createPerfectOctagonAI({ tablebase });

test("compact tablebase passes its header and population audit", () => {
  assert.equal(tablebase.entryCount, 5_527_111);
  assert.equal(tablebase.universe, 22_199_418);
  assert.equal(tablebase.maximumDistance, 108);
  assert.equal(tablebase.byteLength, 8_321_487);
});

test("the Family-board opening is an exact win in 89 plies", () => {
  assert.deepEqual(tablebase.lookup(createInitialState(RULESET_IDS.PROPER)), {
    outcome: "win",
    distance: 89,
  });
});

test("Perfect chooses the only winning opening orbit", async () => {
  const state = createInitialState(RULESET_IDS.PROPER);
  const analysis = await perfect.analyze({ state });
  assert.equal(analysis.outcome, "win");
  assert.equal(analysis.distance, 89);
  assert.equal(analysis.source, "perfect");
  assert.ok(["0-8", "2-10", "4-12", "6-14"].includes(`${analysis.move.from}-${analysis.move.to}`));
  assert.deepEqual(tablebase.lookup(applyMove(state, analysis.move)), { outcome: "loss", distance: 88 });
});

test("Perfect versus Perfect realizes the 89-ply minimax length", async () => {
  let state = createInitialState(RULESET_IDS.PROPER);
  while (!state.winner && !state.drawReason) {
    const legalMoves = getLegalMoves(state);
    const move = await perfect.chooseMove({ state, legalMoves });
    assert.ok(legalMoves.some((legal) => legal.from === move.from && legal.to === move.to));
    state = applyMove(state, move);
    assert.ok(state.ply <= 89);
  }
  assert.equal(state.winner, "red");
  assert.equal(state.drawReason, null);
  assert.equal(state.ply, 89);
});

test("exact values satisfy W/D/L recurrence along varied reachable play", () => {
  let state = createInitialState(RULESET_IDS.PROPER);
  let random = 0x5eed1234;
  for (let sample = 0; sample < 500; sample += 1) {
    if (state.winner || state.drawReason) state = createInitialState(RULESET_IDS.PROPER);
    const value = tablebase.lookup(state);
    const moves = getLegalMoves(state);
    const children = moves.map((move) => tablebase.lookup(applyMove(state, move)));
    if (value.outcome === "win") assert.ok(children.some((child) => child.outcome === "loss"));
    if (value.outcome === "loss") assert.ok(children.every((child) => child.outcome === "win"));
    if (value.outcome === "draw") assert.ok(children.some((child) => child.outcome === "draw"));
    random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
    state = applyMove(state, moves[random % moves.length]);
  }
});

test("Perfect preserves a theoretical draw after the drawing opening", async () => {
  let state = applyMove(createInitialState(RULESET_IDS.PROPER), { from: 0, to: 15 });
  assert.deepEqual(tablebase.lookup(state), { outcome: "draw", distance: null });
  for (let ply = 0; ply < 12 && !state.drawReason; ply += 1) {
    const analysis = await perfect.analyze({ state });
    assert.equal(analysis.outcome, "draw");
    state = applyMove(state, analysis.move);
  }
});

test("Perfect maximizes the opponent's immediate tablebase blunder rate in a draw", async () => {
  const state = applyMove(createInitialState(RULESET_IDS.PROPER), { from: 0, to: 15 });
  const analysis = await perfect.analyze({ state });
  const pressures = [];
  for (const move of getLegalMoves(state)) {
    const child = applyMove(state, move);
    if (child.drawReason || tablebase.lookup(child).outcome !== "draw") continue;
    const replies = getLegalMoves(child);
    const blunders = replies.filter((reply) => {
      const grandchild = applyMove(child, reply);
      return !grandchild.drawReason && tablebase.lookup(grandchild).outcome === "win";
    }).length;
    pressures.push({ move, total: replies.length, blunders });
  }
  const chosen = pressures.find(({ move }) => move.from === analysis.move.from && move.to === analysis.move.to);
  assert.ok(chosen);
  assert.deepEqual(analysis.drawPressure, {
    totalReplies: chosen.total,
    safeReplies: chosen.total - chosen.blunders,
    blunderReplies: chosen.blunders,
    blunderRate: chosen.blunders / chosen.total,
  });
  assert.ok(pressures.every((candidate) => (
    chosen.blunders * candidate.total >= candidate.blunders * chosen.total
  )));
});

test("Perfect avoids claiming an immediate repetition draw when a live draw exists", async () => {
  const base = applyMove(createInitialState(RULESET_IDS.PROPER), { from: 0, to: 15 });
  const baseline = await perfect.analyze({ state: base });
  const repeatedChild = applyMove(base, baseline.move);
  const repeatedKey = positionKey(repeatedChild);
  const state = Object.freeze({
    ...base,
    positionHistory: Object.freeze([positionKey(base), repeatedKey, repeatedKey]),
  });
  const analysis = await perfect.analyze({ state });
  assert.notDeepEqual(analysis.move, baseline.move);
  assert.equal(applyMove(state, analysis.move).drawReason, null);
});

test("Perfect rejects the separate legacy ruleset", async () => {
  await assert.rejects(
    perfect.chooseMove({ state: createInitialState(RULESET_IDS.LEGACY) }),
    RangeError,
  );
});
