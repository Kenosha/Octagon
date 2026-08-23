import type { OctagonMove, OctagonState } from "./game-engine.mjs";
import type { OctagonOpponent, OctagonOpponentContext } from "./ai-engine.mjs";

export interface PerfectValue {
  readonly outcome: "win" | "loss" | "draw";
  readonly distance: number | null;
}

export interface PerfectTablebase {
  readonly entryCount: number;
  readonly universe: number;
  readonly maximumDistance: number;
  readonly byteLength: number;
  lookup(state: OctagonState): PerfectValue;
}

export function parsePerfectTablebase(buffer: ArrayBuffer): PerfectTablebase;
export function loadPerfectTablebase(options?: {
  url?: URL | string;
  fetchImpl?: typeof fetch;
}): Promise<PerfectTablebase>;
export function createPerfectOctagonAI(options?: {
  tablebase?: PerfectTablebase | Promise<PerfectTablebase>;
  tablebaseUrl?: URL | string;
  fetchImpl?: typeof fetch;
}): OctagonOpponent & {
  chooseMove(context: OctagonOpponentContext): Promise<OctagonMove>;
};
