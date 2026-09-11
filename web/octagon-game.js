import {
  DEFAULT_RULESET,
  RULESETS,
  RULESET_IDS,
  SIDES,
  applyMove,
  cloneState,
  createInitialState,
  getLegalMoves,
} from "./game-engine.mjs";
import { AI_DIFFICULTIES, createOctagonAI } from "./ai-engine.mjs";
import {
  createPerfectOctagonAI,
} from "./perfect-engine.mjs";

const SVG_NS = "http://www.w3.org/2000/svg";

const OUTER_POINTS = [
  [320, 50], [680, 50], [950, 320], [950, 680],
  [680, 950], [320, 950], [50, 680], [50, 320],
];

const BOARD_LINES = [
  [0, 3], [0, 5], [1, 4], [1, 6],
  [2, 5], [2, 7], [3, 6], [4, 7],
];

const START_INTERSECTIONS = [[1, 5], [0, 3], [2, 5], [4, 0], [6, 2], [7, 4], [6, 1], [7, 3]];
const INNER_INTERSECTIONS = [[3, 5], [0, 5], [0, 2], [4, 2], [4, 6], [7, 6], [7, 1], [3, 1]];
const FORMATION_STEP_SECONDS = 1.2;
const DISPLAY_DIFFICULTIES = Object.freeze({
  ...AI_DIFFICULTIES,
  hard: Object.freeze({
    ...AI_DIFFICULTIES.hard,
    description: "Broad search with up to two seconds for forks, formations, deployment, and mobility.",
  }),
  perfect: Object.freeze({
    label: "Perfect",
    description: "Uses the complete solved Family-board tablebase.",
  }),
});

