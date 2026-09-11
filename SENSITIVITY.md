# Octagon: sensitivity and elegance

Exact experiments on the repository's family rules, 10 September 2026.

**The original has a defensible kind of elegance, but it is not uniquely elegant.**
All four of its winning *families* are necessary for its forced opening win:
every one of the 14 smaller nonempty combinations draws. However, removing both
outer-ring squares leaves an **18-target game with a forced win in 39 plies**.
Recognizing crowns in all eight orientations gives a **24-target game with a
forced win in 45 plies**. Both are serious alternatives to the original 89-ply
game, for different reasons.

There are **50 exact experiments**, including removals within families, new
targets, and changes to movement and deployment. The self-contained
[interactive explorer](analysis/explorer.html) lets you select a variant,
inspect every winning target, and replay one optimal line. It opens directly
from disk. The complete measurements are in [CSV](analysis/results.csv) and
[JSON](analysis/results.json).

**What the previous analysis established.**

[THEORY.md](THEORY.md) solves the family game as a first-player win in 89 plies:
45 White moves and 44 Black moves. The winner minimizes the remaining length;
the loser maximizes it. The four representative opening moves are:

| First move | Result for the first player | Total plies, including the opening |
|---|---|---:|
| S0 → I0 | Win | 89 |
| S0 → I7 | Draw | — |
| S0 → O0 | Loss | 90 |
| S0 → O7 | Loss | 92 |

Quarter-turn rotations supply the other equivalent openings. Four of the 16
legal first moves preserve the win; four draw and eight lose.

The 89-ply number is a worst-case conversion distance under optimal resistance.
It is not the depth an engine necessarily needs to search, the expected duration
of a human game, or a measurement of human difficulty. The historical
[engine backtests](web/BACKTEST.md) give some practical evidence that shallow
search struggles, but their tiny samples and changing engine versions do not
establish human difficulty or a general strength ranking between variants.

The new measurements add a more specific description: on the reproducible
89-ply optimal line, White has exactly one win-preserving move on **10 of its
45 turns**. Averaging separately over those 45 turns, **29.9% of legal moves**
preserve a forced win. That describes a narrow route on this line, with the
caveat that other equally optimal lines can have different choice profiles.
A unique good move can also be obvious; these counts do not measure recognition.

**Removing whole families.**

The original targets are four squares (Karo), four crowns, four axial lines,
and eight diagonal lines. Movement is held fixed in all target experiments.

| Change from the original | Targets left | Opening | Reachable states that draw |
|---|---:|---|---:|
| None | 20 | First wins in 89 | 24.1% |
| Remove all squares | 16 | Draw | 8.5% |
| Remove all crowns | 16 | Draw | 61.2% |
| Remove all axial lines | 16 | Draw | 67.5% |
| Remove all diagonal lines | 12 | Draw | 82.3% |
| Keep squares alone | 4 | Draw | 95.7% |
| Keep crowns alone | 4 | Draw | 94.9% |
| Keep axial lines alone | 4 | Draw | 94.6% |
| Keep diagonal lines alone | 8 | Draw | 89.8% |

All six two-family combinations also draw. Together with the four single-family
and four three-family cases, that exhausts the 14 proper nonempty subsets.
This conclusion was obtained by solving every subset, not by assuming that
removing targets has a monotone effect.

The no-squares result is especially informative. Its opening draws, but **91.5%
of its reachable symmetry classes are decisive**, compared with 75.9% in the
original. It could be an attractive competitive game with a balanced theoretical
opening and sharp mistakes. That is a design hypothesis for playtesting, not a
prediction of match results. Uniform counts of reachable positions do not tell
us how often people visit them or how easily they find the safe moves.

Thus “fewer shapes means trivial” is not supported. Single-family games have
very large drawing regions and may feel less tactically active; proving that
their defense is *easy* would require a comprehensible defensive strategy or
player evidence. “Drawn” and “trivial” are different properties.

**Removing particular formations.**

Squares on a ring come in two orientations: the even points {0,2,4,6} and the
odd points {1,3,5,7}. These indices use the repository's I/O labels.

| Change from the original | Targets left | Opening |
|---|---:|---|
| Remove the even outer square | 19 | First wins in 45 |
| Remove the odd outer square | 19 | Draw |
| Remove both outer squares | 18 | First wins in 39 |
| Remove either individual inner square | 19 | Draw |
| Remove both inner squares | 18 | Draw |
| Remove either alternating pair of axial lines | 18 | Draw |
| Remove either alternating group of four diagonals | 16 | Draw |

The 18-target version keeps **the two inner squares, four crowns, and all twelve
lines**. It needs fewer targets and still has a substantial forced line. Both
inward opening directions win in 39 plies; either outward direction loses in
40. On the chosen line, the winner has a unique winning move on **3 of 20
turns**, and the mean fraction of win-preserving choices is **50.7%**.

This is also a concrete counterexample to monotonic reasoning: removing the odd
outer square produces a draw, while removing the remaining outer square as
well restores a forced win. Both players gain or lose targets. Their threats,
defensive obligations, and available timing choices change together.

