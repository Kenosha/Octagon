# Octagon browser AI

`ai-engine.mjs` provides the bounded search tiers. `perfect-engine.mjs` loads
the compact solved Family-board table and derives exact moves by evaluating
every legal successor. Both run entirely in the browser and share the state API
in `game-engine.mjs`.

```js
import { createOctagonAI } from "./ai-engine.mjs";

const board = document.querySelector("octagon-game");
board.setOpponent({
  side: "blue",
  name: "Computer",
  adapter: createOctagonAI({ difficulty: "hard", seed: "match-1" }),
});
```

## Difficulties

- `easy` takes an immediate win, blocks a one-move loss when possible, and
  otherwise makes a seed-varied legal move.
- `medium` uses full-width tactical alpha-beta search up to four plies, bounded
  to 240 ms and 100,000 nodes by default.
- `hard` uses statically ordered, full-width iterative deepening up to seven
  plies, bounded to 2 seconds and 2,000,000 nodes. It scores formation
  multiplicity, distinct winning threats and forks, deployment, and mobility.
  Every legal branch is retained; on the Family opening's broad tree it usually
  completes four or five plies before the time limit.
- `perfect` evaluates all legal successors in the complete Family-board
  tablebase. It minimizes forced-win distance, maximizes resistance in forced
  losses, and never voluntarily leaves a theoretical draw. Within a draw it
  avoids an immediate repetition claim when possible, then maximizes the exact
  fraction of opponent replies that concede a forced win. Equal trap rates are
  resolved by fewer safe replies and faster tablebase punishment.

The 8,321,487-byte tablebase contains exact W/D/L and depth-to-result values for
all 5,527,111 reachable canonical Family-board positions. It is loaded only
when Perfect, Evaluation, or Best move first needs it. Medium and Hard never
consult it.
Perfect is intentionally unavailable on the separate 2024 ruleset, whose exact
opening result is a draw but whose table is not packaged.

Search yields to the browser before starting and between root moves so the
thinking state can paint and reset/undo cancellation can be observed. Each
individual subtree remains synchronous, while the absolute time and node caps
bound the work.

## API

`createOctagonAI(options)` accepts:

- `difficulty`: `"easy"`, `"medium"`, or `"hard"` (default `"medium"`)
- `seed`: any reproducible string or number used to break equal-score ties
- `timeLimitMs`, `maxNodes`, `maxDepth`: optional preset overrides
- `now`, `yieldControl`: optional deterministic testing/host hooks

The returned frozen adapter provides:

- `chooseMove({ state, legalMoves?, signal? })` returning `{ from, to }` or
  `null` for a terminal/no-move position
- `analyze(context)` returning `{ move, score, depth, nodes, completed }`

`completed: false` means a time or node limit interrupted the next iterative
depth; `move` still comes from the last fully completed depth (or the tactical
fallback). An aborted signal rejects with an error named `AbortError`.

`createPerfectOctagonAI()` exposes the same `chooseMove`/`analyze` seam. Exact
analysis additionally returns `outcome`, `distance`, and `source`. For a chosen
drawing move, `drawPressure` reports `totalReplies`, `safeReplies`,
`blunderReplies`, and `blunderRate`.
