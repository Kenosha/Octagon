export type OctagonSide = "red" | "blue";
export type OctagonRulesetId = "proper" | "legacy";
export type OctagonDrawReason = "threefold-repetition" | "stalemate" | null;

export interface OctagonMove {
  readonly from: number;
  readonly to: number;
}

export interface OctagonState {
  readonly red: readonly number[];
  readonly blue: readonly number[];
  readonly turn: OctagonSide;
  readonly ruleset: OctagonRulesetId;
  readonly winner: OctagonSide | null;
  readonly drawReason: OctagonDrawReason;
  readonly ply: number;
  readonly positionHistory: readonly string[];
}

export interface OctagonFormation {
  readonly name: string;
  readonly description: string;
  readonly pattern: readonly number[];
  readonly variants: readonly (readonly number[])[];
}

export interface OctagonRuleset {
  readonly id: OctagonRulesetId;
  readonly label: string;
  readonly shortLabel: string;
  readonly description: string;
  readonly adjacency: readonly (readonly number[])[];
  readonly winningPatterns: readonly (readonly number[])[];
  readonly formations: readonly OctagonFormation[];
}

export const SIDES: Readonly<{ RED: "red"; BLUE: "blue" }>;
export const RULESET_IDS: Readonly<{ LEGACY: "legacy"; PROPER: "proper" }>;
export const DEFAULT_RULESET: OctagonRulesetId;
export const POSITION_COUNT: 24;
export const RULESETS: Readonly<Record<OctagonRulesetId, OctagonRuleset>>;
export const WINNING_PATTERNS: readonly (readonly number[])[];

export function createInitialState(ruleset?: OctagonRulesetId): OctagonState;
export function positionKey(state: OctagonState): string;
export function destinationsFrom(position: number, ruleset?: OctagonRulesetId): number[];
export function getWinningPatterns(
  ruleset?: OctagonRulesetId | OctagonState,
): readonly (readonly number[])[];
export function getLegalMoves(state: OctagonState): OctagonMove[];
export function getWinner(state: OctagonState): OctagonSide | null;
export function applyMove(state: OctagonState, move: OctagonMove): OctagonState;
export function cloneState(state: OctagonState): OctagonState;
export function moveKey(move: OctagonMove): string;
export function getRuleset(ruleset?: OctagonRulesetId): OctagonRuleset;
export function rotatePermanentPosition(position: number, steps: number): number;
