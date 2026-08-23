/**
 * A dependency-free, client-side Octagon opponent.
 *
 * The engine deliberately shares state transitions with game-engine.mjs. In
 * particular, simulated moves carry positionHistory forward, so a threefold
 * repetition is scored as a draw exactly when the playable board declares it.
 */

import {
  SIDES,
  applyMove,
  getLegalMoves,
  getWinningPatterns,
  moveKey,
  positionKey,
} from "./game-engine.mjs";

const MATE_SCORE = 1_000_000;
const INFINITY = MATE_SCORE + 1;
const PATTERN_VALUE = Object.freeze([0, 3, 18, 125, MATE_SCORE]);
const THREAT_VALUE = 190;
const FORK_VALUE = 1_200;
const DEPLOYMENT_VALUE = 18;
const MOBILITY_VALUE = 2;

export const AI_DIFFICULTIES = Object.freeze({
  easy: Object.freeze({
    label: "Easy",
    description: "Takes wins and blocks one-move threats, then varies its play.",
    maxDepth: 0,
    timeLimitMs: 20,
    maxNodes: 500,
  }),
  medium: Object.freeze({
    label: "Medium",
    description: "Looks up to four plies ahead with threat and formation scoring.",
    maxDepth: 4,
    timeLimitMs: 240,
    maxNodes: 100_000,
    lateMoveReduction: false,
    branchLimit: null,
  }),
  hard: Object.freeze({
    label: "Hard",
    description: "Broad seven-ply search with fork, formation, deployment, and mobility evaluation.",
    maxDepth: 7,
    timeLimitMs: 2_000,
    maxNodes: 2_000_000,
    lateMoveReduction: false,
    branchLimit: null,
  }),
});

function abortError() {
  const error = new Error("Octagon AI search was aborted.");
  error.name = "AbortError";
  return error;
}

class SearchLimit extends Error {}

function otherSide(side) {
  return side === SIDES.RED ? SIDES.BLUE : SIDES.RED;
}

function hashText(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  hash += hash << 13;
  hash ^= hash >>> 7;
  hash += hash << 3;
  hash ^= hash >>> 17;
  hash += hash << 5;
  return hash >>> 0;
}

function seededRank(seed, state, move) {
  return hashText(`${String(seed)}|${positionKey(state)}|${moveKey(move)}`);
}

function isSameMove(left, right) {
  return left?.from === right?.from && left?.to === right?.to;
}

function moveWins(state, move, side = state.turn) {
  const occupied = state[side].map((position) => position === move.from ? move.to : position);
  const pieces = new Set(occupied);
  return getWinningPatterns(state).some((pattern) => pattern.every((position) => pieces.has(position)));
}

function sideView(state, side) {
  return {
    ...state,
    turn: side,
    winner: null,
    drawReason: null,
  };
}

function immediateWinningMoves(state, side = state.turn) {
  const view = side === state.turn ? state : sideView(state, side);
  return getLegalMoves(view).filter((move) => moveWins(view, move, side));
}

function evaluateFormationAbsolute(state) {
  const red = new Set(state.red);
  const blue = new Set(state.blue);
  const winningPatterns = getWinningPatterns(state);
  let score = 0;

  for (const pattern of winningPatterns) {
    let redCount = 0;
    let blueCount = 0;
    for (const position of pattern) {
      if (red.has(position)) redCount += 1;
      if (blue.has(position)) blueCount += 1;
    }
    if (blueCount === 0) score += PATTERN_VALUE[redCount];
    if (redCount === 0) score -= PATTERN_VALUE[blueCount];
  }
  const redDeployed = state.red.filter((position) => position >= 8).length;
  const blueDeployed = state.blue.filter((position) => position >= 8).length;
  score += (redDeployed - blueDeployed) * DEPLOYMENT_VALUE;
  return score;
}

function evaluateAbsolute(state) {
  let score = evaluateFormationAbsolute(state);

  const redView = sideView(state, SIDES.RED);
  const blueView = sideView(state, SIDES.BLUE);
  const redMoves = getLegalMoves(redView);
  const blueMoves = getLegalMoves(blueView);
  const redWinningMoves = redMoves.filter((move) => moveWins(redView, move, SIDES.RED));
  const blueWinningMoves = blueMoves.filter((move) => moveWins(blueView, move, SIDES.BLUE));
  const redTargets = new Set(redWinningMoves.map(({ to }) => to)).size;
  const blueTargets = new Set(blueWinningMoves.map(({ to }) => to)).size;
  score += (redWinningMoves.length - blueWinningMoves.length) * THREAT_VALUE;
  score += (Math.max(0, redTargets - 1) - Math.max(0, blueTargets - 1)) * FORK_VALUE;
  score += (redMoves.length - blueMoves.length) * MOBILITY_VALUE;
  return score;
}

