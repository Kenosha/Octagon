"""Build the portable HTML explorer and CSV/JSON summaries from exact results."""
import csv
import json
from pathlib import Path
import statistics

HERE = Path(__file__).resolve().parent
FILES = ["baseline", "removals", "additions", "symmetric-subsets", "fine-removals",
         "local-inner", "no-radial", "outer-ring", "deploy", "pass", "legacy"]
FAMILIES = {"K": "squares", "C": "crowns", "S": "axes", "D": "diagonals"}
LABELS = {
    "original": "Original family game",
    "add-four-crowns": "Add the other four crowns",
    "add-boxes": "Add adjacent radial pairs",
    "add-inner-arcs": "Add four consecutive inner points",
    "add-outer-arcs": "Add four consecutive outer points",
    "add-both-arcs": "Add four consecutive points on either ring",
    "add-opposite-pairs": "Add any two opposite pairs",
    "only-opposite-pairs": "Only two opposite pairs",
    "rotate-crowns": "Rotate the four crowns by 45°",
    "only-boxes": "Only adjacent radial pairs",
    "only-same-ring": "Any four points on one ring",
    "legacy-targets": "2024 targets with family movement",
}
MOVEMENTS = {
    "local-inner": ("Inner moves only to neighbors", "Inner-ring moves are restricted to I(i−1) and I(i+1); all other family moves remain available."),
    "no-radial": ("Remove direct radial moves", "Remove I(i)↔O(i); keep the diagonal ring connections and unrestricted inner moves."),
    "outer-ring": ("Allow outer-ring neighbor moves", "Add O(i)↔O(i±1); retain all original moves."),
    "deploy": ("Deploy all your stones before moving them again", "While a player has any stones on their start points, that player must move a start stone."),
    "pass": ("Allow passing on any turn", "A player may pass instead of moving; infinite play is a draw."),
    "legacy": ("2024 movement with family targets", "Use the sparse 2024 movement graph; keep the 20 family targets."),
}


def describe(row):
    key, mode = row["id"], row["movement"]
    if mode != "proper":
        if mode == "legacy" and key == "legacy-targets":
            return "Full 2024 game", "The old movement graph and its old 28 targets.", "Movement"
        label, description = MOVEMENTS[mode]
        return label, description, "Movement"
    if key.startswith("symmetric-only-"):
        names = [FAMILIES[x] for x in key.removeprefix("symmetric-only-")]
        return "Only " + " + ".join(names) + " (8 crowns)", "Use all eight crown orientations and only the named other families.", "Symmetric subsets"
    if key.startswith("drop-"):
        return "Remove " + key.removeprefix("drop-").replace("-", " "), "Remove only these targets from the original 20. Even and odd refer to the zero-based ring indices.", "Fine removals"
    if key.startswith("only-") and key not in LABELS:
        names = [FAMILIES[x] for x in key.removeprefix("only-")]
        return "Only " + " + ".join(names), "Keep exactly these original target families, with the original movement rules.", "Family removals"
    descriptions = {
        "original": "The photographed family rules as encoded in the repository: four squares, four crowns, four axes, and eight diagonals.",
        "add-four-crowns": "Recognize the crown in all eight orientations instead of four. Each permanent point then belongs to six winning targets.",
        "add-boxes": "Add {I(i), I(i+1), O(i), O(i+1)} for all eight i: a pair of neighboring points on each ring.",
        "add-inner-arcs": "Add four consecutive points around the inner ring, in all eight orientations.",
        "add-outer-arcs": "Add four consecutive points around the outer ring, in all eight orientations.",
        "add-both-arcs": "Add four consecutive points on either ring, in every orientation.",
        "add-opposite-pairs": "Add any two diametrically opposite pairs. This adds 20 new targets because eight already exist.",
        "only-opposite-pairs": "Win when your four stones consist of any two diametrically opposite pairs: 28 targets in total.",
        "rotate-crowns": "Replace the four crowns by the other four orientations. This is an isomorphic game: the winning opening direction is reversed.",
        "only-boxes": "Win only with two neighboring points on each ring at matching indices: eight targets.",
        "only-same-ring": "Any four of the eight points on one ring count. There are 140 targets; the first player can win as soon as their fourth stone deploys.",
        "legacy-targets": "Keep family movement but use the 2024 set of 28 winning formations.",
    }
    return LABELS[key], descriptions[key], "Original" if key == "original" else "Other targets"


rows = []
for name in FILES:
    for line in (HERE / f"{name}.jsonl").read_text().splitlines():
        row = json.loads(line)
        row.pop("auditSamples", None)
        row["label"], row["description"], row["group"] = describe(row)
        winner = 0 if row["outcome"] == "win" else 1
        steps = [s for s in row["pv"] if s["side"] == winner]
        row["winnerTurns"] = len(steps)
        row["uniqueWinningChoices"] = sum(s["winMoves"] == 1 for s in steps)
        row["winningChoiceFraction"] = statistics.mean(
            s["winMoves"] / (s["winMoves"] + s["drawMoves"] + s["lossMoves"])
            for s in steps) if steps else None
        row["drawPercent"] = 100 * row["draws"] / row["states"]
        row["patternCount"] = len(row["patterns"])
        row["key"] = row["movement"] + "/" + row["id"]
        rows.append(row)
assert len({r["key"] for r in rows}) == len(rows)
(HERE / "results.json").write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n")
fields = ["key", "label", "patternCount", "outcome", "distance", "states", "edges",
          "wins", "losses", "draws", "drawPercent", "terminals", "stalemates",
          "maximumDistance", "winnerTurns", "uniqueWinningChoices", "winningChoiceFraction"]
with (HERE / "results.csv").open("w", newline="") as output:
    writer = csv.DictWriter(output, fieldnames=fields, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(rows)
template = (HERE / "explorer.template.html").read_text()
payload = json.dumps(rows, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")
(HERE / "explorer.html").write_text(template.replace("__EXPERIMENT_DATA__", payload))
print(f"Built explorer.html, results.json, and results.csv for {len(rows)} exact experiments.")
