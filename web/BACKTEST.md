# Perfect-reference backtest

This is a deliberately small smoke benchmark, not a statistical rating study.
The three-game tables below record the earlier 900 ms selective-search build;
they are retained because they are the source of the reported Hard draw.
Each tier played three seeded games as the second player against Perfect on the
Family board. Perfect minimizes win distance; the tested player follows its
normal policy. Results are counted in moves made by the tested player.

| Tier | Survival moves | Mean | Outcome |
|---|---:|---:|---|
| Easy | 5, 6, 5 | 5.3 | three losses |
| Medium | 14, 14, 14 | 14.0 | three losses |
| Hard | 14, 14, 14 | 14.0 | three losses |
| Perfect resistance | 44 | 44.0 | forced loss on ply 89 |

Medium completed an average depth of 3.3; Hard completed 4.9–5.0. Against the
single fastest-win Perfect policy, the extra selective depth did not extend
the loss, although it materially changed the chosen line.

The same three seeds were also checked with the tested tier moving first. This
tests whether it can preserve the Family board's theoretical first-player win:

| Tier as first player | Own moves before loss | Mean | Converted the win |
|---|---:|---:|---|
| Easy | 6, 7, 7 | 6.7 | 0/3 |
| Medium | 12, 9, 9 | 10.0 | 0/3 |
| Hard | draw after 18, loss after 11, loss after 11 | — | one draw, no wins |
| Perfect | 45 | 45.0 | yes |

These results confirm that the search tiers remain honestly distinct from
Perfect. Hard does not consult tablebase values; in one first-player game its
deeper search preserved a draw, but it still failed to convert the theoretical
win in all three seeds.

## Two-second full-width follow-up

Hard now has a 2,000 ms / 2,000,000-node budget and searches every legal branch
rather than retaining only six internal moves. A seed-0 smoke replay produced:

| Tested side | Result | Own moves | Mean completed depth |
|---|---|---:|---:|
| Hard second player | loss | 10 | 4.4 |
| Hard first player | loss | 21 | 4.7 |

The older first-player draw was genuine: Hard departed the theoretical win into
a drawn state and Perfect preserved that draw until threefold repetition. It
was not a save from the theoretically losing second-player side. The changed
budget and search width choose a different deterministic line, so that one
historical draw is not expected to reproduce in the current build.

Survival length is also not Hard's evaluation target. In every second-player
opening position the exact result is already a loss; unlike Perfect, Hard has
no depth-to-result value telling it which losing move delays mate longest.

Reproduce the second-player batch from the repository root with:

```sh
node web/backtest.mjs 3 blue
```

Use `red` as the third argument for the first-player conversion check.
