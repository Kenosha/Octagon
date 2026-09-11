// Replay the shipped engines and verify every move against the exact tablebase.
// Run from any directory: node scripts/export-perfect-game.mjs > game.json
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  applyMove,
  createInitialState,
  getLegalMoves,
  getWinningPatterns,
  positionKey,
} from "../web/game-engine.mjs";
import { RULESETS } from "../web/rulesets.mjs";
import { createPerfectOctagonAI, parsePerfectTablebase } from "../web/perfect-engine.mjs";

const bytes = await readFile(new URL("../web/perfect-tablebase.bin", import.meta.url));
const tablebase = parsePerfectTablebase(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
const engines = {
  red: createPerfectOctagonAI({ tablebase }),
  blue: createPerfectOctagonAI({ tablebase }),
};
const label = (position) => `${["S", "I", "O"][Math.floor(position / 8)]}${position % 8}`;
const notation = (move) => `${label(move.from)} → ${label(move.to)}`;
const seen = new Set();
const frames = [];
let state = createInitialState("proper");
const opening = tablebase.lookup(state);
assert.deepEqual(opening, { outcome: "win", distance: 89 });

const openings = [8, 15, 16, 23].map((to) => {
  const child = tablebase.lookup(applyMove(state, { from: 0, to }));
  return {
    move: notation({ from: 0, to }),
    outcome: { win: "loss", loss: "win", draw: "draw" }[child.outcome],
    distance: child.distance === null ? null : child.distance + 1,
  };
});

let lastMove = null;
while (true) {
  assert.ok(!seen.has(positionKey(state)), "An optimal decisive line cannot repeat a position.");
  seen.add(positionKey(state));
  const value = tablebase.lookup(state);
  assert.equal(value.distance, 89 - state.ply);
  assert.equal(value.outcome, state.turn === "red" ? "win" : "loss");
  assert.equal(state.drawReason, null);
  const legalMoves = getLegalMoves(state);
  const winningMoves = legalMoves.filter((move) => tablebase.lookup(applyMove(state, move)).outcome === "loss").length;
  frames.push({
    ply: state.ply,
    turn: state.turn,
    red: state.red,
    blue: state.blue,
    winner: state.winner,
    remaining: value.distance,
    lastMove,
    legalMoves: legalMoves.length,
    winningMoves,
    redInner: state.red.filter((p) => p >= 8 && p < 16).length,
    blueInner: state.blue.filter((p) => p >= 8 && p < 16).length,
  });
  if (state.winner) break;
  const analysis = await engines[state.turn].analyze({ state, legalMoves });
  assert.equal(analysis.distance, value.distance);
  assert.equal(analysis.outcome, value.outcome);
  lastMove = { ...analysis.move, side: state.turn, notation: notation(analysis.move) };
  state = applyMove(state, analysis.move);
  assert.ok(state.ply <= 89);
}
assert.equal(state.winner, "red");
assert.equal(state.ply, 89);
assert.deepEqual(state.red, [9, 13, 17, 21]);
const redTurns = frames.filter((frame) => frame.turn === "red" && !frame.winner);
const uniqueWinningTurns = redTurns.filter((frame) => frame.winningMoves === 1).length;
assert.equal(uniqueWinningTurns, 10);

console.log(JSON.stringify({
  ruleset: "proper",
  policy: "Shortest forced win; longest resistance; lexicographic ties.",
  tablebaseSha256: createHash("sha256").update(bytes).digest("hex"),
  canonicalStates: tablebase.entryCount,
  plies: state.ply,
  uniqueWinningTurns,
  meanWinningFraction: redTurns.reduce((sum, frame) => sum + frame.winningMoves / frame.legalMoves, 0) / redTurns.length,
  openings,
  adjacency: RULESETS.proper.adjacency,
  formations: RULESETS.proper.formations,
  winningPattern: getWinningPatterns(state).find((pattern) => pattern.every((p) => state.red.includes(p))),
  frames,
}, null, 2));
