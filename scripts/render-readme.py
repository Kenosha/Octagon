"""Generate README diagrams and GIFs from a verified Perfect-versus-Perfect game.

Requires Node, Pillow, and the DejaVu Sans / Sans Mono fonts. No game rules are
implemented here: states, moves, formations, and adjacency come from the engine.
"""
import argparse
import json
import math
from pathlib import Path
import subprocess

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SCALE = 2
WIDTH, HEIGHT = 960, 660
BG = "#0b1311"
INK = "#f1f0e4"
MUTED = "#9dafaa"
MINT = "#63c8ac"
GRID = "#285447"
RED = "#f46560"
BLUE = "#48b6ed"
GOLD = "#f3cf7a"

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--font-dir", type=Path, help="Directory containing the DejaVu .ttf files")
args = parser.parse_args()


def font(size, kind="regular"):
    name = {"regular": "DejaVuSans.ttf", "bold": "DejaVuSans-Bold.ttf", "mono": "DejaVuSansMono.ttf"}[kind]
    return ImageFont.truetype(str(args.font_dir / name) if args.font_dir else name, size * SCALE)


FONTS = {(size, kind): font(size, kind) for size, kind in [
    (12, "regular"), (13, "regular"), (14, "regular"), (15, "regular"),
    (17, "regular"), (18, "regular"), (20, "bold"), (22, "bold"),
    (34, "bold"), (64, "bold"), (14, "mono"), (16, "mono"),
]}


def intersection(a, b, c, d):
    det_a, det_b = a[0] * b[1] - a[1] * b[0], c[0] * d[1] - c[1] * d[0]
    denominator = (a[0] - b[0]) * (c[1] - d[1]) - (a[1] - b[1]) * (c[0] - d[0])
    return ((det_a * (c[0] - d[0]) - (a[0] - b[0]) * det_b) / denominator,
            (det_a * (c[1] - d[1]) - (a[1] - b[1]) * det_b) / denominator)


# Match the Family board's geometry in web/octagon-game.js. Inner points lie on
# the long diagonal lines; starts are the crossings between the two rings.
outer = [(500, 45), (822, 178), (955, 500), (822, 822),
         (500, 955), (178, 822), (45, 500), (178, 178)]
inner = [intersection(outer[(i + 6) % 8], outer[(i + 1) % 8],
                      outer[(i + 7) % 8], outer[(i + 2) % 8]) for i in range(8)]
starts = [intersection(outer[(i - 1) % 8], inner[i], outer[i], inner[(i - 1) % 8]) for i in range(8)]
POINTS = starts + inner + outer


def label(position):
    return f"{('S', 'I', 'O')[position // 8]}{position % 8}"


