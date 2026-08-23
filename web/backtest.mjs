import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import {
  RULESET_IDS,
  applyMove,
  createInitialState,
  getLegalMoves,
} from "./game-engine.mjs";
import { createOctagonAI } from "./ai-engine.mjs";
import {
  createPerfectOctagonAI,
  parsePerfectTablebase,
} from "./perfect-engine.mjs";

const file = await readFile(new URL("./perfect-tablebase.bin", import.meta.url));
const buffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
const tablebase = parsePerfectTablebase(buffer);
const perfect = createPerfectOctagonAI({ tablebase });
const noYield = async () => {};

export async function playBacktest({
  difficulty,
  testedSide = "blue",
  seed = 0,
  maxPlies = 180,
}) {
  const common = { seed: `backtest-${seed}`, yieldControl: noYield };
  const tested = createOctagonAI({ ...common, difficulty });
  let state = createInitialState(RULESET_IDS.PROPER);
  const started = performance.now();
  const completedDepths = [];
  let searchedNodes = 0;
  while (!state.winner && !state.drawReason && state.ply < maxPlies) {
    const adapter = state.turn === testedSide ? tested : perfect;
    const legalMoves = getLegalMoves(state);
    const analysis = await adapter.analyze({ state, legalMoves });
    if (state.turn === testedSide) {
      if (Number.isFinite(analysis.depth)) completedDepths.push(analysis.depth);
      searchedNodes += analysis.nodes ?? 0;
    }
    const move = analysis.move;
    state = applyMove(state, move);
  }
  return Object.freeze({
    difficulty,
    testedSide,
    seed,
    winner: state.winner,
    drawReason: state.drawReason ?? (state.ply >= maxPlies ? "ply-cap" : null),
    plies: state.ply,
    testedMoves: testedSide === "red" ? Math.ceil(state.ply / 2) : Math.floor(state.ply / 2),
    elapsedMs: Math.round(performance.now() - started),
    meanDepth: completedDepths.length
      ? Number((completedDepths.reduce((sum, depth) => sum + depth, 0) / completedDepths.length).toFixed(1))
      : null,
    searchedNodes,
  });
}

async function main() {
  const games = Number(process.argv[2] ?? 3);
  const side = process.argv[3] ?? "blue";
  for (const difficulty of ["easy", "medium", "hard"]) {
    for (let seed = 0; seed < games; seed += 1) {
      const result = await playBacktest({ difficulty, testedSide: side, seed });
      console.log(JSON.stringify(result));
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
