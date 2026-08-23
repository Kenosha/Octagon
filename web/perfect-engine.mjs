import {
  RULESET_IDS,
  SIDES,
  applyMove,
  getLegalMoves,
} from "./game-engine.mjs";

const MAGIC = "OCTBPR1\0";
const HEADER_BYTES = 64;
const LOSS_BASE = 110;
const ROTATIONS = Object.freeze([0, 2, 4, 6]);
const DEFAULT_URL = new URL("./perfect-tablebase.bin", import.meta.url);

let defaultTablebasePromise = null;

function abortError() {
  const error = new Error("Octagon Perfect analysis was aborted.");
  error.name = "AbortError";
  return error;
}

function choose(n, k) {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  let value = 1;
  for (let step = 1; step <= k; step += 1) value = value * (n - k + step) / step;
  return value;
}

function rankFour(values) {
  if (values.length !== 4) throw new RangeError("A tablebase side must contain four stones.");
  return values.reduce((rank, value, index) => rank + choose(value, index + 1), 0);
}

function piecesMask(positions) {
  return positions.reduce((mask, position) => (mask | (1 << position)) >>> 0, 0);
}

function rotateMask(mask, shift) {
  let rotated = 0;
  for (let ring = 0; ring < 3; ring += 1) {
    for (let index = 0; index < 8; index += 1) {
      const position = ring * 8 + index;
      if (mask & (1 << position)) rotated |= 1 << (ring * 8 + ((index + shift) % 8));
    }
  }
  return rotated >>> 0;
}

function canonicalMasks(state) {
  const red = piecesMask(state.red);
  const blue = piecesMask(state.blue);
  let bestRed = null;
  let bestBlue = null;
  for (const shift of ROTATIONS) {
    const candidateRed = rotateMask(red, shift);
    const candidateBlue = rotateMask(blue, shift);
    if (bestBlue === null || candidateBlue < bestBlue || (candidateBlue === bestBlue && candidateRed < bestRed)) {
      bestRed = candidateRed;
      bestBlue = candidateBlue;
    }
  }
  return { red: bestRed, blue: bestBlue };
}

function positionsFromMask(mask) {
  const positions = [];
  for (let position = 0; position < 24; position += 1) {
    if (mask & (1 << position)) positions.push(position);
  }
  return positions;
}

function localPosition(position, side) {
  if (position >= 8) return 4 + position - 8;
  const expectedParity = side === SIDES.RED ? 0 : 1;
  if ((position & 1) !== expectedParity) throw new RangeError("A stone occupies the other side's start position.");
  return side === SIDES.RED ? position / 2 : (position - 1) / 2;
}

function denseStateIndex(state, whitePrefix) {
  const canonical = canonicalMasks(state);
  const redPositions = positionsFromMask(canonical.red);
  const bluePositions = positionsFromMask(canonical.blue);
  const redValues = redPositions.map((position) => localPosition(position, SIDES.RED));
  const excluded = redPositions.filter((position) => position >= 8).map((position) => 4 + position - 8);
  const blueValues = bluePositions.map((position) => {
    const local = localPosition(position, SIDES.BLUE);
    return local - excluded.filter((occupied) => occupied < local).length;
  });
  const placement = whitePrefix[rankFour(redValues)] + rankFour(blueValues);
  return placement * 2 + Number(state.turn === SIDES.BLUE);
}