function evaluate(state) {
  const absolute = evaluateAbsolute(state);
  return state.turn === SIDES.RED ? absolute : -absolute;
}

function repetitionSignature(state) {
  const counts = new Map();
  for (const key of state.positionHistory ?? [positionKey(state)]) {
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, count]) => `${key}:${Math.min(count, 3)}`)
    .join(";");
}

function transpositionKey(state) {
  return `${positionKey(state)}#${repetitionSignature(state)}`;
}

function legalRootMoves(state, suppliedMoves) {
  const legal = getLegalMoves(state);
  if (suppliedMoves === undefined) return legal;
  if (!Array.isArray(suppliedMoves)) throw new TypeError("legalMoves must be an array when supplied.");
  return suppliedMoves.filter((candidate) => legal.some((move) => isSameMove(move, candidate)));
}

function chooseRanked(moves, state, seed) {
  if (!moves.length) return null;
  return [...moves].sort((left, right) => {
    const rankDifference = seededRank(seed, state, left) - seededRank(seed, state, right);
    return rankDifference || moveKey(left).localeCompare(moveKey(right));
  })[0];
}

function tacticalChoice(state, moves, seed) {
  const wins = moves.filter((move) => moveWins(state, move));
  if (wins.length) return chooseRanked(wins, state, seed);

  const safe = moves.filter((move) => {
    const child = applyMove(state, move);
    return child.drawReason || immediateWinningMoves(child).length === 0;
  });
  return chooseRanked(safe.length ? safe : moves, state, seed);
}

function checkBudget(context) {
  if (context.signal?.aborted) throw abortError();
  if (context.nodes >= context.maxNodes || context.now() >= context.deadline) {
    throw new SearchLimit();
  }
  context.nodes += 1;
}

function orderedChildren(state, moves, seed, preferredMove = null) {
  return moves.map((move) => {
    const child = applyMove(state, move);
    const staticScore = child.winner === state.turn
      ? MATE_SCORE
      : child.drawReason ? 0 : -(child.turn === SIDES.RED ? 1 : -1) * evaluateFormationAbsolute(child);
    return { move, child, staticScore };
  }).sort((leftEntry, rightEntry) => {
    const left = leftEntry.move;
    const right = rightEntry.move;
    if (preferredMove) {
      if (isSameMove(left, preferredMove)) return -1;
      if (isSameMove(right, preferredMove)) return 1;
    }
    const tactical = Number(rightEntry.child.winner === state.turn) - Number(leftEntry.child.winner === state.turn);
    if (tactical) return tactical;
    const positional = rightEntry.staticScore - leftEntry.staticScore;
    if (positional) return positional;
    const rankDifference = seededRank(seed, state, left) - seededRank(seed, state, right);
    return rankDifference || moveKey(left).localeCompare(moveKey(right));
  });
}

function negamax(state, depth, alpha, beta, context) {
  checkBudget(context);
  if (state.winner) return state.winner === state.turn ? MATE_SCORE : -MATE_SCORE;
  if (state.drawReason) return 0;

  const moves = getLegalMoves(state);
  if (!moves.length) return 0;
  if (depth === 0) {
    if (immediateWinningMoves(state).length) return MATE_SCORE;
    return evaluate(state);
  }

  const key = transpositionKey(state);
  const cached = context.table.get(key);
  const originalAlpha = alpha;
  const originalBeta = beta;
  if (cached && cached.depth >= depth) {
    if (cached.bound === "exact") return cached.score;
    if (cached.bound === "lower") alpha = Math.max(alpha, cached.score);
    if (cached.bound === "upper") beta = Math.min(beta, cached.score);
    if (alpha >= beta) return cached.score;
  }

  let bestScore = -INFINITY;
  let bestMove = null;
  const children = orderedChildren(state, moves, context.seed, cached?.move);
  const childCount = context.branchLimit && depth >= 3
    ? Math.min(children.length, context.branchLimit)
    : children.length;
  for (let index = 0; index < childCount; index += 1) {
    const { move, child } = children[index];
    let score;
    if (context.lateMoveReduction && depth >= 4 && index >= 6 && !child.winner && !child.drawReason) {
      score = -negamax(child, depth - 2, -beta, -alpha, context);
      if (score > alpha) score = -negamax(child, depth - 1, -beta, -alpha, context);
    } else {
      score = -negamax(child, depth - 1, -beta, -alpha, context);
    }
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
    alpha = Math.max(alpha, score);
    if (alpha >= beta) break;
  }

  const bound = bestScore <= originalAlpha ? "upper" : bestScore >= originalBeta ? "lower" : "exact";
  context.table.set(key, { depth, score: bestScore, bound, move: bestMove });
  return bestScore;
}