const template = document.createElement("template");
template.innerHTML = `
  <style>
    :host {
      --octagon-mint: #35b997;
      --octagon-red: #ee2524;
      --octagon-blue: #0f89ca;
      --octagon-ink: #070b0a;
      --octagon-paper: #e9eee9;
      --octagon-min-height: 100svh;
      --octagon-max-width: 1680px;
      --octagon-padding: clamp(20px, 3vw, 48px);
      --octagon-gap: 16px;
      --octagon-board-size: 72svh;
      --octagon-board-max-size: 720px;
      --octagon-font-body: "Courier New", monospace;
      --octagon-font-display: "Courier New", monospace;
      --octagon-font-mono: "Courier New", monospace;
      display: block;
      min-height: var(--octagon-min-height);
      color: var(--octagon-paper);
      background:
        radial-gradient(circle at 50% 46%, rgba(53, 185, 151, .055), transparent 43%),
        #070b0a;
      font-family: var(--octagon-font-body);
      contain: content;
    }

    :host([presentation="embedded"]) {
      --octagon-min-height: 100%;
      --octagon-max-width: 100%;
      --octagon-padding: clamp(12px, 1.5vw, 24px);
      --octagon-gap: clamp(7px, 1vw, 14px);
      --octagon-board-size: 60cqh;
      width: 100%;
      height: 100%;
      container-type: size;
    }

    * { box-sizing: border-box; }

    button, select { font: inherit; }

    .game {
      min-height: var(--octagon-min-height);
      width: min(100%, var(--octagon-max-width));
      height: 100%;
      margin: 0 auto;
      padding: var(--octagon-padding);
      display: grid;
      grid-template-rows: auto 1fr auto;
      gap: var(--octagon-gap);
      overflow: hidden;
    }

    .masthead {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: start;
      padding-bottom: 14px;
      border-bottom: 1px solid rgba(233, 238, 233, .13);
      animation: reveal .65s cubic-bezier(.2, .8, .2, 1) both;
    }

    .brand { min-width: 0; }

    .eyebrow,
    .meta-label {
      margin: 0 0 4px;
      color: rgba(233, 238, 233, .5);
      font-size: 10px;
      font-weight: 650;
      letter-spacing: .19em;
      text-transform: uppercase;
    }

    h1 {
      margin: 0;
      font-family: var(--octagon-font-display);
      font-size: clamp(31px, 4.2vw, 62px);
      font-weight: 400;
      letter-spacing: .11em;
      line-height: .9;
    }

    .player-dot {
      width: 13px;
      height: 13px;
      flex: 0 0 auto;
      border-radius: 50%;
      border: 1px solid color-mix(in srgb, var(--side-color) 72%, white);
      background: var(--side-color);
      box-shadow:
        inset 0 0 0 2px rgba(7, 11, 10, .42),
        0 0 4px color-mix(in srgb, var(--side-color) 24%, transparent);
      opacity: .34;
      transition: opacity .2s ease, box-shadow .2s ease;
    }

    .utility {
      justify-self: end;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .plain-button {
      min-height: 38px;
      padding: 0 12px;
      border: 0;
      border-radius: 2px;
      color: rgba(233, 238, 233, .66);
      background: transparent;
      cursor: pointer;
      transition: color .18s ease, background-color .18s ease;
    }

    .plain-button:hover { color: var(--octagon-paper); background: rgba(255,255,255,.055); }
    .plain-button:focus-visible { outline: 2px solid var(--octagon-mint); outline-offset: 2px; }
    .plain-button:disabled { opacity: .28; cursor: default; }

    .workspace {
      min-height: 0;
      display: grid;
      grid-template-columns: minmax(145px, 1fr) minmax(360px, 720px) minmax(145px, 1fr);
      align-items: center;
      gap: clamp(18px, 3vw, 56px);
    }

    .player {
      align-self: stretch;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 12px;
      opacity: 1;
    }

    .player[data-side="blue"] { text-align: right; align-items: flex-end; }
    .player.active .player-dot {
      opacity: 1;
      animation: turn-lamp 1.05s steps(2, jump-none) infinite;
    }

    .player-line { display: flex; align-items: center; gap: 9px; }
    .player[data-side="blue"] .player-line { flex-direction: row-reverse; }

    .player-name {
      margin: 0;
      font-family: var(--octagon-font-display);
      font-size: clamp(23px, 2.5vw, 37px);
      font-weight: 400;
    }

    .player-detail {
      margin: 0;
      color: rgba(233, 238, 233, .45);
      font-size: 11px;
      letter-spacing: .13em;
      text-transform: uppercase;
    }
    .engine-strength[hidden],
    .human-detail[hidden] { display: none; }
    .engine-strength {
      display: block;
      margin: 0;
    }

    .board-wrap {
      position: relative;
      width: min(100%, var(--octagon-board-size), var(--octagon-board-max-size));
      aspect-ratio: 1;
      justify-self: center;
      filter: drop-shadow(0 35px 42px rgba(0,0,0,.44));
      animation: board-in .9s .12s cubic-bezier(.16, 1, .3, 1) both;
    }

    .engine-eval {
      position: absolute;
      z-index: 3;
      top: 17%;
      left: calc(100% + 14px);
      width: clamp(110px, 12vw, 174px);
      height: 66%;
      display: grid;
      grid-template-columns: 9px 1fr;
      align-items: center;
      gap: 10px;
      color: rgba(233,238,233,.6);
      font: 10px/1.25 var(--octagon-font-mono);
      letter-spacing: .04em;
      text-transform: uppercase;
      animation: reveal .22s ease both;
    }
    .engine-eval[hidden] { display: none; }
    .eval-track {
      position: relative;
      width: 9px;
      height: 100%;
      min-height: 120px;
      overflow: hidden;
      border: 1px solid rgba(233,238,233,.2);
      background: var(--octagon-blue);
      box-shadow: 0 8px 22px rgba(0,0,0,.34);
    }
    .eval-fill {
      position: absolute;
      inset: auto 0 0;
      height: var(--eval-red, 50%);
      background: var(--octagon-red);
      transition: height .5s cubic-bezier(.2,.8,.2,1);
    }
    .eval-midline { position: absolute; inset: 50% -3px auto; height: 1px; background: rgba(255,255,255,.8); }
    .eval-copy { display: grid; gap: 5px; min-width: 0; }
    .eval-value { color: rgba(233,238,233,.92); white-space: nowrap; }
    .eval-source { opacity: .55; font-size: 8px; }
    .analysis-live {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    .board-wrap::before {
      content: "";
      position: absolute;
      inset: 2.5%;
      clip-path: polygon(30% 0,70% 0,100% 30%,100% 70%,70% 100%,30% 100%,0 70%,0 30%);
      background:
        repeating-linear-gradient(112deg, rgba(255,255,255,.012) 0 1px, transparent 1px 7px),
        radial-gradient(circle at 44% 37%, #17221e, #0b100e 68%);
      box-shadow: inset 0 0 0 1px rgba(233,238,233,.055), inset 0 0 70px rgba(0,0,0,.45);
    }

    svg { position: relative; display: block; width: 100%; height: 100%; overflow: visible; }

    .board-line {
      stroke: var(--octagon-mint);
      stroke-width: 4;
      stroke-linecap: round;
      opacity: .84;
      vector-effect: non-scaling-stroke;
    }
    .board-line.inner-web { stroke-width: 1.2; opacity: .27; }
    .board-line.spoke { stroke-width: 3.2; opacity: .66; }
    .board-line.karo-guide { stroke: rgba(233,238,233,.44); stroke-width: 1.5; opacity: .38; }

    .point {
      fill: #747d79;
      stroke: #0b100e;
      stroke-width: 3;
      vector-effect: non-scaling-stroke;
      transition: fill .18s ease, opacity .18s ease, r .18s ease, filter .18s ease;
    }

    .piece {
      stroke: rgba(255,255,255,.28);
      stroke-width: 2;
      vector-effect: non-scaling-stroke;
      filter: drop-shadow(0 8px 6px rgba(0,0,0,.5));
      transform-box: fill-box;
      transform-origin: center;
      transition: opacity .18s ease, transform .18s ease, filter .18s ease;
    }

    .piece.red { fill: var(--octagon-red); }
    .piece.blue { fill: var(--octagon-blue); }
    .moving-piece { pointer-events: none; }
    .moving-piece-halo {
      fill: none;
      stroke: var(--moving-color);
      stroke-width: 5;
      opacity: .54;
      filter: drop-shadow(0 0 13px var(--moving-color));
      pointer-events: none;
    }
    .moving-piece-trail {
      stroke: var(--moving-color);
      stroke-width: 5;
      stroke-linecap: round;
      opacity: .34;
      filter: drop-shadow(0 0 8px var(--moving-color));
      pointer-events: none;
    }
    .node.piece-arriving .piece { opacity: 0; }
    .node.proper-start .point { display: none; }
    .start-label {
      fill: rgba(233,238,233,.42);
      font: 650 25px/1 var(--octagon-font-mono);
      text-anchor: middle;
      dominant-baseline: central;
      pointer-events: none;
    }
    .node.occupied .start-label { fill: rgba(255,255,255,.88); font-size: 17px; }
    .node.occupied:not(.selectable) .piece { opacity: .72; }
    .node.selectable { cursor: pointer; }
    .node.selectable:hover .piece { transform: translateY(-5px) scale(1.04); filter: drop-shadow(0 12px 8px rgba(0,0,0,.58)); }
    .node.selected .piece { transform: scale(1.18); filter: drop-shadow(0 0 18px rgba(255,255,255,.28)); }
    .node.selected .selection-ring { opacity: 1; transform: scale(1); }

    .selection-ring {
      fill: none;
      stroke: rgba(233,238,233,.78);
      stroke-width: 2;
      stroke-dasharray: 5 7;
      vector-effect: non-scaling-stroke;
      opacity: 0;
      transform: scale(.8);
      transform-box: fill-box;
      transform-origin: center;
      transition: opacity .18s ease, transform .18s ease;
    }

    .target-ring {
      fill: rgba(53,185,151,.12);
      stroke: var(--octagon-mint);
      stroke-width: 3;
      stroke-dasharray: 1 8;
      stroke-linecap: round;
      vector-effect: non-scaling-stroke;
      opacity: 0;
      transform: scale(.72);
      transform-box: fill-box;
      transform-origin: center;
      transition: opacity .18s ease, transform .18s ease, fill .18s ease;
    }

    .node.target { cursor: pointer; }
    .node.target .target-ring { opacity: 1; transform: scale(1); animation: breathe 1.7s ease-in-out infinite; }
    .node.target:hover .target-ring { fill: rgba(53,185,151,.26); }
    .node:focus-visible .hit-focus { opacity: 1; }

    .hit { fill: transparent; }
    .hit-focus { fill: none; stroke: #f4f1dd; stroke-width: 3; opacity: 0; vector-effect: non-scaling-stroke; }
    .best-move-line {
      stroke: rgba(244,241,221,.9);
      stroke-width: 4;
      stroke-linecap: round;
      stroke-dasharray: 10 9;
      vector-effect: non-scaling-stroke;
      pointer-events: none;
      opacity: 0;
      transition: opacity .2s ease;
      animation: best-drift 1.2s linear infinite;
    }
    .best-move-line.visible { opacity: .82; }

    .winning-pattern {
      pointer-events: none;
      opacity: 0;
      transition: opacity .2s ease;
    }
    .show-formations .winning-pattern { opacity: 1; }
    .winning-marker {
      fill: rgba(53,185,151,.28);
      stroke: #f4f1dd;
      stroke-width: 7;
      vector-effect: non-scaling-stroke;
      filter: drop-shadow(0 0 18px var(--octagon-mint));
      transform-box: fill-box;
      transform-origin: center;
      animation: winning-marker 1.2s ease-in-out infinite;
    }
    .winning-label {
      position: absolute;
      z-index: 4;
      top: 8%;
      left: 8%;
      padding: 5px 7px;
      color: #f4f1dd;
      background: rgba(7,11,10,.8);
      font: 10px/1 var(--octagon-font-mono);
      letter-spacing: .12em;
      text-transform: uppercase;
      opacity: 0;
      transition: opacity .2s ease;
      pointer-events: none;
    }
    .show-formations .winning-label { opacity: 1; }
    .show-formations .node .piece { opacity: .18 !important; }

    .winner-overlay {
      position: absolute;
      z-index: 6;
      inset: 0;
      display: grid;
      place-items: center;
      color: var(--winner-color, var(--octagon-paper));
      background: rgba(7,11,10,.68);
      font: 400 clamp(30px, 4vw, 52px)/1 var(--octagon-font-display);
      letter-spacing: .06em;
      text-shadow: 0 0 24px color-mix(in srgb, var(--winner-color) 46%, transparent);
      animation: winner-in .42s cubic-bezier(.16,1,.3,1) both;
      pointer-events: none;
    }
    .winner-overlay[hidden] { display: none; }

    .footer {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: end;
      min-height: 40px;
      animation: reveal .65s .24s ease both;
    }

    .instruction {
      margin: 0;
      color: rgba(233, 238, 233, .55);
      font-size: 12px;
      line-height: 1.5;
    }

    .move-count {
      justify-self: center;
      color: rgba(233,238,233,.38);
      font: 11px/1 var(--octagon-font-mono);
      letter-spacing: .12em;
      text-transform: uppercase;
    }

    .match-options {
      justify-self: end;
      display: flex;
      align-items: end;
      gap: 18px;
    }

    .option-control {
      display: grid;
      gap: 4px;
      color: rgba(233,238,233,.42);
      font-size: 9px;
      font-weight: 650;
      letter-spacing: .14em;
      text-transform: uppercase;
    }

    .option-control[hidden] { display: none; }

    .analysis-toggle {
      min-height: 30px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: rgba(233,238,233,.5);
      font-size: 10px;
      letter-spacing: .08em;
      white-space: nowrap;
      cursor: pointer;
    }
    .analysis-toggle input { accent-color: var(--octagon-mint); }

    .formations-toggle[aria-pressed="true"] {
      color: var(--octagon-ink);
      background: var(--octagon-mint);
    }
    .formations-toggle {
      min-height: 30px;
      padding-inline: 9px;
      border: 1px solid rgba(233,238,233,.16);
      font-size: 10px;
      letter-spacing: .05em;
      white-space: nowrap;
    }

    select {
      min-width: 88px;
      min-height: 30px;
      padding: 0 22px 0 0;
      border: 0;
      border-bottom: 1px solid rgba(233,238,233,.22);
      border-radius: 0;
      color: rgba(233,238,233,.78);
      background: #070b0a;
      font-size: 12px;
      letter-spacing: .02em;
      text-transform: none;
      cursor: pointer;
    }

    select:focus-visible { outline: 2px solid var(--octagon-mint); outline-offset: 3px; }
    .opponent { min-width: 148px; }
    .player-difficulty {
      min-width: 92px;
      min-height: 24px;
      padding-right: 20px;
      color: rgba(233,238,233,.6);
      font-size: 10px;
      letter-spacing: .12em;
      text-align: inherit;
      text-transform: uppercase;
    }
    .player[data-side="blue"] .player-difficulty { text-align: right; }

    dialog {
      width: min(900px, calc(100vw - 32px));
      max-height: min(880px, calc(100svh - 32px));
      padding: 0;
      border: 1px solid rgba(233,238,233,.16);
      color: var(--octagon-paper);
      background: #101614;
      box-shadow: 0 32px 90px rgba(0,0,0,.72);
      overflow: auto;
    }

    dialog::backdrop { background: rgba(2,5,4,.78); backdrop-filter: blur(5px); }
    .rules { padding: clamp(24px, 5vw, 44px); }
    .rules-top { display: flex; align-items: start; justify-content: space-between; gap: 20px; }
    .rules h2 { margin: 4px 0 24px; font: 400 clamp(31px, 6vw, 48px)/1 var(--octagon-font-display); }
    .rules ol { margin: 0; padding-left: 20px; color: rgba(233,238,233,.68); }
    .rules li { padding: 0 0 15px 8px; line-height: 1.55; }
    .formations { margin-top: 10px; padding-top: 20px; border-top: 1px solid rgba(233,238,233,.12); }
    .formation-note { margin: 0; color: rgba(233,238,233,.54); font-size: 12px; line-height: 1.5; }
    .formation-list {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: clamp(16px, 3vw, 32px);
      margin-top: 18px;
    }
    .formation-example { min-width: 0; margin: 0; }
    .formation-board {
      display: block;
      width: 100%;
      aspect-ratio: 1;
      overflow: visible;
      filter: drop-shadow(0 14px 18px rgba(0,0,0,.28));
    }
    .formation-surface { fill: #0b100e; stroke: rgba(233,238,233,.07); stroke-width: 4; }
    .formation-line { stroke: var(--octagon-mint); stroke-width: 8; stroke-linecap: round; opacity: .6; }
    .formation-line.inner-web { stroke-width: 3; opacity: .16; }
    .formation-line.spoke { stroke-width: 6; opacity: .45; }
    .formation-point { fill: #68716d; stroke: #0b100e; stroke-width: 8; }
    .formation-piece {
      fill: var(--octagon-red);
      stroke: rgba(255,255,255,.32);
      stroke-width: 7;
      filter: drop-shadow(0 14px 10px rgba(0,0,0,.5));
      transform-box: fill-box;
      transform-origin: center;
    }
    dialog[open] .formation-piece { animation: formation-in .42s calc(var(--formation-index) * 45ms) cubic-bezier(.16,1,.3,1) both; }
    .formation-name {
      display: block;
      margin-top: 8px;
      color: var(--octagon-mint);
      font: 600 12px/1.2 var(--octagon-font-mono);
      letter-spacing: .08em;
      text-transform: uppercase;
    }
    .formation-description { display: block; margin-top: 5px; color: rgba(233,238,233,.48); font-size: 11px; line-height: 1.4; }

    .win-flash { animation: win-pulse 1.1s ease both; }

    @keyframes board-in { from { opacity: 0; transform: scale(.94) rotate(-1.4deg); } to { opacity: 1; transform: scale(1) rotate(0); } }
    @keyframes reveal { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes breathe { 50% { opacity: .52; transform: scale(.9); } }
    @keyframes win-pulse { 25% { filter: drop-shadow(0 0 34px color-mix(in srgb, var(--side-color) 46%, transparent)); } }
    @keyframes formation-in { from { transform: scale(.5); } to { transform: scale(1); } }
    @keyframes best-drift { to { stroke-dashoffset: -38; } }
    @keyframes turn-lamp {
      50% {
        opacity: .4;
        box-shadow:
          inset 0 0 0 2px rgba(7, 11, 10, .42),
          0 0 5px color-mix(in srgb, var(--side-color) 30%, transparent);
      }
      100% {
        opacity: 1;
        box-shadow:
          inset 0 0 0 2px rgba(7, 11, 10, .28),
          0 0 21px color-mix(in srgb, var(--side-color) 78%, transparent);
      }
    }
    @keyframes winning-marker {
      50% { opacity: .42; transform: scale(.78); }
    }
    @keyframes winner-in {
      from { opacity: 0; transform: scale(.96); }
      to { opacity: 1; transform: scale(1); }
    }

    @container (max-width: 950px) {
      .match-options { gap: 10px; }
      .option-control { font-size: 8px; }
      .option-control:first-child select { min-width: 142px; }
      select { min-width: 80px; font-size: 11px; }
      .engine-eval {
        left: calc(100% + 8px);
        width: 58px;
        grid-template-columns: 7px minmax(0, 1fr);
        gap: 5px;
        font-size: 7px;
        letter-spacing: 0;
      }
      .eval-track { width: 7px; }
      .eval-value { white-space: normal; }
      .eval-source { font-size: 6px; }
    }

    @media (max-width: 760px) {
      .game { min-height: var(--octagon-min-height); padding: 18px 16px 14px; gap: 8px; }
      .masthead { grid-template-columns: 1fr auto; align-items: center; padding-bottom: 10px; }
      .workspace { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr auto; gap: 6px 18px; }
      .board-wrap { grid-column: 1 / -1; grid-row: 1; width: min(100%, 62svh); }
      .player { grid-row: 2; padding-top: 4px; justify-content: start; }
      .player[data-side="blue"] { justify-self: end; }
      .player-name { font-size: 20px; }
      .player-detail { font-size: 8px; }
      .engine-eval {
        top: 21%;
        right: 1%;
        left: auto;
        width: min(31vw, 130px);
        height: 48%;
        gap: 7px;
        font-size: 8px;
      }
      .footer { grid-template-columns: 1fr auto; padding-top: 7px; }
      .move-count { grid-column: 2; justify-self: end; }
      .instruction { max-width: 220px; }
      .match-options { grid-column: 1 / -1; justify-self: stretch; justify-content: flex-end; flex-wrap: wrap; gap: 8px 14px; padding-top: 8px; }
      .formation-list { grid-template-columns: repeat(2, 1fr); }
      :host([presentation="embedded"]) { --octagon-board-size: 42cqh; }
      :host([presentation="embedded"]) .board-wrap {
        width: min(100%, var(--octagon-board-size), var(--octagon-board-max-size));
      }
    }

    @media (max-width: 420px) {
      h1 { font-size: 29px; }
      .eyebrow { display: none; }
      .plain-button { padding-inline: 9px; font-size: 13px; }
      .workspace { align-content: center; }
      .board-wrap { width: min(100%, 57svh); }
      .rules { padding: 22px 18px 26px; }
      .rules h2 { margin-bottom: 18px; }
      .formation-list { gap: 18px 14px; }
    }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; scroll-behavior: auto !important; }
    }
  </style>

  <main class="game" part="surface">
    <header class="masthead" part="header">
      <div class="brand" part="brand">
        <p class="eyebrow">A game of form &amp; foresight</p>
        <h1>OCTAGON</h1>
      </div>
      <span class="turn-copy analysis-live" role="status" aria-live="polite">Human to move</span>
      <nav class="utility" part="controls" aria-label="Game controls">
        <button class="plain-button undo" type="button" disabled>Undo</button>
        <button class="plain-button reset" type="button">New game</button>
        <button class="plain-button rules-button" type="button">Rules</button>
      </nav>
    </header>

    <section class="workspace" part="workspace" aria-label="Octagon game board">
      <div class="player active" part="player red-player" data-side="red">
        <p class="meta-label">First player</p>
        <div class="player-line"><span class="player-dot" style="--side-color: var(--octagon-red)" aria-hidden="true"></span><h2 class="player-name red-name">Human</h2></div>
        <p class="player-detail human-detail red-detail">Player 1</p>
        <label class="engine-strength red-strength" hidden>
          <span class="analysis-live">Red engine strength</span>
          <select class="player-difficulty red-difficulty" aria-label="Red engine strength">
            <option value="easy">Easy</option>
            <option value="medium" selected>Medium</option>
            <option value="hard">Hard</option>
            <option value="perfect">Perfect</option>
          </select>
        </label>
      </div>

      <div class="board-wrap" part="board-wrap">
        <svg class="board" part="board" viewBox="0 0 1000 1000" role="group" aria-label="Octagon board. Choose one of your pieces, then choose a highlighted destination."></svg>
        <aside class="engine-eval" hidden aria-label="Engine evaluation" aria-live="polite">
          <span class="eval-track" aria-hidden="true"><span class="eval-fill"></span><span class="eval-midline"></span></span>
          <span class="eval-copy"><span class="eval-value">Even.</span><span class="eval-source">Exact tablebase</span></span>
        </aside>
        <span class="winning-label" aria-hidden="true"></span>
        <div class="winner-overlay" hidden role="status" aria-live="polite"></div>
        <span class="analysis-live" aria-live="polite"></span>
      </div>

      <div class="player" part="player blue-player" data-side="blue">
        <p class="meta-label">Second player</p>
        <div class="player-line"><span class="player-dot" style="--side-color: var(--octagon-blue)" aria-hidden="true"></span><h2 class="player-name blue-name">Engine</h2></div>
        <p class="player-detail human-detail blue-detail" hidden>Player 2</p>
        <label class="engine-strength blue-strength">
          <span class="analysis-live">Blue engine strength</span>
          <select class="player-difficulty blue-difficulty" aria-label="Blue engine strength">
            <option value="easy">Easy</option>
            <option value="medium" selected>Medium</option>
            <option value="hard">Hard</option>
            <option value="perfect">Perfect</option>
          </select>
        </label>
      </div>
    </section>

    <footer class="footer" part="footer">
      <p class="instruction" part="instruction">Choose a red stone to begin.</p>
      <span class="move-count">Move 01</span>
      <div class="match-options" part="options">
        <label class="option-control">Match
          <select class="opponent">
            <option value="human-human">Human vs Human</option>
            <option value="human-engine" selected>Human vs Engine</option>
            <option value="engine-engine">Engine vs Engine</option>
          </select>
        </label>
        <label class="analysis-toggle" title="Show the position evaluation"><input class="evaluation-toggle" type="checkbox"> Evaluation</label>
        <label class="analysis-toggle" title="Show the engine's preferred move"><input class="best-move-toggle" type="checkbox"> Best move</label>
        <button class="plain-button formations-toggle" type="button" aria-label="Show winning positions" title="Show winning positions" aria-pressed="false">Wins</button>
      </div>
    </footer>
  </main>

  <dialog part="rules" aria-labelledby="rules-title">
    <div class="rules">
      <div class="rules-top">
        <div><p class="meta-label">How to play</p><h2 id="rules-title">Make the form.</h2></div>
        <button class="plain-button close-rules" type="button" aria-label="Close rules">Close</button>
      </div>
      <ol>
        <li>Red moves first. On each turn, move one stone to any open position connected by the board geometry.</li>
        <li>Select a stone to reveal every legal destination. Select a glowing position to complete the move.</li>
        <li>The first player to arrange all four stones into a winning formation wins. Threefold repetition or a position with no legal move is a draw.</li>
      </ol>
      <div class="formations">
        <p class="meta-label">Winning formations</p>
        <p class="formation-note">Watch each example cycle through its eight rotations. Reflected versions count too.</p>
        <div class="formation-list" aria-label="Examples of the four winning formations"></div>
      </div>
    </div>
  </dialog>
`;

