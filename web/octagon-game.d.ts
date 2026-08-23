import type { OctagonOpponent } from "./ai-engine.mjs";
import type { OctagonSide, OctagonState } from "./game-engine.mjs";

export type OctagonPresentation = "standalone" | "embedded";

export class OctagonGame extends HTMLElement {
  readonly state: OctagonState;
  aiAdapter: OctagonOpponent | null;
  setOpponent(options?: {
    side?: OctagonSide;
    name?: string;
    adapter: OctagonOpponent;
  }): void;
  clearOpponent(side?: OctagonSide): void;
  reset(): void;
  undo(): void;
}

declare global {
  interface HTMLElementTagNameMap {
    "octagon-game": OctagonGame;
  }
}
