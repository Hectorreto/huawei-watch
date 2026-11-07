# Draws the launcher icons of the maze, the drawing lab and Órbita as pixel art: each design is
# sampled on a small grid (26 cells for icon.png, 23 for icon_small.png) and every cell is
# scaled 4x with no smoothing, giving 104 and 92 px RGBA PNGs. Needs ffmpeg on PATH.
# Usage: python tools/make_app_icons.py
import subprocess

def maze(u, v):
    # A corridor seen from inside: ceiling, floor and walls receding to a dark end with a gem.
    d = max(abs(u), abs(v))
    if d < 0.3:
        if abs(u) + abs(v) < 0.22:
            return (80, 220, 255) if u + v < -0.04 else (30, 150, 220)
        return (12, 14, 30)
    band = int((1 - d) / 0.24)  # segment of the corridor, darker further in
    shade = 1.0 - band * 0.17
    if abs(v) >= abs(u):
        base = (70, 60, 100) if v < 0 else (120, 90, 60)
    else:
        base = (150, 150, 170) if band % 2 == 0 else (125, 125, 150)
    edge = abs(abs(u) - abs(v)) < 0.06
    if edge:
        base = (40, 36, 60)
    return tuple(int(c * shade) for c in base)

def lab(u, v):
    # Three shapes in the lab's colours on a dark round tile.
    if (u + 0.33) ** 2 + (v + 0.3) ** 2 < 0.25 ** 2:
        return (235, 70, 70)
    if 0.1 < u < 0.56 and -0.53 < v < -0.07:
        return (70, 140, 240)
    if 0.05 < v < 0.6 and abs(u - 0.0) < (v - 0.05) * 0.95:
        return (250, 200, 60)
    return (34, 38, 52)

def orbit(u, v):
    # Órbita: the arena's ring with spikes on its wall, a diamond and the ball.
    import math
    r = (u * u + v * v) ** 0.5
    a = math.atan2(v, u)
    if r > 0.86:
        return (52, 64, 106)
    for c in (-2.3, -0.5):  # two groups of spikes pointing in
        for k in range(3):
            d = abs((a - (c + k * 0.36) + math.pi) % (2 * math.pi) - math.pi)
            if r > 0.6 and d * 0.86 < (r - 0.6) * 0.62:
                return (240, 90, 75)
    if abs(u + 0.12) / 0.8 + abs(v - 0.28) < 0.2:
        return (255, 205, 70)
    if (u - 0.25) ** 2 + (v + 0.05) ** 2 < 0.13 ** 2:
        return (255, 255, 255)
    return (18, 23, 41)

def render(design, n, path):
    out = bytearray()
    for y in range(n):
        row = bytearray()
        for x in range(n):
            u = (x + 0.5) / n * 2 - 1
            v = (y + 0.5) / n * 2 - 1
            r = (u * u + v * v) ** 0.5
            if r > 0.94:
                px = (0, 0, 0, 0)
            elif r > 0.82:
                px = (20, 20, 28, 255)
            else:
                px = design(u / 0.82, v / 0.82) + (255,)
            row += bytes(px) * 4
        out += bytes(row) * 4
    s = n * 4
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", f"{s}x{s}",
                    "-i", "-", path], input=bytes(out), check=True)

for app, design in (("maze", maze), ("drawing-lab", lab), ("orbit", orbit)):
    media = f"apps/{app}/entry/src/main/resources/base/media/"
    render(design, 26, media + "icon.png")
    render(design, 23, media + "icon_small.png")