function segmentIntersection(a1, a2, b1, b2) {
  const denominator = (a1[0] - a2[0]) * (b1[1] - b2[1]) - (a1[1] - a2[1]) * (b1[0] - b2[0]);
  const determinantA = a1[0] * a2[1] - a1[1] * a2[0];
  const determinantB = b1[0] * b2[1] - b1[1] * b2[0];
  return [
    (determinantA * (b1[0] - b2[0]) - (a1[0] - a2[0]) * determinantB) / denominator,
    (determinantA * (b1[1] - b2[1]) - (a1[1] - a2[1]) * determinantB) / denominator,
  ];
}

function lineIntersection(lineA, lineB) {
  const [a1, a2] = lineA.map((index) => OUTER_POINTS[index]);
  const [b1, b2] = lineB.map((index) => OUTER_POINTS[index]);
  return segmentIntersection(a1, a2, b1, b2);
}

const POSITION_POINTS = [
  ...START_INTERSECTIONS.map(([a, b]) => lineIntersection(BOARD_LINES[a], BOARD_LINES[b])),
  ...INNER_INTERSECTIONS.map(([a, b]) => lineIntersection(BOARD_LINES[a], BOARD_LINES[b])),
  ...OUTER_POINTS,
];

const PROPER_OUTER_POINTS = Object.freeze([
  [500, 45], [822, 178], [955, 500], [822, 822],
  [500, 955], [178, 822], [45, 500], [178, 178],
]);
// Intersections of neighboring long diagonals keep each winning line straight:
// O_i, I_(i+1), I_(i+2), O_(i+3).
const PROPER_INNER_POINTS = Object.freeze(Array.from({ length: 8 }, (_, index) => segmentIntersection(
  PROPER_OUTER_POINTS[(index + 6) % 8],
  PROPER_OUTER_POINTS[(index + 1) % 8],
  PROPER_OUTER_POINTS[(index + 7) % 8],
  PROPER_OUTER_POINTS[(index + 2) % 8],
)));
// Each numbered start is the crossing of O_(i-1)-I_i and O_i-I_(i-1),
// exactly as on the photographed family board. It remains a real state
// position, but deliberately has no dot of its own in the artwork.
const PROPER_START_POINTS = Object.freeze(Array.from({ length: 8 }, (_, index) => segmentIntersection(
  PROPER_OUTER_POINTS[(index + 7) % 8],
  PROPER_INNER_POINTS[index],
  PROPER_OUTER_POINTS[index],
  PROPER_INNER_POINTS[(index + 7) % 8],
)));
const PROPER_POSITION_POINTS = Object.freeze([
  ...PROPER_START_POINTS,
  ...PROPER_INNER_POINTS,
  ...PROPER_OUTER_POINTS,
]);