The original is therefore **minimal by whole families, not by individual
formations**. These experiments do not establish the smallest possible winning
subset of its 20 targets: arbitrary individual crown or diagonal removals can
break the symmetry used here and were not exhaustively searched.

**Adding and replacing targets.**

All indices below are modulo eight. An arc means four consecutive points around
one ring. Two opposite pairs means {R(i),R(i+4),T(j),T(j+4)}, with R and T either
ring and with four distinct points.

| Change from the original | Total targets | Opening |
|---|---:|---|
| Add the other four crown orientations | 24 | First wins in 45 |
| Add adjacent radial pairs: {I(i),I(i+1),O(i),O(i+1)} | 28 | First wins in 87 |
| Add inner-ring arcs | 28 | First wins in 19 |
| Add outer-ring arcs | 28 | Draw |
| Add arcs on both rings | 36 | First wins in 19 |
| Add any two opposite pairs | 40 | First wins in 15 |
| Replace all targets with two opposite pairs | 28 | Draw |
| Replace all targets with adjacent radial pairs | 8 | Draw |
| Replace all targets with any four points on one ring | 140 | First wins in 7 |
| Use the 2024 targets with family movement | 28 | Draw |
| Rotate the original four crowns by 45° | 20 | First wins in 89 |

The **eight-crown version** is a particularly clean rule extension. The original
four crowns favor alternating permanent points: each even-indexed point belongs
to four winning targets and each odd-indexed point to six. Completing the crown
family gives every permanent point six targets. It also restores the
opening-preserving reflections and makes both inward openings equivalent wins
in 45 plies. On the chosen line, there are **5 unique winning choices in 23
winner turns**; the mean proportion of win-preserving moves is **38.0%**.

I also solved all seven smaller combinations that retain the eight-crown family
with some subset of squares and lines. All draw. Merely completing crown
symmetry does not make those simpler combinations winning.

Adding adjacent radial pairs barely shortens the original, from 89 to 87
plies, while adding another recognition rule. It is a possible expansion but
has little demonstrated advantage under a simplicity criterion.

Inner arcs offer a much shorter tactical game. Outer arcs instead supply enough
new possibilities to eliminate the forced opening win. The contrast is strong
evidence that target placement and mobility matter more than target count.
The “any four on one ring” replacement is the clearest triviality calibration:
seven plies is the earliest possible first-player formation, because four
different stones must leave their starts. A very short verbal rule can still
encode many targets and collapse strategic depth.

Rotating the four crowns is a control experiment. An opening-preserving
reflection maps the old rules to the rotated rules, so the two games are
isomorphic. As expected, their result and distance agree; S0 → I7 becomes the
winning inward direction. They are the same design in different orientations.

**Changing movement and timing.**

These experiments keep all 20 family targets unless otherwise stated.

| Rule change | Opening | Interpretation |
|---|---|---|
| Deploy all your stones before moving any of them again | First wins in 83 | Much of the long forced play survives a clearer opening phase. |
| Inner-ring movement only to adjacent inner points | Draw | The complete inner movement graph matters. |
| Remove I(i) ↔ O(i), retaining diagonal ring connections | Draw | Direct radial moves also matter. |
| Add moves between neighboring outer points | Draw | Extra mobility can improve defense. |
| Permit a pass on any turn | Draw | Compulsory movement matters to the forced win. |
| Use the full 2024 movement graph with family targets | Draw | Changing movement alone is enough to change the result. |
| Full 2024 movement and targets | Draw | Agrees with the previous legacy result. |

Compulsory deployment reduces reachable canonical positions from 5,527,111 to
**466,757**, while retaining an 83-ply forced win. Its rule is: on your turn,
if any of your stones remain on start points, move one of those stones. It
does not require alternating a separate placement action or adding new state.
Both inward openings win, in 83 and 85 plies respectively; one outward opening
draws and the other loses. This is my strongest alternative if retaining a
very long solution is the priority.

Passing removes the forced win, which supports the importance of having to
move. It does not by itself identify a particular zugzwang or prove a short
human explanation of the original strategy.

Two further consequences follow from the existing exact solution without
another graph solve:

- **A total game cap below 89 plies makes the original opening a draw**, provided
  reaching the cap means a draw. The defender can prevent a win before ply 89;
  White can still avoid losing. At a cap of 89 or more, White wins if a completed
  formation takes precedence over the cap. This concerns a total-ply cap, not
  a counter that resets after deployment.
- **A pie rule makes the original opening a draw.** After the first move, the
  second person chooses a color; Black still takes the next board move. A
  decisive opening lets the chooser take the winning color, so the first
  person selects the available drawing inward opening. This deduction does
  not generalize automatically: in the eight-crown and 18-target variants,
  every opening is decisive, so this pie rule would give the second person a
  forced win instead of producing a draw.

**Which versions look more elegant?**

There is no single measured optimum. I would compare these prototypes:

