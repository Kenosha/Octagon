# Reproducing the README media

The GIFs are deterministic renders of the shipped Perfect engines playing the
Family board. Every board position and every move comes from the production
rules and tablebase. The renderer adds labels, move interpolation, a distance
counter, and commentary. It does not implement a separate game engine.

The complete GIF runs for about 50 seconds. The second shows plies 79–89 at a
slower pace, beginning from the position after ply 78. Both pause on the final
winning formation. The [move list](perfect-game.md) and still boards give a
non-animated way to follow the game.

From the repository root, with Node, Python 3, Pillow, and the DejaVu Sans / Sans
Mono fonts installed:

```sh
python3 scripts/render-readme.py
```

To install Pillow in an isolated environment if needed:

```sh
python3 -m venv /tmp/octagon-readme-env
/tmp/octagon-readme-env/bin/python -m pip install Pillow
/tmp/octagon-readme-env/bin/python scripts/render-readme.py
```

On a system without discoverable DejaVu fonts, supply their directory with
`--font-dir /path/to/dejavu`. It must contain `DejaVuSans.ttf`,
`DejaVuSans-Bold.ttf`, and `DejaVuSansMono.ttf`.

The script regenerates:

- `docs/media/perfect-play.gif` — all 89 plies, including the opening position.
- `docs/media/perfect-finish.gif` — the final eleven plies.
- `docs/media/opening.png` and `docs/media/finish.png` — labelled still boards.
- `docs/media/formations.png` — one example of each winning family.
- `docs/perfect-game.md` — the complete move list.
- `docs/perfect-game.json` — all 90 states, move-choice counts, and source metadata.

To export and verify the game without any rendering dependencies:

```sh
node scripts/export-perfect-game.mjs > /tmp/octagon-perfect-game.json
```

The exporter uses separate Perfect adapters for Red and Blue. It checks that
every move is legal, the exact distance drops by one each ply, no position
repeats, and Red wins on ply 89 with `I1, I5, O1, O5`. It also verifies the ten
Red turns with a unique win-preserving move. Equal optimal moves are resolved
by source index and then destination index, matching the browser engine.

The JSON records the tablebase's SHA-256 hash. Geometry follows the Family board
in `web/octagon-game.js`; adjacency and formations are exported directly from
`web/rulesets.mjs`. If those rules or the engine's tie-breaking policy change,
review the transcript and captions when regenerating the images.