const legacySegments = Object.freeze(BOARD_LINES.map(([from, to]) => Object.freeze({
  from: OUTER_POINTS[from],
  to: OUTER_POINTS[to],
  kind: "legacy",
})));

function properSegments() {
  const segments = [];
  for (let left = 0; left < 8; left += 1) {
    for (let right = left + 1; right < 8; right += 1) {
      segments.push({ from: PROPER_INNER_POINTS[left], to: PROPER_INNER_POINTS[right], kind: "inner-web" });
    }
  }
  for (let outer = 0; outer < 8; outer += 1) {
    for (const offset of [-1, 0, 1]) {
      const inner = (outer + offset + 8) % 8;
      segments.push({ from: PROPER_OUTER_POINTS[outer], to: PROPER_INNER_POINTS[inner], kind: "spoke" });
    }
  }
  for (const parity of [0, 1]) {
    const square = [parity, parity + 2, parity + 4, parity + 6, parity];
    for (let edge = 0; edge < 4; edge += 1) {
      segments.push({
        from: PROPER_OUTER_POINTS[square[edge]],
        to: PROPER_OUTER_POINTS[square[edge + 1]],
        kind: "karo-guide",
      });
    }
  }
  return Object.freeze(segments.map(Object.freeze));
}

const PROPER_SEGMENTS = properSegments();
const BOARD_LAYOUTS = Object.freeze({
  [RULESET_IDS.LEGACY]: Object.freeze({
    points: POSITION_POINTS,
    segments: legacySegments,
    formationSegments: legacySegments,
    surface: "320,50 680,50 950,320 950,680 680,950 320,950 50,680 50,320",
  }),
  [RULESET_IDS.PROPER]: Object.freeze({
    points: PROPER_POSITION_POINTS,
    segments: PROPER_SEGMENTS,
    formationSegments: PROPER_SEGMENTS.filter(({ kind }) => kind === "spoke"),
    surface: "500,45 822,178 955,500 822,822 500,955 178,822 45,500 178,178",
  }),
});

function svgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NS, name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
  return element;
}

export class OctagonGame extends HTMLElement {
  static observedAttributes = ["red-name", "blue-name", "ruleset", "presentation"];

  constructor() {
    super();
    this.attachShadow({ mode: "open" }).append(template.content.cloneNode(true));
    const requestedRuleset = this.getAttribute("ruleset");
    this.state = createInitialState(RULESETS[requestedRuleset] ? requestedRuleset : DEFAULT_RULESET);
    this.history = [];
    this.selected = null;
    this._engineAdapters = { [SIDES.RED]: null, [SIDES.BLUE]: null };
    this._engineDifficulties = { [SIDES.RED]: "medium", [SIDES.BLUE]: "medium" };
    this._matchMode = "human-engine";
    this._aiRequest = null;
    this._analysisAdapter = null;
    this._analysisRuleset = null;
    this._analysisRequest = null;
    this._analysisResult = null;
    this._analysisBusy = false;
    this._moveAnimation = null;
    this._winningPatternVisible = false;
    this._winningPatternIndex = 0;
    this._winningPatternTimer = null;
    this._winnerRevealed = false;
    this.nodes = [];
    this._humanNames = {
      [SIDES.RED]: this.getAttribute("red-name"),
      [SIDES.BLUE]: this.getAttribute("blue-name"),
    };
  }