| Priority | Candidate | Why it deserves a playtest |
|---|---|---|
| A long, exacting conversion puzzle | Original, 89 plies | Every family matters; the winning route is narrow. It has the longest forced opening win among these tested designs. |
| A clearer opening phase with almost the same length | Compulsory deployment, 83 plies | One simple timing rule removes most reachable deployment states while preserving long play. |
| Uniform target recognition | All eight crowns, 45 plies | No special crown orientation restriction; both inward openings work. |
| Fewer targets with substantial tactics | Inner squares only, 39 plies | Two targets removed; both inward openings work; more winning options along the measured line. |
| Competitive balance with potentially sharp mistakes | No squares, drawn opening | A drawn root coexists with a largely decisive position space. |
| A short tactical variant | Add inner arcs, 19 plies | A readily stated new target and a much shorter optimal game. |

My design judgment is that **the original is an impressive interdependent
formation puzzle**, while the **18-target and eight-crown versions are strong
candidates for more approachable games**. Compulsory deployment deserves its
own comparison if the long solution is part of the appeal. None is established
as better for human play by the solver.

I would judge elegance by rule economy, visual recognition, meaningful strategic
choices, learnable plans, the value of defense, and whether players can explain
why a move helped. Optimal length is one useful axis. Maximizing it alone can
reward opaque maneuvering; minimizing it can erase the game. Likewise, a forced
first-player win can be desirable for a difficult conversion puzzle, while a
drawn opening can be desirable for repeated competition.

A small playtest should measure how long players take to learn the targets,
whether they can explain threats before seeing the engine move, how frequently
games repeat, which mistakes decide games, and whether games remain interesting
after the opening is known. Compare players in both colors. Do not substitute
uniform state percentages or one principal variation for those observations.

The analysis also identified a **visual improvement without changing any rules**.
The previous browser coordinates in [octagon-game.js](web/octagon-game.js#L812)
put inner cardinal points at radius 230 and outer ones at radius 455. For the
regular octagonal diagram, diagonal targets become exactly collinear when
the inner/outer radius ratio is **√2 − 1 ≈ 0.4142**. This follows by equating
the chord's distance from the center: R cos(3π/8) = r cos(π/8).
The previous representative diagonal's inner points lay approximately 38–39
SVG units off its outer-endpoint line in the 1000-unit viewBox. Calling that
target a line is less intuitive than showing it straight. The explorer uses
the collinear geometry. The browser board now derives its inner points from
diagonal intersections. The corrected lines meet the existing rounded outer
coordinates exactly. The game rules and tablebase remain unchanged.

**Method, checks, and limits.**

[sensitivity_solver.cpp](analysis/sensitivity_solver.cpp) independently builds
all 11,099,709 legal four-stone placements. With turn and the four valid
quarter-turn rotations, this is a closed universe of 5,550,578 canonical states.
For each movement rule it builds the graph **without stopping at formations**.
Each experiment then marks its own terminals, runs retrograde attractor
analysis, and recomputes reachability from the opening with immediate wins.
This includes positions beyond former winning formations when a target is
removed; simply filtering the shipped tablebase would be incorrect.

Wins are states with a losing successor; losses have only winning successors;
remaining states draw. Processing terminal attractors in increasing distance
also computes shortest wins and longest resistance. Every reachable nonterminal
state is checked against the forward W/D/L and distance equations. Every
experiment validates its target symmetries. No experiment had a reachable
simultaneous win. Infinite play and non-winning stalemate are draws.

The original reproduces **all recorded aggregate counts**, including 84,458,408
distinct-successor edges, 18,220 terminal states, and maximum decisive distance
108. [verify.mjs](analysis/verify.mjs) also checks 2,048 sampled reachable states
against the separately implemented shipped tablebase, checks the translated
family and legacy targets, and legally replays all **537 PV moves across the
50 experiments** using separately expressed movement rules. The legacy
experiment uses four rotations here, whereas the older solver also uses
reflections; their canonical state counts therefore should not be equated.

From a fresh game, a winning strategy strictly decreases distance on every
ply, including arbitrary defensive replies. It cannot repeat a position, so
ordinary threefold repetition does not change these opening results. Arbitrary
existing histories or a no-progress clock are different state spaces and are
not solved here.

Drawing percentages count reachable canonical states, including terminals, with
one entry per quarter-turn orbit. They are descriptive position-space measures;
they are not weighted by play frequency, and each variant has a different
reachable set. The single PV uses lexicographic move tie-breaking. This is a
bounded set of design experiments, not an exhaustive search of all possible
winning patterns, rule changes, or human notions of elegance.

Reproduce from the repository root with dependency-free C++17, Python 3, and Node:

```sh
python3 analysis/run_experiments.py --jobs 3 --force
node analysis/verify.mjs analysis/*.jsonl
python3 analysis/build_report.py
```

Without `--force`, the runner keeps complete existing result files. Allow about
0.7 GB RAM per concurrent worker. An individual experiment can be rerun with:

```sh
g++ -O3 -std=c++17 analysis/sensitivity_solver.cpp -o /tmp/octagon_sensitivity
/tmp/octagon_sensitivity proper drop-outer-squares
/tmp/octagon_sensitivity proper add-four-crowns
/tmp/octagon_sensitivity deploy original
```

The game rules and its shipped Perfect tablebase remain unchanged. The browser
geometry correction is a subsequent presentation change.