class Canvas:
    def __init__(self, width=WIDTH, height=HEIGHT):
        self.image = Image.new("RGB", (width * SCALE, height * SCALE), BG)
        self.draw = ImageDraw.Draw(self.image)

    def text(self, xy, text, size=17, fill=INK, kind="regular", anchor="la"):
        self.draw.text(tuple(v * SCALE for v in xy), text, font=FONTS[size, kind], fill=fill, anchor=anchor)

    def line(self, points, fill=GRID, width=1):
        self.draw.line([(x * SCALE, y * SCALE) for x, y in points], fill=fill, width=max(1, round(width * SCALE)))

    def circle(self, xy, radius, fill=None, outline=None, width=1):
        x, y = xy
        self.draw.ellipse(tuple(v * SCALE for v in (x - radius, y - radius, x + radius, y + radius)),
                          fill=fill, outline=outline, width=round(width * SCALE))

    def finish(self):
        return self.image.resize((self.image.width // SCALE, self.image.height // SCALE), Image.Resampling.LANCZOS)


def board(canvas, game, frame, origin=(37, 84), size=530, labels=True, previous=None, fraction=1):
    def project(point):
        return origin[0] + point[0] * size / 1000, origin[1] + point[1] * size / 1000

    points = [project(point) for point in POINTS]
    # Every permanent movement edge comes directly from the production rules.
    edges = {tuple(sorted((source, target))) for source in range(8, 24)
             for target in game["adjacency"][source]}
    for source, target in sorted(edges):
        canvas.line([points[source], points[target]], width=1.15)
    for position in range(8, 24):
        canvas.circle(points[position], size * 0.006, fill=MINT)
        if labels:
            x, y = points[position]
            dx, dy = POINTS[position][0] - 500, POINTS[position][1] - 500
            norm = math.hypot(dx, dy)
            canvas.text((x + 21 * dx / norm, y + 21 * dy / norm), label(position),
                        size=12, fill=MUTED, anchor="mm")
    if labels:
        for position in range(8):
            x, y = points[position]
            canvas.text((x, y + 19), label(position), size=12, fill=MUTED, anchor="mm")

    move = frame.get("lastMove")
    if move:
        color = RED if move["side"] == "red" else BLUE
        canvas.line([points[move["from"]], points[move["to"]]], color, width=2)
        canvas.circle(points[move["from"]], size * 0.019, outline=color, width=1)

    if frame.get("formation"):
        target = [points[position] for position in frame["red"]]
        if frame["formation"] in ("Karo", "Crown"):
            cx = sum(point[0] for point in target) / 4
            cy = sum(point[1] for point in target) / 4
            target.sort(key=lambda point: math.atan2(point[1] - cy, point[0] - cx))
            canvas.line(target + [target[0]], RED, width=1.5)
        else:
            target.sort()
            canvas.line([target[0], target[-1]], RED, width=2)

    if frame.get("winner") and fraction == 1:
        winning = [points[position] for position in game["winningPattern"]]
        # The verified principal variation finishes with an axial line.
        winning.sort()
        canvas.line([winning[0], winning[-1]], GOLD, width=5)
        for point in winning:
            canvas.circle(point, size * 0.032, outline=GOLD, width=2)

    for side, color in [("red", RED), ("blue", BLUE)]:
        for position in frame[side]:
            point = points[position]
            if previous and move and side == move["side"] and position == move["to"]:
                start = points[move["from"]]
                point = (start[0] + (point[0] - start[0]) * fraction,
                         start[1] + (point[1] - start[1]) * fraction)
            canvas.circle(point, size * 0.027, fill=BG)
            canvas.circle(point, size * 0.022, fill=color)
            canvas.circle((point[0] - size * 0.006, point[1] - size * 0.007), size * 0.005, fill=INK)


def note(ply):
    if ply == 89:
        return ["I1 · I5 · O1 · O5", "Four red stones complete", "the winning straight line."]
    if ply >= 87:
        return ["Red threatens I4 → O5.", "Blue cannot occupy O5", "in a single move."]
    if ply >= 84:
        return ["Blue returns to the centre.", "Red rearranges its stones", "to prepare the final line."]
    if ply == 83:
        return ["Red holds four inner points.", "Blue's only legal moves", "return to the centre."]
    if ply == 82:
        return ["All four blue stones", "are now on the outer ring."]
    if ply >= 71:
        return ["Red regroups inside.", "Blue's foothold in the", "centre is shrinking."]
    if ply >= 15:
        return ["Red returns to the centre;", "Blue keeps finding ways", "to prolong the game."]
    if ply >= 7:
        return ["Red has deployed all four.", "Blue leaves its last start", "point on ply 10."]
    return ["Four stones each.", "Both sides develop towards", "the mobile inner ring."]


def render_frame(game, frame, previous=None, fraction=1, title="THE COMPLETE GAME"):
    canvas = Canvas()
    canvas.text((28, 20), "OCTAGON", 34, kind="bold")
    canvas.text((608, 28), "PERFECT", 14, RED, "mono")
    canvas.text((708, 28), "vs", 14, MUTED, "mono")
    canvas.text((749, 28), "PERFECT", 14, BLUE, "mono")
    canvas.text((28, 64), "A family board game. An 89-ply forced win.", 15, MUTED)
    canvas.line([(600, 106), (600, 600)])
    board(canvas, game, frame, previous=previous, fraction=fraction)
    canvas.text((628, 113), title, 14, MINT, "mono")
    # During a moving frame the previous position's counts still apply.
    shown = previous if previous and fraction < 1 else frame
    canvas.text((628, 151), f"PLY {shown['ply']:02d} / 89", 16, MUTED, "mono")
    move = frame.get("lastMove")
    side_color = RED if move and move["side"] == "red" else BLUE
    canvas.text((628, 191), move["notation"] if move else "Starting position", 22, INK, "bold")
    canvas.text((628, 225), f"{move['side'].title()}'s move" if move else "Red moves first", 15,
                side_color if move else RED)
    canvas.text((628, 276), str(shown["remaining"]).zfill(2), 64, GOLD if shown.get("winner") else INK, "bold")
    canvas.text((628, 350), "RED WINS" if shown.get("winner") else "plies left with best resistance", 15,
                GOLD if shown.get("winner") else MUTED)
    canvas.line([(628, 393), (927, 393)])
    canvas.text((628, 414), "STONES ON THE INNER RING", 14, MUTED, "mono")
    canvas.text((628, 447), f"Red  {shown['redInner']}", 18, RED)
    canvas.text((775, 447), f"Blue  {shown['blueInner']}", 18, BLUE)
    for index, line in enumerate(note(shown["ply"])):
        canvas.text((628, 505 + index * 24), line, 17)
    canvas.line([(28, 621), (932, 621)])
    canvas.line([(28, 621), (28 + 904 * shown["ply"] / 89, 621)], MINT, width=3)
    canvas.text((28, 634), "S  start     I  inner ring     O  outer ring", 13, MUTED)
    canvas.text((932, 634), "Exact tablebase · Family rules", 13, MUTED, anchor="ra")
    return canvas.finish()


def save_gif(path, images, durations):
    images[0].save(path, save_all=True, append_images=images[1:], duration=durations,
                   loop=0, optimize=True, disposal=1)
    print(f"{path.relative_to(ROOT)}: {path.stat().st_size / 1_000_000:.2f} MB", flush=True)


def main():
    result = subprocess.run(["node", str(ROOT / "scripts/export-perfect-game.mjs")],
                            check=True, capture_output=True, text=True)
    game = json.loads(result.stdout)
    docs, media = ROOT / "docs", ROOT / "docs/media"
    media.mkdir(parents=True, exist_ok=True)
    (docs / "perfect-game.json").write_text(result.stdout, encoding="utf-8")
    frames = game["frames"]

    # A single shared palette keeps the board and text stable between GIF frames.
    palette_source = Image.new("RGB", (WIDTH, HEIGHT * 3))
    for i, ply in enumerate([0, 44, 89]):
        palette_source.paste(render_frame(game, frames[ply]), (0, i * HEIGHT))
    palette = palette_source.quantize(colors=128)

    def indexed(image):
        return image.quantize(palette=palette, dither=Image.Dither.NONE)

    for name, first_ply, step_ms, pause_ms, title in [
        ("perfect-play.gif", 0, 60, 320, "THE COMPLETE GAME"),
        ("perfect-finish.gif", 78, 90, 900, "THE FINAL 11 PLIES"),
    ]:
        images = [indexed(render_frame(game, frames[first_ply], title=title))]
        durations = [1800]
        for ply in range(first_ply + 1, 90):
            for fraction in [0.25, 0.5, 0.75, 1]:
                image = render_frame(game, frames[ply], frames[ply - 1], fraction, title)
                images.append(indexed(image))
                durations.append(pause_ms if fraction == 1 else step_ms)
        durations[-1] = 4500
        save_gif(media / name, images, durations)
    render_frame(game, frames[0]).save(media / "opening.png")
    render_frame(game, frames[89]).save(media / "finish.png")

    # The four formation families, rendered from the same production patterns.
    canvas = Canvas(960, 318)
    canvas.text((28, 15), "TWENTY WAYS TO WIN", 20, kind="bold")
    for i, formation in enumerate(game["formations"]):
        example = {"red": formation["pattern"], "blue": [], "formation": formation["name"]}
        board(canvas, game, example, origin=(i * 240 + 15, 55), size=210, labels=False)
        canvas.text((i * 240 + 120, 275), formation["name"], 17, anchor="mm")
        canvas.text((i * 240 + 120, 302), f"{len(formation['variants'])} formations", 14, MUTED, anchor="mm")
    canvas.finish().save(media / "formations.png")

    lines = [
        "# One perfect game of Octagon", "",
        "This is the exact game shown in the README GIFs. Both sides use the shipped",
        "Perfect engine: Red chooses the shortest forced win; Blue delays it as long",
        "as possible. Equal choices are resolved by source and destination index.", "",
        "The result is **Red wins on ply 89**, its 45th move. This is one optimal line;",
        "other equally good continuations exist. Each recorded state has been checked",
        "against the tablebase, with the distance decreasing by one on every ply.", "",
        "![Starting board with position labels](media/opening.png)", "",
        "`S0…S7` are start points, `I0…I7` the inner ring, and `O0…O7` the outer ring.",
        "The ring labels run clockwise from the top; `S_i` lies between `I_(i−1)`",
        "and `I_i`. Red starts on the even-numbered S points and moves first.", "",
        "| Move | Red | Blue | Plies remaining after this row |",
        "|---:|---|---|---:|",
    ]
    for ply in range(1, 90, 2):
        red = frames[ply]["lastMove"]["notation"]
        blue = frames[ply + 1]["lastMove"]["notation"] if ply < 89 else "—"
        lines.append(f"| {(ply + 1) // 2} | {red} | {blue} | {max(0, 88 - ply)} |")
    lines += ["", "![Final straight-line win](media/finish.png)", "",
              "Final Red stones: `I1, I5, O1, O5`. Final Blue stones: `I0, O0, O6, O7`.", "",
              "The move list, all 90 positions, opening values, and move-choice counts are",
              "also available as [JSON](perfect-game.json). To regenerate the media, see",
              "[readme-media.md](readme-media.md).", "",
              f"Tablebase SHA-256: `{game['tablebaseSha256']}`.", ""]
    (docs / "perfect-game.md").write_text("\n".join(lines), encoding="utf-8")
    print(f"Verified {game['plies']} plies; Red wins; {game['uniqueWinningTurns']} unique winning choices.")


if __name__ == "__main__":
    main()