  connectedCallback() {
    if (this._connected) return;
    this._connected = true;
    this._buildBoard();
    this._buildFormationGuide();
    this.shadowRoot.querySelector(".undo").addEventListener("click", () => this.undo());
    this.shadowRoot.querySelector(".reset").addEventListener("click", () => this.reset());
    const opponentSelect = this.shadowRoot.querySelector(".opponent");
    [SIDES.RED, SIDES.BLUE].forEach((side) => {
      const difficultySelect = this.shadowRoot.querySelector(`.${side}-difficulty`);
      Object.entries(DISPLAY_DIFFICULTIES).forEach(([value, preset]) => {
        const option = difficultySelect.querySelector(`[value="${value}"]`);
        option.textContent = preset.label;
        option.title = preset.description;
      });
      difficultySelect.addEventListener("change", () => {
        this._changeEngineDifficulty(side, difficultySelect.value);
      });
    });
    opponentSelect.addEventListener("change", () => this._changeOpponent(opponentSelect.value));
    this.shadowRoot.querySelector(".evaluation-toggle").addEventListener("change", () => this._analysisToggled());
    this.shadowRoot.querySelector(".best-move-toggle").addEventListener("change", () => this._analysisToggled());
    this.shadowRoot.querySelector(".formations-toggle").addEventListener("click", () => this._toggleWinningPatterns());
    const dialog = this.shadowRoot.querySelector("dialog");
    this.shadowRoot.querySelector(".rules-button").addEventListener("click", () => dialog.showModal());
    this.shadowRoot.querySelector(".close-rules").addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
    this._changeOpponent(opponentSelect.value);
    this._maybeRequestAnalysis();
  }

  disconnectedCallback() {
    this._cancelAiRequest();
    this._cancelAnalysisRequest();
    this._cancelMoveAnimation();
    this._stopWinningPatternCycle();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (!this._connected) return;
    if (name === "ruleset" && oldValue !== newValue && RULESETS[newValue] && this.state.ruleset !== newValue) {
      this._changeRuleset(newValue, false);
      return;
    }
    this._render();
  }

  set aiAdapter(adapter) {
    if (adapter !== null && typeof adapter?.chooseMove !== "function") {
      throw new TypeError("An Octagon AI adapter must provide chooseMove(context).");
    }
    this._cancelAiRequest();
    this._engineAdapters[SIDES.BLUE] = adapter;
    this._render();
    this._maybeRequestAiMove();
  }

  get aiAdapter() { return this._engineAdapters[SIDES.BLUE]; }

  setOpponent({ side = SIDES.BLUE, name = "Engine", adapter } = {}) {
    if (![SIDES.RED, SIDES.BLUE].includes(side)) throw new TypeError("AI side must be red or blue.");
    if (typeof adapter?.chooseMove !== "function") {
      throw new TypeError("An Octagon AI adapter must provide chooseMove(context).");
    }
    this._cancelAiRequest();
    this._engineAdapters[side] = adapter;
    this.setAttribute(`${side}-name`, name);
    this._render();
    this._maybeRequestAiMove();
  }

  clearOpponent(side = SIDES.BLUE) {
    if (![SIDES.RED, SIDES.BLUE].includes(side)) throw new TypeError("AI side must be red or blue.");
    this._cancelAiRequest();
    this._engineAdapters[side] = null;
    this._restoreHumanName(side);
    this._render();
  }

  _changeOpponent(value) {
    if (!["human-human", "human-engine", "engine-engine"].includes(value)) {
      throw new RangeError(`Unknown Octagon match: ${value}`);
    }
    this._cancelAiRequest();
    this._matchMode = value;
    this._engineAdapters[SIDES.RED] = null;
    this._engineAdapters[SIDES.BLUE] = null;
    this._restoreHumanName(SIDES.RED);
    this._restoreHumanName(SIDES.BLUE);
    if (value === "human-engine" || value === "engine-engine") {
      this._useBuiltInAi(SIDES.BLUE, this._engineDifficulties[SIDES.BLUE]);
    }
    if (value === "engine-engine") {
      this._useBuiltInAi(SIDES.RED, this._engineDifficulties[SIDES.RED]);
    }
    this.shadowRoot.querySelector(".opponent").value = value;
    this.reset();
  }

  _useBuiltInAi(side, difficulty) {
    this._engineDifficulties[side] = difficulty;
    const adapter = difficulty === "perfect"
      ? createPerfectOctagonAI()
      : createOctagonAI({ difficulty });
    this._engineAdapters[side] = adapter;
    this.setAttribute(`${side}-name`, "Engine");
  }

  _changeEngineDifficulty(side, difficulty) {
    const nextDifficulty = this.state.ruleset === RULESET_IDS.LEGACY && difficulty === "perfect"
      ? "hard"
      : difficulty;
    if (!DISPLAY_DIFFICULTIES[nextDifficulty]) {
      throw new RangeError(`Unknown Octagon AI difficulty: ${difficulty}`);
    }
    this._engineDifficulties[side] = nextDifficulty;
    this.shadowRoot.querySelector(`.${side}-difficulty`).value = nextDifficulty;
    if (this._isEngine(side)) {
      this._cancelAiRequest();
      this._useBuiltInAi(side, nextDifficulty);
      this._render();
      this._maybeRequestAiMove();
    }
  }

  _restoreHumanName(side) {
    const name = this._humanNames[side];
    if (name === null) this.removeAttribute(`${side}-name`);
    else this.setAttribute(`${side}-name`, name);
  }

  _isEngine(side) {
    return Boolean(this._engineAdapters[side]);
  }

  _changeRuleset(ruleset, syncAttribute = true) {
    if (!RULESETS[ruleset]) throw new RangeError(`Unknown Octagon ruleset: ${ruleset}`);
    this._cancelAiRequest();
    this._cancelAnalysisRequest();
    this._cancelMoveAnimation();
    this._analysisAdapter = null;
    this._analysisRuleset = null;
    this._analysisResult = null;
    this._winnerRevealed = false;
    this.state = createInitialState(ruleset);
    this.history = [];
    this.selected = null;
    this._buildBoard();
    this._buildFormationGuide();
    if (ruleset === RULESET_IDS.LEGACY) {
      [SIDES.RED, SIDES.BLUE].forEach((side) => {
        if (this._engineDifficulties[side] === "perfect") this._changeEngineDifficulty(side, "hard");
      });
    }
    if (syncAttribute && this.getAttribute("ruleset") !== ruleset) this.setAttribute("ruleset", ruleset);
    this._render();
    this.dispatchEvent(new CustomEvent("octagon-ruleset-change", {
      detail: { ruleset }, bubbles: true, composed: true,
    }));
    this._maybeRequestAiMove();
    this._maybeRequestAnalysis();
  }

  reset() {
    this._cancelAiRequest();
    this._cancelAnalysisRequest();
    this._cancelMoveAnimation();
    this._analysisResult = null;
    this._winnerRevealed = false;
    this.state = createInitialState(this.state.ruleset);
    this.history = [];
    this.selected = null;
    this._render();
    this.dispatchEvent(new CustomEvent("octagon-reset", { bubbles: true, composed: true }));
    this._maybeRequestAiMove();
    this._maybeRequestAnalysis();
  }

  undo() {
    if (!this.history.length) return;
    this._cancelAiRequest();
    this._cancelAnalysisRequest();
    this._cancelMoveAnimation();
    this._analysisResult = null;
    this._winnerRevealed = false;
    this.state = this.history.pop();
    // In a computer match, return control to the human instead of exposing an
    // intermediate AI-to-move position after undoing a completed computer turn.
    if (this._matchMode === "human-engine" && this._isEngine(this.state.turn) && this.history.length) {
      this.state = this.history.pop();
    }
    this.selected = null;
    this._render();
    this.dispatchEvent(new CustomEvent("octagon-undo", {
      detail: { state: cloneState(this.state) }, bubbles: true, composed: true,
    }));
    this._maybeRequestAiMove();
    this._maybeRequestAnalysis();
  }

