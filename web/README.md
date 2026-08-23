# Octagon for the web

The browser version is a dependency-free custom element with two switchable
rulesets. **Family board** reconstructs `octagon_proper_layout.jpg`; **2024
layout** preserves the simplified rules and geometry in `octagon.py`. Both use
the same immutable 24-position state API.

## Run locally

From the repository root:

```sh
python3 -m http.server 8000 --directory web
```

Then open <http://localhost:8000>.

## Embed

Copy `octagon-game.js`, `game-engine.mjs`, `rulesets.mjs`, `ai-engine.mjs`,
`perfect-engine.mjs`, and `perfect-tablebase.bin` into the same public directory,
then add:

```html
<script type="module" src="/games/octagon/octagon-game.js"></script>
<octagon-game ruleset="proper" red-name="Matteo" blue-name="Federico"></octagon-game>
```

The component fills its available width and uses its own Shadow DOM styles. Override the published color variables from the host if needed:

```css
octagon-game {
  --octagon-mint: #35b997;
  --octagon-red: #ee2524;
  --octagon-blue: #0f89ca;
  --octagon-min-height: 680px;
}
```

`--octagon-min-height` defaults to one viewport height for the standalone game and can be reduced when the board sits inside a larger page.

## Package

The `web` directory is the package `@kenosha/octagon`.

Create a local package archive from this directory:

```sh
pnpm pack --pack-destination <output-directory>
```

The package exports the custom element and the independent game modules:

```js
import "@kenosha/octagon/element";
import { createInitialState, getLegalMoves } from "@kenosha/octagon/core";
```

The package includes the tablebase for the Perfect opponent. The browser loads this file only when the game needs it.

## Presentation boundary

Use the `presentation` attribute to select the container behavior:

```html
<octagon-game presentation="standalone"></octagon-game>
<octagon-game presentation="embedded"></octagon-game>
```

The embedded presentation keeps the game interface and fits it inside its host container.

The host can set these CSS variables:

- `--octagon-mint`
- `--octagon-red`
- `--octagon-blue`
- `--octagon-ink`
- `--octagon-paper`
- `--octagon-min-height`
- `--octagon-max-width`
- `--octagon-padding`
- `--octagon-gap`
- `--octagon-board-size`
- `--octagon-board-max-size`
- `--octagon-font-body`
- `--octagon-font-display`
- `--octagon-font-mono`

The custom element also exposes these CSS parts:

- `surface`
- `header`
- `brand`
- `controls`
- `workspace`
- `player`
- `red-player`
- `blue-player`
- `board-wrap`
- `board`
- `footer`
- `instruction`
- `options`
- `rules`

The host owns its external border, clipping, and position. Octagon owns all game states and internal layout.

## AI adapter seam

The Family board and the Medium engine are the defaults. The Match control also provides Human versus Human and Engine versus Engine.

Each engine has an independent strength control below its name. Perfect loads the 8.3 MB tablebase through the HTTP cache.

Hard uses iterative search and position evaluation. The Evaluation and Best move controls load the analysis only after user input.

The Evaluation control shows a vertical meter with horizontal result text. The Best move control shows a directional arrow.

The Winning positions control shows each valid formation on the board. Each move shows the stone between its start and destination.

The board shows `Red Wins` or `Blue Wins` after a winning move.

Reduced-motion mode removes the move and formation animation. The `ruleset` attribute accepts `"proper"` or `"legacy"` for API consumers.

A custom AI engine needs one asynchronous method:

```js
const board = document.querySelector("octagon-game");

board.setOpponent({
  side: "blue",
  name: "Computer",
  adapter: {
    async chooseMove({ state, legalMoves, signal }) {
      // Return one object from legalMoves: { from, to }.
      return legalMoves[0];
    },
  },
});
```

`chooseMove` can return immediately or later. Reset and Undo abort an active request through `signal`.

The element emits `octagon-move`, `octagon-game-over`, `octagon-reset`, `octagon-undo`, `octagon-ai-error`, `octagon-analysis`, and `octagon-analysis-error` events.

The inherited rules do not define draws. The web engine treats repeated positions and stalemates as draws.

The third occurrence of the same position reports `drawReason: "threefold-repetition"`. A player without a legal move reports `drawReason: "stalemate"`.

In Human versus Engine, Undo returns to the preceding human turn.
