import type { OctagonRuleset, OctagonRulesetId } from "./game-engine.mjs";

export const RULESET_IDS: Readonly<{ LEGACY: "legacy"; PROPER: "proper" }>;
export const DEFAULT_RULESET: OctagonRulesetId;
export const RULESETS: Readonly<Record<OctagonRulesetId, OctagonRuleset>>;
export const WINNING_PATTERNS: readonly (readonly number[])[];

export function getRuleset(ruleset?: OctagonRulesetId): OctagonRuleset;
export function rotatePermanentPosition(position: number, steps: number): number;
