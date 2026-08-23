# Octagon: rules reconstruction and theoretical analysis

This report covers two deliberately separate rulesets built on the same audited
24-position state representation:

- `proper`: the family board reconstructed from `octagon_proper_layout.jpg` and
  the repository's earlier dense movement topology;
- `legacy`: the simplified 2024 rules encoded in `octagon.py` and preserved as
  a switchable compatibility mode.

## Family-board result (`proper`)

Under the convention that a win must be forced in finite time and infinite
play/repetition is a draw, the photographed family-board opening is a **forced
win for the first player**.

The exact symmetry-reduced result is:

```text
reachable canonical states: 5,527,111
canonical distinct-successor edges: 84,458,408
wins-to-move: 3,181,193
losses-to-move: 1,016,545
draws: 1,329,373
reachable terminal-win states: 18,220
reachable simultaneous-win states: 0
reachable stalemates: 0
initial result: FIRST PLAYER WIN
```

The four opening move orbits are not equivalent strategically. Using the
0-based state indices (`S=0..7`, `I=8..15`, `O=16..23`):

```text
S0-I0 (0-8): forced first-player win
S0-I7 (0-15): draw
S0-O0 (0-16): forced second-player win
S0-O7 (0-23): forced second-player win
```

Quarter-turn rotations give the corresponding moves for the other first-player
start stones. Thus the verified winning opening orbit is `S_i -> I_i` for even
`i`. The browser's Perfect tier uses the complete result. Hard deliberately
does not consult the solution: it uses full-width search and a handcrafted
position evaluation, keeping the two levels meaningfully distinct.

With depth-to-win tie-breaking, the first player can force victory in **89
plies**—their 45th move—while the second player cannot delay it any longer.
Here the winning player minimizes the remaining plies and the losing player
maximizes them. A depth-optimal line begins `W S0-I0, B S3-I2, W S2-I1,
B S7-I6` and ultimately ends with `W I4-O5`, completing the straight line
`{I1,I5,O1,O5}`. The solver prints the complete 89-ply principal variation.
Across every decisive reachable position, the maximum depth is 108 plies, so
the browser tablebase can encode outcome and distance in a single byte.

### Family-board reconstruction

The photograph and the original 2022 move constants agree on this movement
graph:

```text
S_i -> I_(i-1), I_i, O_(i-1), O_i
I_i -> every other inner point, O_(i-1), O_i, O_(i+1)
O_i -> I_(i-1), I_i, I_(i+1)
```

There are 20 photographed winning positions:

- 4 **Karo**: alternating points on either the inner or outer ring—two small
  and two large squares, as explicitly confirmed by the family rule;
- 4 **crowns**: `I_(c-1), I_(c+1), O_(c-1), O_(c+1)` for cardinal centers
  `c in {0,2,4,6}`;
- 4 **straight lines**: `I_i, I_(i+4), O_i, O_(i+4)` for `i=0..3`;
- 8 **diagonal lines**: `I_(i+1), I_(i+2), O_i, O_(i+3)` for `i=0..7`.

The four-crown family has quarter-turn rather than full octagonal-reflection
symmetry. The exact solver therefore quotients the proper game by only the four
opening-preserving rotations. Using the larger legacy symmetry group here would
merge positions with different win status and produce an invalid result.

## 2024 legacy result (`legacy`)

Under the usual reachability-game convention—one wins by completing a formation,
and infinite play/repetition is a draw—the initial position is a **draw with best
play**. The same result holds whether a non-winning player with no legal move is
declared to lose or draw.

Consequences:

- The first player cannot force a win.
- The second player cannot force a win.
- Either player can force at least a draw from the opening.
- All 16 legal first moves are optimal in win/draw/loss terms. Under the opening's
  symmetries they form two classes—move to the inner ring and move to the outer
  ring—and both classes lead to a draw.
- A strongest engine should promise “does not lose from the initial position,”
  not “forces a win.” It should exploit a move from a drawn state into a losing
  state when the opponent makes a mistake.

This is an exact result for the implemented rules, not a closed-form mathematical
solution of every plausible version of Octagon.

## Encoded rules

There are 24 indexed locations:

- `S0..S7` = indices `0..7`, the initially occupied start points;
- `I0..I7` = indices `8..15`, the inner points;
- `O0..O7` = indices `16..23`, the outer points.

White starts on `S0,S2,S4,S6`, Black on `S1,S3,S5,S7`, and White moves first.
Each player has four indistinguishable pieces. There are no captures. A move
relocates one own piece to an unoccupied destination:

```text
S_i -> I_(i-1), I_i, O_(i-1), O_i
I_i -> I_(i-1), I_(i+1), O_(i-1), O_(i+1)
O_i -> I_(i-1), I_(i+1)
```

Subscripts are modulo 8. No move has an `S` destination, so deployment is
irreversible. The implementation checks only whether the destination is occupied;
an occupied start point lying visually between two permanent points does not block
a move.

A player wins immediately when all four of their pieces cover one of 28 patterns
on the inner/outer points:

- 4 squares: all even or all odd positions on either ring;
- 8 angles: `{I_i, I_(i+2), O_i, O_(i+2)}`;
- 8 crowns: `{I_i, I_(i+1), O_i, O_(i+1)}`;
- 8 lines: `{I_(i+1), I_(i+2), O_i, O_(i+3)}`.

The last family really is collinear in the rendered geometry. Start points never
count toward a win.

## Structural analysis

The game has a finite set of board states but can have infinite plays. Let
`(s_w,s_b)` be the numbers of White and Black pieces still on start points. A move
either leaves this pair unchanged or decreases the mover's component by one.
Therefore:

- deployment gives the state graph a partial order between 25 deployment phases;
- all directed cycles and strongly connected components lie inside one phase;
- after at least one piece is deployed, a player may shuffle that piece forever
  without deploying the remainder, if the opponent permits it.

A concrete legal repetition is:

```text
White S0-I0, Black S1-I1,
White I0-O7, Black I1-O2,
White O7-I0, Black O2-I1.
```

The last four plies can repeat indefinitely. Thus the current code cannot rely on
the game naturally terminating.

Ignoring occupancy between the two players, each player's possible four-piece set
is a 4-subset of its four allowed start points plus the 16 permanent points:
`C(20,4) = 4,845`. Accounting for non-overlap gives 11,099,709 legal piece
placements, or 22,199,418 placements-with-turn before reachability and terminal
constraints.

The full board has octagonal dihedral symmetry. The colored initial position and
side to move are stabilized by eight spatial symmetries. Reflections require a
one-index offset between the start ring and the two permanent rings, a detail that
matters in software. Color-swapping symmetries do not stabilize the initial side
to move and therefore cannot safely be used to quotient a forward search from the
opening.

Symmetry by itself did not yield a valid copycat proof. Odd rotations exchange the
two starting colors but are not involutive reply pairings, while color-exchanging
reflections have fixed permanent points; in either case the nominal mirrored
destination can be occupied. The monotone deployment phases and formation
hypergraph materially reduce and explain the game, but I found no honest
position-local invariant that chooses a unique optimal move or proves the opening
outcome without graph analysis. Since both opening move orbits draw, there is in
fact no unique W/D/L-optimal first move to derive.

## Exact computation

`theory_solver.cpp` is an isolated dependency-free verifier, not production engine
code. It translates either audited ruleset into 24-bit bitboards, enumerates all
states reachable from the opening, applies only symmetries valid for that ruleset,
and solves the finite directed graph by retrograde attractor analysis. It then
computes exact depth-to-win values throughout the decisive region:

- a state is a win-to-move if it has a loss-to-move successor;
- it is a loss-to-move if every successor is a win-to-move;
- all remaining states are draws, representing positions from which neither side
  can force finite victory.
- at wins, depth is one plus the shortest losing-child depth; at losses, it is
  one plus the longest winning-child depth.

Run it with:

```bash
g++ -O3 -std=c++17 theory_solver.cpp -o /tmp/octagon_theory_solver
/tmp/octagon_theory_solver proper stalemate-draw
/tmp/octagon_theory_solver legacy stalemate-draw
/tmp/octagon_theory_solver proper stalemate-draw export-tablebase=web/perfect-tablebase.bin
```

The exported Family-board table is 8,321,487 bytes. It combines a succinct
reachable-position bit index with one byte of W/D/L-plus-distance data for each
of the 5,527,111 canonical states. The browser derives an optimal move by
looking up every legal successor, avoiding a separate stored policy.

For the legacy rules with stalemate scored as a draw:

```text
reachable canonical states: 2,760,165
canonical distinct-successor edges: 23,113,182
wins-to-move: 1,157,006
losses-to-move: 321,022
draws: 1,282,137
reachable canonical terminal-win states: 12,784
reachable canonical simultaneous-win states: 0
reachable canonical stalemates: 6
initial result: DRAW
```

With stalemate scored as a loss, the counts become 1,157,016 wins, 321,028
losses, and 1,282,121 draws. The initial result and both initial move classes are
still draws.