  _buildBoard() {
    const svg = this.shadowRoot.querySelector(".board");
    const layout = BOARD_LAYOUTS[this.state.ruleset];
    svg.replaceChildren();
    svg.setAttribute("aria-label", `${RULESETS[this.state.ruleset].label} Octagon board. Choose one of your pieces, then choose a highlighted destination.`);
    this.nodes = [];
    const defs = svgElement("defs");
    const arrow = svgElement("marker", {
      id: "best-arrow", viewBox: "0 0 10 10", refX: "8", refY: "5",
      markerWidth: "7", markerHeight: "7", orient: "auto-start-reverse",
    });
    arrow.append(svgElement("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: "rgba(244,241,221,.9)" }));
    defs.append(arrow);
    svg.append(defs);
    const lineGroup = svgElement("g", { "aria-hidden": "true" });
    layout.segments.forEach(({ from, to, kind }) => {
      lineGroup.append(svgElement("line", {
        class: `board-line ${kind}`,
        x1: from[0], y1: from[1], x2: to[0], y2: to[1],
      }));
    });
    svg.append(lineGroup);
    this.bestMoveLine = svgElement("line", { class: "best-move-line", "marker-end": "url(#best-arrow)", "aria-hidden": "true" });
    svg.append(this.bestMoveLine);

    const nodeGroup = svgElement("g");
    layout.points.forEach(([x, y], position) => {
      const isProperStart = this.state.ruleset === RULESET_IDS.PROPER && position < 8;
      const node = svgElement("g", {
        class: `node${isProperStart ? " proper-start" : ""}`,
        tabindex: "0",
        role: "button",
        "data-position": position,
      });
      node.append(
        svgElement("circle", { class: "selection-ring", cx: x, cy: y, r: 39 }),
        svgElement("circle", { class: "target-ring", cx: x, cy: y, r: 27 }),
        svgElement("circle", { class: "point", cx: x, cy: y, r: 10 }),
        svgElement("circle", { class: "piece", cx: x, cy: y, r: 21 }),
        ...(isProperStart ? [svgElement("text", {
          class: "start-label", x, y, "aria-hidden": "true",
        })] : []),
        svgElement("circle", { class: "hit-focus", cx: x, cy: y, r: 34 }),
        svgElement("circle", { class: "hit", cx: x, cy: y, r: 42 }),
      );
      if (isProperStart) node.querySelector(".start-label").textContent = position % 2 === 0 ? "1" : "2";
      node.addEventListener("click", () => this._activatePosition(position));
      node.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          this._activatePosition(position);
        }
      });
      this.nodes.push(node);
      nodeGroup.append(node);
    });
    svg.append(nodeGroup);
    this.winningPatternGroup = svgElement("g", {
      class: "winning-pattern",
      "aria-hidden": "true",
    });
    svg.append(this.winningPatternGroup);
    this._renderWinningPattern();
  }

  _buildFormationGuide() {
    const list = this.shadowRoot.querySelector(".formation-list");
    const definition = RULESETS[this.state.ruleset];
    const layout = BOARD_LAYOUTS[this.state.ruleset];
    list.replaceChildren();
    this.shadowRoot.querySelector(".formation-note").textContent = this.state.ruleset === RULESET_IDS.PROPER
      ? "Each example cycles through every photographed orientation. Karo includes both the small and large square."
      : "Each example cycles through all of its rotations and ring variants. Reflections count too.";
    const shouldAnimate = !globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    definition.formations.forEach(({ name, description, pattern, variants }, exampleIndex) => {
      const animationPatterns = variants ?? [pattern];
      const rotationKeyTimes = Array.from(
        { length: animationPatterns.length + 1 },
        (_, step) => String(step / animationPatterns.length),
      ).join(";");
      const rotationDuration = `${FORMATION_STEP_SECONDS * animationPatterns.length}s`;
      const figure = document.createElement("figure");
      figure.className = "formation-example";

      const svg = svgElement("svg", {
        class: "formation-board",
        viewBox: "0 0 1000 1000",
        role: "img",
        "aria-label": `${name}: ${description}`,
      });
      svg.append(svgElement("polygon", {
        class: "formation-surface",
        points: layout.surface,
      }));

      const lines = svgElement("g", { "aria-hidden": "true" });
      layout.formationSegments.forEach(({ from, to, kind }) => {
        lines.append(svgElement("line", {
          class: `formation-line ${kind}`,
          x1: from[0], y1: from[1], x2: to[0], y2: to[1],
        }));
      });
      svg.append(lines);

      const points = svgElement("g", { "aria-hidden": "true" });
      // Start positions 0-7 never count toward a win, so the guide deliberately
      // draws only the inner and outer formation points.
      layout.points.slice(8).forEach(([x, y]) => {
        points.append(svgElement("circle", { class: "formation-point", cx: x, cy: y, r: 20 }));
      });
      pattern.forEach((position, pieceIndex) => {
        const [cx, cy] = layout.points[position];
        const piece = svgElement("circle", {
          class: "formation-piece",
          cx,
          cy,
          r: 42,
          style: `--formation-index: ${exampleIndex}`,
        });
        if (shouldAnimate && animationPatterns.length > 1) {
          const animatedPositions = [
            ...animationPatterns.map((variant) => variant[pieceIndex]),
            animationPatterns[0][pieceIndex],
          ];
          const xValues = animatedPositions.map((animated) => layout.points[animated][0]).join(";");
          const yValues = animatedPositions.map((animated) => layout.points[animated][1]).join(";");
          piece.append(
            svgElement("animate", {
              attributeName: "cx",
              values: xValues,
              keyTimes: rotationKeyTimes,
              dur: rotationDuration,
              calcMode: "discrete",
              repeatCount: "indefinite",
            }),
            svgElement("animate", {
              attributeName: "cy",
              values: yValues,
              keyTimes: rotationKeyTimes,
              dur: rotationDuration,
              calcMode: "discrete",
              repeatCount: "indefinite",
            }),
            svgElement("animate", {
              attributeName: "opacity",
              values: "1;1;0;0",
              keyTimes: "0;0.72;0.9;1",
              dur: `${FORMATION_STEP_SECONDS}s`,
              repeatCount: "indefinite",
            }),
          );
        }
        points.append(piece);
      });
      svg.append(points);

      const caption = document.createElement("figcaption");
      const title = document.createElement("span");
      title.className = "formation-name";
      title.textContent = name;
      const copy = document.createElement("span");
      copy.className = "formation-description";
      copy.textContent = description;
      caption.append(title, copy);
      figure.append(svg, caption);
      list.append(figure);
    });
  }

  _winningPatterns() {
    return RULESETS[this.state.ruleset].formations.flatMap(({ name, pattern, variants }) =>
      (variants ?? [pattern]).map((positions) => ({ name, positions })),
    );
  }

  _toggleWinningPatterns() {
    this._winningPatternVisible = !this._winningPatternVisible;
    this._winningPatternIndex = 0;
    const button = this.shadowRoot.querySelector(".formations-toggle");
    button.setAttribute("aria-pressed", String(this._winningPatternVisible));
    this.shadowRoot.querySelector(".game").classList.toggle("show-formations", this._winningPatternVisible);
    this._stopWinningPatternCycle();
    this._renderWinningPattern();

    const reduceMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (this._winningPatternVisible && !reduceMotion) {
      this._winningPatternTimer = setInterval(() => {
        const patterns = this._winningPatterns();
        this._winningPatternIndex = (this._winningPatternIndex + 1) % patterns.length;
        this._renderWinningPattern();
      }, 1200);
    }
  }

  _stopWinningPatternCycle() {
    if (this._winningPatternTimer !== null) clearInterval(this._winningPatternTimer);
    this._winningPatternTimer = null;
  }

  _renderWinningPattern() {
    if (!this.winningPatternGroup) return;
    this.winningPatternGroup.replaceChildren();
    const label = this.shadowRoot.querySelector(".winning-label");
    if (!this._winningPatternVisible) {
      label.textContent = "";
      return;
    }

    const patterns = this._winningPatterns();
    const entry = patterns[this._winningPatternIndex % patterns.length];
    const points = BOARD_LAYOUTS[this.state.ruleset].points;
    entry.positions.forEach((position, index) => {
      const [cx, cy] = points[position];
      this.winningPatternGroup.append(
        svgElement("circle", {
          class: "winning-marker",
          cx,
          cy,
          r: 35,
          style: `animation-delay: ${index * 80}ms`,
        }),
      );
    });
    label.textContent = `${entry.name} · ${this._winningPatternIndex + 1}/${patterns.length}`;
  }

  _activatePosition(position) {
    if (this._moveAnimation || this.state.winner || this.state.drawReason || this._isEngine(this.state.turn)) return;
    const ownPieces = this.state[this.state.turn];
    const moves = getLegalMoves(this.state);

    if (ownPieces.includes(position)) {
      this.selected = this.selected === position ? null : position;
      this._render();
      return;
    }

    const move = moves.find(({ from, to }) => from === this.selected && to === position);
    if (move) this._commitMove(move, "human");
  }

  _commitMove(move, actor) {
    this._cancelAnalysisRequest();
    this._analysisResult = null;
    const before = this.state;
    this.history.push(before);
    this.state = applyMove(before, move);
    this._winnerRevealed = false;
    const committedState = this.state;
    this.selected = null;
    this._render();
    const animation = this._animateMove(move, before.turn);
    this._render();
    this.dispatchEvent(new CustomEvent("octagon-move", {
      detail: { move: { ...move }, actor, state: cloneState(this.state) },
      bubbles: true,
      composed: true,
    }));
    if (this.state.winner || this.state.drawReason) {
      this.dispatchEvent(new CustomEvent("octagon-game-over", {
        detail: { winner: this.state.winner, drawReason: this.state.drawReason, state: cloneState(this.state) },
        bubbles: true,
        composed: true,
      }));
    }
    animation.then(() => {
      if (this.state !== committedState) return;
      this._winnerRevealed = Boolean(this.state.winner);
      this._render();
      if (!this.state.winner && !this.state.drawReason) this._maybeRequestAiMove();
      this._maybeRequestAnalysis();
    });
  }

  _animateMove(move, side) {
    const reduceMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const points = BOARD_LAYOUTS[this.state.ruleset].points;
    if (reduceMotion || !points[move.from] || !points[move.to]) return Promise.resolve();
    this._cancelMoveAnimation();
    const svg = this.shadowRoot.querySelector(".board");
    const [fromX, fromY] = points[move.from];
    const [toX, toY] = points[move.to];
    const duration = Math.round(Math.min(920, 620 + Math.hypot(toX - fromX, toY - fromY) * .22));
    const color = `var(--octagon-${side})`;
    const trail = svgElement("line", {
      class: "moving-piece-trail",
      x1: fromX,
      y1: fromY,
      x2: fromX,
      y2: fromY,
      style: `--moving-color: ${color}`,
      "aria-hidden": "true",
    });
    const halo = svgElement("circle", {
      class: "moving-piece-halo",
      cx: fromX,
      cy: fromY,
      r: 34,
      style: `--moving-color: ${color}`,
      "aria-hidden": "true",
    });
    const moving = svgElement("circle", {
      class: `piece ${side} moving-piece`, cx: fromX, cy: fromY, r: 21, "aria-hidden": "true",
    });
    svg.append(trail, halo, moving);
    const destination = this.nodes[move.to];
    destination?.classList.add("piece-arriving");

    return new Promise((resolve) => {
      let finished = false;
      const startedAt = performance.now();
      const animation = {
        finish: () => {
          if (finished) return;
          finished = true;
          clearTimeout(animation.timer);
          cancelAnimationFrame(animation.frame);
          trail.remove();
          halo.remove();
          moving.remove();
          destination?.classList.remove("piece-arriving");
          if (this._moveAnimation === animation) this._moveAnimation = null;
          resolve();
        },
        frame: 0,
        timer: null,
      };
      const drawFrame = (now) => {
        const progress = Math.min(1, (now - startedAt) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        const x = fromX + (toX - fromX) * eased;
        const y = fromY + (toY - fromY) * eased;
        const emphasis = Math.sin(progress * Math.PI);
        moving.setAttribute("cx", x);
        moving.setAttribute("cy", y);
        moving.setAttribute("r", 23 + emphasis * 5);
        halo.setAttribute("cx", x);
        halo.setAttribute("cy", y);
        halo.setAttribute("r", 34 + emphasis * 8);
        trail.setAttribute("x2", x);
        trail.setAttribute("y2", y);
        trail.setAttribute("opacity", String(.38 * (1 - progress)));
        if (progress < 1) animation.frame = requestAnimationFrame(drawFrame);
        else animation.finish();
      };
      this._moveAnimation = animation;
      animation.frame = requestAnimationFrame(drawFrame);
      animation.timer = setTimeout(animation.finish, duration + 120);
    });
  }

  _cancelMoveAnimation() {
    this._moveAnimation?.finish();
  }

  async _maybeRequestAiMove() {
    const adapter = this._engineAdapters[this.state.turn];
    if (!this.isConnected || this._moveAnimation || !adapter || this.state.winner || this.state.drawReason) return;
    this._cancelAiRequest();
    const controller = new AbortController();
    this._aiRequest = controller;
    this._render();
    const stateAtRequest = this.state;
    const legalMoves = getLegalMoves(stateAtRequest).map((move) => ({ ...move }));
    try {
      const move = await adapter.chooseMove({
        state: cloneState(stateAtRequest),
        legalMoves,
        signal: controller.signal,
      });
      if (!controller.signal.aborted && this.state === stateAtRequest && move) this._commitMove(move, "computer");
    } catch (error) {
      if (error?.name !== "AbortError") {
        this.dispatchEvent(new CustomEvent("octagon-ai-error", {
          detail: { error }, bubbles: true, composed: true,
        }));
      }
    } finally {
      if (this._aiRequest === controller) {
        this._aiRequest = null;
        this._render();
      }
    }
  }

  _cancelAiRequest() {
    this._aiRequest?.abort();
    this._aiRequest = null;
  }

  _analysisToggled() {
    const enabled = this.shadowRoot.querySelector(".evaluation-toggle").checked
      || this.shadowRoot.querySelector(".best-move-toggle").checked;
    if (!enabled) {
      this._cancelAnalysisRequest();
      this._analysisResult = null;
      this._renderAnalysis();
      return;
    }
    this._maybeRequestAnalysis();
  }

  _cancelAnalysisRequest() {
    this._analysisRequest?.abort();
    this._analysisRequest = null;
    this._analysisBusy = false;
  }

  _analysisEngine() {
    if (this._analysisAdapter && this._analysisRuleset === this.state.ruleset) return this._analysisAdapter;
    this._analysisRuleset = this.state.ruleset;
    this._analysisAdapter = this.state.ruleset === RULESET_IDS.PROPER
      ? createPerfectOctagonAI()
      : createOctagonAI({ difficulty: "hard" });
    return this._analysisAdapter;
  }

  async _maybeRequestAnalysis() {
    if (!this.isConnected) return;
    const showEvaluation = this.shadowRoot.querySelector(".evaluation-toggle").checked;
    const showBestMove = this.shadowRoot.querySelector(".best-move-toggle").checked;
    if (!showEvaluation && !showBestMove) return;
    this._cancelAnalysisRequest();
    const controller = new AbortController();
    const stateAtRequest = this.state;
    this._analysisRequest = controller;
    this._analysisBusy = true;
    this._renderAnalysis();
    try {
      const result = await this._analysisEngine().analyze({
        state: cloneState(stateAtRequest),
        legalMoves: getLegalMoves(stateAtRequest),
        signal: controller.signal,
      });
      if (!controller.signal.aborted && this.state === stateAtRequest) {
        this._analysisResult = result;
        this.dispatchEvent(new CustomEvent("octagon-analysis", {
          detail: { analysis: result, state: cloneState(this.state) }, bubbles: true, composed: true,
        }));
      }
    } catch (error) {
      if (error?.name !== "AbortError") {
        this._analysisResult = { error };
        this.dispatchEvent(new CustomEvent("octagon-analysis-error", {
          detail: { error }, bubbles: true, composed: true,
        }));
      }
    } finally {
      if (this._analysisRequest === controller) {
        this._analysisRequest = null;
        this._analysisBusy = false;
        this._renderAnalysis();
      }
    }
  }

  _positionName(position) {
    return `${position < 8 ? "S" : position < 16 ? "I" : "O"}${position % 8}`;
  }

  _renderAnalysis() {
    if (!this.nodes.length) return;
    const showEvaluation = this.shadowRoot.querySelector(".evaluation-toggle").checked;
    const showBestMove = this.shadowRoot.querySelector(".best-move-toggle").checked;
    const panel = this.shadowRoot.querySelector(".engine-eval");
    const live = this.shadowRoot.querySelector(".analysis-live");
    panel.hidden = !showEvaluation;
    this.bestMoveLine?.classList.remove("visible");

    if (this._analysisBusy) {
      panel.querySelector(".eval-value").textContent = "Analyzing…";
      panel.querySelector(".eval-source").textContent = this.state.ruleset === RULESET_IDS.PROPER ? "Exact tablebase" : "Engine search";
      live.textContent = "Analyzing best move.";
      return;
    }
    const analysis = this._analysisResult;
    if (!analysis || analysis.error) {
      panel.querySelector(".eval-value").textContent = analysis?.error ? "Evaluation unavailable." : "—";
      panel.querySelector(".eval-source").textContent = "Analysis";
      panel.style.setProperty("--eval-red", "50%");
      live.textContent = analysis?.error ? "Analysis unavailable." : "";
      return;
    }

    if (analysis.outcome) {
      const winner = analysis.outcome === "draw"
        ? null
        : analysis.outcome === "win" ? this.state.turn : (this.state.turn === SIDES.RED ? SIDES.BLUE : SIDES.RED);
      const redPercent = winner === SIDES.RED ? 92 : winner === SIDES.BLUE ? 8 : 50;
      panel.style.setProperty("--eval-red", `${redPercent}%`);
      const moveDistance = analysis.distance === null ? null : Math.ceil(analysis.distance / 2);
      panel.querySelector(".eval-value").textContent = winner
        ? `${winner === SIDES.RED ? "Red" : "Blue"} Win in ${moveDistance} ${moveDistance === 1 ? "Move" : "Moves"}.`
        : "Draw.";
      panel.querySelector(".eval-source").textContent = "Exact tablebase";
    } else {
      const score = Number.isFinite(analysis.score) ? analysis.score : 0;
      const redScore = this.state.turn === SIDES.RED ? score : -score;
      const redPercent = 50 + 44 * Math.tanh(redScore / 180);
      panel.style.setProperty("--eval-red", `${redPercent}%`);
      const leader = Math.abs(redScore) < 5 ? "Even" : redScore > 0 ? "Red" : "Blue";
      panel.querySelector(".eval-value").textContent = leader === "Even"
        ? "Even position."
        : `${leader} advantage ${(Math.abs(redScore) / 100).toFixed(1)}.`;
      panel.querySelector(".eval-source").textContent = `Engine depth ${analysis.depth ?? 0}${analysis.completed ? "" : "+"}`;
    }

    const move = analysis.move;
    if (!showBestMove || !move) {
      live.textContent = move ? "" : "No legal move.";
      return;
    }
    const points = BOARD_LAYOUTS[this.state.ruleset].points;
    const [fromX, fromY] = points[move.from];
    const [toX, toY] = points[move.to];
    const dx = toX - fromX;
    const dy = toY - fromY;
    const length = Math.hypot(dx, dy) || 1;
    const startInset = 30;
    const endInset = 40;
    this.bestMoveLine.setAttribute("x1", fromX + dx / length * startInset);
    this.bestMoveLine.setAttribute("y1", fromY + dy / length * startInset);
    this.bestMoveLine.setAttribute("x2", toX - dx / length * endInset);
    this.bestMoveLine.setAttribute("y2", toY - dy / length * endInset);
    this.bestMoveLine.classList.add("visible");
    live.textContent = `Best move ${this._positionName(move.from)} to ${this._positionName(move.to)}.`;
  }

  _render() {
    if (!this.nodes.length) return;
    const legalMoves = getLegalMoves(this.state);
    const legalTargets = new Set(this.selected === null ? [] : legalMoves
      .filter(({ from }) => from === this.selected)
      .map(({ to }) => to));
    const isAiThinking = this._aiRequest && this._isEngine(this.state.turn);

    this.nodes.forEach((node, position) => {
      const side = this.state.red.includes(position) ? SIDES.RED : this.state.blue.includes(position) ? SIDES.BLUE : null;
      const selectable = !this._moveAnimation
        && !this.state.winner
        && !this.state.drawReason
        && !isAiThinking
        && !this._isEngine(this.state.turn)
        && side === this.state.turn;
      const target = legalTargets.has(position);
      node.classList.toggle("occupied", Boolean(side));
      node.classList.toggle("selectable", selectable);
      node.classList.toggle("selected", position === this.selected);
      node.classList.toggle("target", target);
      const piece = node.querySelector(".piece");
      piece.classList.toggle("red", side === SIDES.RED);
      piece.classList.toggle("blue", side === SIDES.BLUE);
      piece.style.display = side ? "block" : "none";
      const role = position < 8 ? "starting" : position < 16 ? "inner" : "outer";
      const ordinal = (position % 8) + 1;
      const label = side
        ? `${side} stone on ${role} position ${ordinal}${selectable ? ". Select this stone." : ""}`
        : `${role} position ${ordinal}${target ? ". Legal destination." : ". Empty."}`;
      node.setAttribute("aria-label", label);
      node.setAttribute("aria-pressed", position === this.selected ? "true" : "false");
    });

    const activeSide = this.state.winner ?? this.state.turn;
    const activeName = this._sideName(activeSide);
    const activeColor = activeSide === SIDES.RED ? "Red" : "Blue";
    const status = this.state.drawReason
      ? this.state.drawReason === "stalemate" ? "Draw by stalemate" : "Draw by repetition"
      : this.state.winner
      ? `${activeColor} wins`
      : isAiThinking
        ? `${activeColor} engine is thinking…`
        : `${activeName} to move`;
    const instruction = this.state.drawReason
      ? this.state.drawReason === "stalemate"
        ? `${activeName} has no legal move.`
        : "The same position occurred three times."
      : this.state.winner
      ? `${activeColor} completes a winning formation.`
      : isAiThinking
        ? `${activeColor} engine is choosing a move.`
        : this.selected === null
          ? `Choose a ${activeColor.toLowerCase()} stone.`
          : `${legalTargets.size} legal destination${legalTargets.size === 1 ? "" : "s"} shown.`;

    const game = this.shadowRoot.querySelector(".game");
    const showWinner = Boolean(this.state.winner && this._winnerRevealed);
    game.dataset.ruleset = this.state.ruleset;
    game.style.setProperty("--side-color", `var(--octagon-${activeSide})`);
    game.classList.toggle("win-flash", showWinner);
    this.shadowRoot.querySelector(".turn-copy").textContent = status;
    this.shadowRoot.querySelector(".instruction").textContent = instruction;
    this.shadowRoot.querySelector(".move-count").textContent = `Move ${String(this.state.ply + 1).padStart(2, "0")}`;
    this.shadowRoot.querySelectorAll('.player-difficulty [value="perfect"]').forEach((option) => {
      option.disabled = this.state.ruleset !== RULESET_IDS.PROPER;
    });
    this.shadowRoot.querySelector(".undo").disabled = !this.history.length;
    [SIDES.RED, SIDES.BLUE].forEach((side, index) => {
      const engine = this._isEngine(side);
      this.shadowRoot.querySelector(`.${side}-name`).textContent = this._sideName(side);
      this.shadowRoot.querySelector(`.${side}-detail`).textContent = `Player ${index + 1}`;
      this.shadowRoot.querySelector(`.${side}-detail`).hidden = engine;
      this.shadowRoot.querySelector(`.${side}-strength`).hidden = !engine;
      this.shadowRoot.querySelector(`.${side}-difficulty`).value = this._engineDifficulties[side];
    });
    const winnerOverlay = this.shadowRoot.querySelector(".winner-overlay");
    winnerOverlay.hidden = !showWinner;
    winnerOverlay.textContent = showWinner ? `${activeColor} Wins` : "";
    winnerOverlay.style.setProperty("--winner-color", `var(--octagon-${activeSide})`);
    this.shadowRoot.querySelectorAll(".player").forEach((player) => {
      player.classList.toggle("active", !this.state.drawReason && player.dataset.side === activeSide);
    });
    this._renderAnalysis();
  }

  _sideName(side) {
    return this.getAttribute(`${side}-name`)?.trim() || (this._isEngine(side) ? "Engine" : "Human");
  }
}

if (!customElements.get("octagon-game")) customElements.define("octagon-game", OctagonGame);
