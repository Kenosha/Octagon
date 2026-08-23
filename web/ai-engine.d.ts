import type { OctagonMove, OctagonState } from "./game-engine.mjs";

export type OctagonDifficulty = "easy" | "medium" | "hard";

export interface OctagonOpponentContext {
  readonly state: OctagonState;
  readonly legalMoves: readonly OctagonMove[];
  readonly signal?: AbortSignal;
}

export interface OctagonOpponent {
  readonly difficulty?: string;
  chooseMove(context: OctagonOpponentContext): Promise<OctagonMove>;
}

export const AI_DIFFICULTIES: Readonly<Record<OctagonDifficulty, Readonly<{
  label: string;
  description: string;
}>>>;

export function createOctagonAI(options?: {
  difficulty?: OctagonDifficulty;
  seed?: string | number;
  maxDepth?: number;
  timeLimitMs?: number;
  maxNodes?: number;
  now?: () => number;
  yieldControl?: () => Promise<void>;
  lateMoveReduction?: boolean;
  branchLimit?: number | null;
}): OctagonOpponent & {
  readonly difficulty: OctagonDifficulty;
};