function popcount(value) {
  let bits = value >>> 0;
  bits -= (bits >>> 1) & 0x55555555;
  bits = (bits & 0x33333333) + ((bits >>> 2) & 0x33333333);
  return (((bits + (bits >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

function decodeValue(encoded) {
  if (encoded === 0) return Object.freeze({ outcome: "draw", distance: null });
  if (encoded < LOSS_BASE) return Object.freeze({ outcome: "win", distance: encoded - 1 });
  return Object.freeze({ outcome: "loss", distance: encoded - LOSS_BASE });
}

function exactScore(value) {
  if (value.outcome === "draw") return 0;
  return (value.outcome === "win" ? 1 : -1) * (1_000_000 - value.distance);
}

function valueAfterMove(child, tablebase) {
  if (child.drawReason) return Object.freeze({ outcome: "draw", distance: null });
  return tablebase.lookup(child);
}

function rootValueFromChild(childValue) {
  if (childValue.outcome === "draw") return Object.freeze({ outcome: "draw", distance: null });
  return Object.freeze({
    outcome: childValue.outcome === "loss" ? "win" : "loss",
    distance: childValue.distance + 1,
  });
}

function compareRootValues(left, right) {
  const category = { loss: 0, draw: 1, win: 2 };
  if (category[left.outcome] !== category[right.outcome]) return category[left.outcome] - category[right.outcome];
  if (left.outcome === "win") return right.distance - left.distance;
  if (left.outcome === "loss") return left.distance - right.distance;
  return 0;
}

function measureDrawPressure(child, tablebase, signal) {
  if (child.drawReason) {
    return Object.freeze({
      terminal: true,
      totalReplies: 0,
      safeReplies: 0,
      blunderReplies: 0,
      blunderDistanceTotal: 0,
    });
  }

  const replies = getLegalMoves(child);
  let safeReplies = 0;
  let blunderReplies = 0;
  let blunderDistanceTotal = 0;
  for (const reply of replies) {
    if (signal?.aborted) throw abortError();
    const replyValue = valueAfterMove(applyMove(child, reply), tablebase);
    if (replyValue.outcome === "win") {
      blunderReplies += 1;
      blunderDistanceTotal += replyValue.distance;
    } else if (replyValue.outcome === "draw") {
      safeReplies += 1;
    }
  }
  return Object.freeze({
    terminal: false,
    totalReplies: replies.length,
    safeReplies,
    blunderReplies,
    blunderDistanceTotal,
  });
}

function compareDrawPressure(left, right) {
  if (left.terminal !== right.terminal) return left.terminal ? -1 : 1;

  // Compare the exact blunder fractions without floating-point rounding.
  const leftDenominator = Math.max(1, left.totalReplies);
  const rightDenominator = Math.max(1, right.totalReplies);
  const rateDifference = left.blunderReplies * rightDenominator
    - right.blunderReplies * leftDenominator;
  if (rateDifference) return rateDifference;
  if (left.safeReplies !== right.safeReplies) return right.safeReplies - left.safeReplies;
  if (left.blunderReplies !== right.blunderReplies) return left.blunderReplies - right.blunderReplies;

  // If the trap rate is identical, prefer quicker punishment on average.
  if (left.blunderReplies && right.blunderReplies) {
    return right.blunderDistanceTotal * left.blunderReplies
      - left.blunderDistanceTotal * right.blunderReplies;
  }
  return 0;
}

function sameMove(left, right) {
  return left?.from === right?.from && left?.to === right?.to;
}

function legalRootMoves(state, suppliedMoves) {
  const legal = getLegalMoves(state);
  if (suppliedMoves === undefined) return legal;
  if (!Array.isArray(suppliedMoves)) throw new TypeError("legalMoves must be an array when supplied.");
  return suppliedMoves.filter((candidate) => legal.some((move) => sameMove(move, candidate)));
}

export function parsePerfectTablebase(buffer) {
  if (!(buffer instanceof ArrayBuffer)) throw new TypeError("Perfect tablebase data must be an ArrayBuffer.");
  if (buffer.byteLength < HEADER_BYTES) throw new RangeError("Perfect tablebase is truncated.");
  const bytes = new Uint8Array(buffer, 0, 8);
  const magic = String.fromCharCode(...bytes);
  if (magic !== MAGIC) throw new RangeError("Perfect tablebase has an invalid signature.");
  const header = new DataView(buffer, 8, HEADER_BYTES - 8);
  const version = header.getUint32(0, true);
  const universe = header.getUint32(4, true);
  const entryCount = header.getUint32(8, true);
  const prefixCount = header.getUint32(12, true);
  const bitWordCount = header.getUint32(16, true);
  const maximumDistance = header.getUint32(20, true);
  const payloadCount = header.getUint32(24, true);
  if (version !== 1 || entryCount !== payloadCount) throw new RangeError("Perfect tablebase header is unsupported.");

  const prefixOffset = HEADER_BYTES;
  const bitsOffset = prefixOffset + prefixCount * 4;
  const payloadOffset = bitsOffset + bitWordCount * 4;
  if (payloadOffset + payloadCount !== buffer.byteLength) throw new RangeError("Perfect tablebase length does not match its header.");
  const whitePrefix = new Uint32Array(buffer, prefixOffset, prefixCount);
  const presence = new Uint32Array(buffer, bitsOffset, bitWordCount);
  const payload = new Uint8Array(buffer, payloadOffset, payloadCount);
  const rankBlocks = new Uint32Array(Math.ceil(bitWordCount / 32) + 1);
  let running = 0;
  for (let word = 0; word < bitWordCount; word += 1) {
    if ((word & 31) === 0) rankBlocks[word >>> 5] = running;
    running += popcount(presence[word]);
  }
  rankBlocks[rankBlocks.length - 1] = running;
  if (running !== entryCount || whitePrefix[whitePrefix.length - 1] * 2 !== universe) {
    throw new RangeError("Perfect tablebase index failed its integrity check.");
  }

  function lookup(state) {
    if (state.ruleset !== RULESET_IDS.PROPER) throw new RangeError("Perfect play is available only for the Family board.");
    const dense = denseStateIndex(state, whitePrefix);
    if (dense < 0 || dense >= universe) throw new RangeError("Position lies outside the tablebase universe.");
    const wordIndex = dense >>> 5;
    const bitIndex = dense & 31;
    const word = presence[wordIndex];
    if (((word >>> bitIndex) & 1) === 0) throw new RangeError("Position is not reachable from the Family-board opening.");
    let payloadIndex = rankBlocks[wordIndex >>> 5];
    const blockStart = (wordIndex >>> 5) << 5;
    for (let at = blockStart; at < wordIndex; at += 1) payloadIndex += popcount(presence[at]);
    const lowerMask = bitIndex === 0 ? 0 : 0xffffffff >>> (32 - bitIndex);
    payloadIndex += popcount(word & lowerMask);
    return decodeValue(payload[payloadIndex]);
  }

  return Object.freeze({
    entryCount,
    universe,
    maximumDistance,
    byteLength: buffer.byteLength,
    lookup,
  });
}

export async function loadPerfectTablebase({ url = DEFAULT_URL, fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== "function") throw new TypeError("A fetch implementation is required to load Perfect play.");
  const useDefaultCache = String(url) === String(DEFAULT_URL) && fetchImpl === globalThis.fetch;
  if (useDefaultCache && defaultTablebasePromise) return defaultTablebasePromise;
  const loading = (async () => {
    const response = await fetchImpl(url);
    if (!response.ok) throw new Error(`Could not load Octagon Perfect tablebase (${response.status}).`);
    return parsePerfectTablebase(await response.arrayBuffer());
  })();
  if (useDefaultCache) defaultTablebasePromise = loading;
  try {
    return await loading;
  } catch (error) {
    if (useDefaultCache) defaultTablebasePromise = null;
    throw error;
  }
}

export function createPerfectOctagonAI({ tablebase = null, tablebaseUrl, fetchImpl } = {}) {
  let tablebasePromise = tablebase ? Promise.resolve(tablebase) : null;
  const getTablebase = () => tablebasePromise ??= loadPerfectTablebase({ url: tablebaseUrl, fetchImpl });

  async function analyze({ state, legalMoves, signal } = {}) {
    if (!state) throw new TypeError("Perfect Octagon AI requires a state.");
    if (state.ruleset !== RULESET_IDS.PROPER) throw new RangeError("Perfect play is available only for the Family board.");
    if (signal?.aborted) throw abortError();
    const database = await getTablebase();
    if (signal?.aborted) throw abortError();
    const moves = legalRootMoves(state, legalMoves);
    const currentValue = state.drawReason
      ? Object.freeze({ outcome: "draw", distance: null })
      : database.lookup(state);
    if (state.winner || state.drawReason || !moves.length) {
      return Object.freeze({
        move: null,
        score: exactScore(currentValue),
        outcome: currentValue.outcome,
        distance: currentValue.distance,
        depth: null,
        nodes: 1,
        completed: true,
        source: "perfect",
      });
    }

    let best = null;
    let nodes = moves.length + 1;
    for (const move of [...moves].sort((left, right) => left.from - right.from || left.to - right.to)) {
      if (signal?.aborted) throw abortError();
      const child = applyMove(state, move);
      const childValue = valueAfterMove(child, database);
      const rootValue = rootValueFromChild(childValue);
      const pressure = rootValue.outcome === "draw"
        ? measureDrawPressure(child, database, signal)
        : null;
      nodes += pressure?.totalReplies ?? 0;
      const valueComparison = best ? compareRootValues(rootValue, best.value) : 1;
      const pressureComparison = best && valueComparison === 0 && rootValue.outcome === "draw"
        ? compareDrawPressure(pressure, best.pressure)
        : 0;
      if (!best || valueComparison > 0 || (valueComparison === 0 && pressureComparison > 0)) {
        best = { move, value: rootValue, pressure };
      }
    }
    const drawPressure = best.pressure && Object.freeze({
      totalReplies: best.pressure.totalReplies,
      safeReplies: best.pressure.safeReplies,
      blunderReplies: best.pressure.blunderReplies,
      blunderRate: best.pressure.totalReplies
        ? best.pressure.blunderReplies / best.pressure.totalReplies
        : 0,
    });
    return Object.freeze({
      move: Object.freeze({ ...best.move }),
      score: exactScore(best.value),
      outcome: best.value.outcome,
      distance: best.value.distance,
      drawPressure,
      depth: null,
      nodes,
      completed: true,
      source: "perfect",
    });
  }

  return Object.freeze({
    difficulty: "perfect",
    async chooseMove(context) { return (await analyze(context)).move; },
    analyze,
    async evaluateState(state) {
      const database = await getTablebase();
      return state.drawReason ? Object.freeze({ outcome: "draw", distance: null }) : database.lookup(state);
    },
  });
}
