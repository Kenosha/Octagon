/**
 * The portable Octagon rules engine.
 *
 * It deliberately has no DOM dependencies. The browser board, a future AI,
 * and server-side tooling can all consume the same small state/move API.
 */

import {
  DEFAULT_RULESET,
  getRuleset,
} from "./rulesets.mjs";

export { DEFAULT_RULESET, RULESET_IDS, RULESETS, WINNING_PATTERNS } from "./rulesets.mjs";

export const SIDES = Object.freeze({ RED: "red", BLUE: "blue" });
export const POSITION_COUNT = 24;

function freezeState(state) {
  const red = [...state.red].sort((a, b) => a - b);
  const blue = [...state.blue].sort((a, b) => a - b);
  const ruleset = getRuleset(state.ruleset ?? DEFAULT_RULESET).id;
  const history = state.positionHistory?.length
    ? [...state.positionHistory]
    : [positionKey({ red, blue, turn: state.turn, ruleset })];
  return Object.freeze({
    red: Object.freeze(red),
    blue: Object.freeze(blue),
    turn: state.turn,
    ruleset,
    winner: state.winner ?? null,
    drawReason: state.drawReason ?? null,
    ply: state.ply ?? 0,
    positionHistory: Object.freeze(history),
  });
}

export function createInitialState(ruleset = DEFAULT_RULESET) {
  return freezeState({
    red: [0, 2, 4, 6],
    blue: [1, 3, 5, 7],
    turn: SIDES.RED,
    ruleset,
    winner: null,
    drawReason: null,
    ply: 0,
  });
}

export function positionKey(state) {
  const ruleset = state.ruleset ?? DEFAULT_RULESET;
  return `${ruleset}|${[...state.red].sort((a, b) => a - b).join(",")}|${[...state.blue].sort((a, b) => a - b).join(",")}|${state.turn}`;
}

export function destinationsFrom(position, ruleset = DEFAULT_RULESET) {
  if (!Number.isInteger(position) || position < 0 || position >= POSITION_COUNT) {
    return [];
  }
  return [...getRuleset(ruleset).adjacency[position]];
}

export function getWinningPatterns(ruleset = DEFAULT_RULESET) {
  return getRuleset(typeof ruleset === "string" ? ruleset : ruleset.ruleset).winningPatterns;
}

export function getLegalMoves(state) {
  if (state.winner || state.drawReason) return [];

  const own = state[state.turn];
  const occupied = new Set([...state.red, ...state.blue]);
  return own.flatMap((from) => destinationsFrom(from, state.ruleset)
    .filter((to) => !occupied.has(to))
    .map((to) => Object.freeze({ from, to })));
}

export function getWinner(state) {
  const winningPatterns = getWinningPatterns(state);
  for (const side of [SIDES.RED, SIDES.BLUE]) {
    const pieces = new Set(state[side]);
    if (winningPatterns.some((pattern) => pattern.every((position) => pieces.has(position)))) {
      return side;
    }
  }
  return null;
}

export function applyMove(state, move) {
  const legal = getLegalMoves(state).some(({ from, to }) => from === move?.from && to === move?.to);
  if (!legal) throw new RangeError(`Illegal Octagon move: ${move?.from} -> ${move?.to}`);

  const movingSide = state.turn;
  const nextPieces = state[movingSide].map((position) => position === move.from ? move.to : position);
  const candidate = {
    red: movingSide === SIDES.RED ? nextPieces : state.red,
    blue: movingSide === SIDES.BLUE ? nextPieces : state.blue,
    turn: movingSide === SIDES.RED ? SIDES.BLUE : SIDES.RED,
    ruleset: state.ruleset ?? DEFAULT_RULESET,
    winner: null,
    drawReason: null,
    ply: state.ply + 1,
    positionHistory: state.positionHistory ?? [positionKey(state)],
  };
  candidate.winner = getWinner(candidate);
  const nextPositionKey = positionKey(candidate);
  candidate.positionHistory = [...candidate.positionHistory, nextPositionKey];
  if (!candidate.winner && candidate.positionHistory.filter((key) => key === nextPositionKey).length >= 3) {
    candidate.drawReason = "threefold-repetition";
  }
  if (!candidate.winner && !candidate.drawReason && getLegalMoves(candidate).length === 0) {
    candidate.drawReason = "stalemate";
  }
  return freezeState(candidate);
}

export function cloneState(state) {
  return freezeState(state);
}

export function moveKey(move) {
  return `${move.from}-${move.to}`;
}