async function searchRoot(state, moves, depth, context, preferredMove) {
  let bestMove = null;
  let bestScore = -INFINITY;
  let alpha = -INFINITY;
  const rankedChildren = orderedChildren(state, moves, context.seed, preferredMove);

  for (let index = 0; index < rankedChildren.length; index += 1) {
    if (index > 0) {
      await context.yieldControl();
      if (context.signal?.aborted) throw abortError();
    }
    const { move, child } = rankedChildren[index];
    checkBudget(context);
    const score = child.winner === state.turn
      ? MATE_SCORE
      : -negamax(child, depth - 1, -INFINITY, -alpha, context);
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
    alpha = Math.max(alpha, score);
  }
  return { move: bestMove, score: bestScore };
}

function validateOptions(options) {
  const difficulty = options.difficulty ?? "medium";
  const preset = AI_DIFFICULTIES[difficulty];
  if (!preset) throw new RangeError(`Unknown Octagon AI difficulty: ${difficulty}`);

  const config = {
    difficulty,
    seed: options.seed ?? "octagon",
    maxDepth: options.maxDepth ?? preset.maxDepth,
    timeLimitMs: options.timeLimitMs ?? preset.timeLimitMs,
    maxNodes: options.maxNodes ?? preset.maxNodes,
    now: options.now ?? (() => performance.now()),
    yieldControl: options.yieldControl ?? (() => new Promise((resolve) => setTimeout(resolve, 0))),
    lateMoveReduction: options.lateMoveReduction ?? preset.lateMoveReduction ?? false,
    branchLimit: options.branchLimit ?? preset.branchLimit ?? null,
  };
  for (const key of ["maxDepth", "timeLimitMs", "maxNodes"]) {
    if (!Number.isFinite(config[key]) || config[key] < 0) {
      throw new RangeError(`${key} must be a non-negative finite number.`);
    }
  }
  if (config.branchLimit !== null && (!Number.isInteger(config.branchLimit) || config.branchLimit < 1)) {
    throw new RangeError("branchLimit must be null or a positive integer.");
  }
  if (typeof config.now !== "function") throw new TypeError("now must be a function.");
  if (typeof config.yieldControl !== "function") throw new TypeError("yieldControl must be a function.");
  return Object.freeze(config);
}

/**
 * Create an adapter accepted by <octagon-game>. The optional seed makes all
 * equal-score choices reproducible; maxDepth, timeLimitMs, maxNodes, now, and
 * yieldControl are exposed as deterministic test/embedding hooks.
 */
export function createOctagonAI(options = {}) {
  const config = validateOptions(options);

  async function analyze({ state, legalMoves, signal } = {}) {
    if (!state) throw new TypeError("Octagon AI requires a state.");
    if (signal?.aborted) throw abortError();
    const moves = legalRootMoves(state, legalMoves);
    if (state.winner || state.drawReason || !moves.length) {
      return Object.freeze({ move: null, score: 0, depth: 0, nodes: 0, completed: true });
    }

    const fallback = tacticalChoice(state, moves, config.seed);
    if (config.difficulty === "easy" || config.maxDepth === 0) {
      return Object.freeze({ move: { ...fallback }, score: null, depth: 0, nodes: 0, completed: true });
    }

    // Yield to a browser task so the thinking state can paint and a queued
    // reset/undo can cancel before the bounded search begins.
    await config.yieldControl();
    if (signal?.aborted) throw abortError();

    const startedAt = config.now();
    const context = {
      signal,
      seed: config.seed,
      maxNodes: config.maxNodes,
      nodes: 0,
      now: config.now,
      deadline: startedAt + config.timeLimitMs,
      table: new Map(),
      yieldControl: config.yieldControl,
      lateMoveReduction: config.lateMoveReduction,
      branchLimit: config.branchLimit,
    };
    let result = { move: fallback, score: null };
    let completedDepth = 0;
    let completed = true;

    for (let depth = 1; depth <= config.maxDepth; depth += 1) {
      try {
        result = await searchRoot(state, moves, depth, context, result.move);
        completedDepth = depth;
        if (Math.abs(result.score) === MATE_SCORE) break;
      } catch (error) {
        if (error?.name === "AbortError") throw error;
        if (!(error instanceof SearchLimit)) throw error;
        completed = false;
        break;
      }
      await config.yieldControl();
      if (signal?.aborted) throw abortError();
    }

    return Object.freeze({
      move: result.move ? { ...result.move } : null,
      score: Object.is(result.score, -0) ? 0 : result.score,
      depth: completedDepth,
      nodes: context.nodes,
      completed,
    });
  }

  return Object.freeze({
    difficulty: config.difficulty,
    async chooseMove(context) {
      return (await analyze(context)).move;
    },
    analyze,
  });
}