The solver is a proof by exhaustive finite-state retrograde analysis for the stated
rules. Its use of monotone phases, bitboards, exact graph reachability, and symmetry
is different from expanding a naive game tree: transpositions and cycles are
represented once and infinite evasion is classified explicitly. Nevertheless,
the result remains computational evidence tied to this executable translation,
not a short human theorem.

## Stalemate regression

This shortest 16-ply legal sequence reaches a non-winning position in which White
has no legal move (indices use the Python array convention):

```text
W 0-8, B 1-9, W 6-14, B 9-10,
W 4-11, B 10-9, W 14-15, B 3-10,
W 15-16, B 5-12, W 8-17, B 9-8,
W 2-9, B 7-15, W 11-18, B 12-11.
```

Final state:

```text
White = {9,16,17,18}
Black = {8,10,11,15}
turn = White
winner = none
legal moves = 0
```

The recommended rule is **stalemate is a draw**. Octagon is a formation race, the
existing code does not state that immobilization wins, and changing this choice
does not change the theoretical opening outcome.

## Rule ambiguities to resolve with the family

1. Is repetition a draw? A practical proposal is threefold repetition.
2. Should there also be a no-progress or maximum-ply draw (for example, no new
   deployment and no win for a fixed number of plies)?
3. Is stalemate a draw, a loss for the immobilized player, or a forced pass?
4. May a deployed piece move while its owner's other pieces remain on start
   points? The code says yes, enabling deliberate non-deployment and cycles.
5. Are start points permanently unavailable after deployment, and may later moves
   pass across occupied start pieces? The code says yes to both.
6. Is immediate stop on completing a pattern intended? The code assumes it, so a
   later simultaneous-win position is never reached through legal continued play.

Changing items 3–5 changes the state graph and requires a new solution.

## Existing correctness issues

- `Board.check_win()` and newly constructed successors encode wins as integers
  (`1`/`-1`), while `Board.set_move()` changes them to strings (`"w"`/`"b"`).
  `Board.__repr__()` expects integers. This also makes
  `testing_engine.check_move()` fail to recognize an immediate winning successor,
  because it compares an integer to the string in `turn`.
- `get_moves()` calls `np.vstack([])` in a stalemate, raising instead of returning
  an empty move list. Terminal states return a Python list while ordinary states
  return an array.
- There is no repetition/history, draw outcome, pass rule, or ply limit. Existing
  play loops can continue forever.
- `Board.copy()` shares the underlying arrays and drops custom player names.
- State construction does not validate shape, four-piece counts, disjointness,
  turn value, or reachability.
- A simultaneous win prints to standard output and stores magic value `999`
  instead of returning a typed invalid-state/outcome result.
- UI/engine helpers assume at least one successor and can fail on stalemate or on
  selecting a piece with no legal destination.

These should be fixed in one authoritative rules core before relying on any search
result in the browser.

## AI-engine contract

Use immutable state and stable move/outcome types. A minimal interface is:

```text
State { whiteBits, blackBits, turn, reversiblePlyCount? }
Move { from, to }
legalMoves(state) -> Move[]
applyMove(state, move) -> State
staticOutcome(state) -> ongoing | whiteWin | blackWin | stalemate
historyOutcome(state, repetitionTable) -> ongoing | drawRepetition | drawLimit
chooseMove(state, history, difficulty, timeBudget) -> Move
```

The hardest policy must be cycle-aware. Store W/D/L relative to the player to
move:

- in a winning state, choose a losing successor (prefer shortest forced win);
- in a drawn state, choose a drawn successor, unless the opponent has just allowed
  a transition to a win;
- in a losing state, maximize distance to loss and practical chances.

Suggested difficulty levels:

1. random legal move, but take an immediate win;
2. formation heuristic plus immediate-win and one-ply threat defense;
3. depth-limited negamax/alpha-beta with a transposition table and repetition
   detection;
4. exact W/D/L tablebase or an exact non-losing policy, with heuristic tie-breaking
   among equally drawn moves.

A browser tablebase needs deliberate compression. For legacy, the raw canonical
W/D/L payload is only about 0.7 MiB at two bits per state, and one policy byte per
state about 2.8 MiB; the proper ruleset roughly doubles those state-index payloads.
Mapping arbitrary bitboards to dense state IDs can dominate size.
Options are a compressed perfect hash/ranking scheme, a smaller verified opening
book plus cycle-aware search, or server-side lookup. Keep the production rule
functions identical to the tablebase generator and verify them against shared
move/outcome fixtures, including all 28 legacy wins, all 20 proper wins, and the
legacy stalemate above.
