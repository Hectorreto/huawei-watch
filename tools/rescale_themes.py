# Usage: python tools/rescale_themes.py SCALE CANVAS OUT_DIR apps/bakery-clicker/.../common/themes/<id>.png ...
# (run it on the old 466 px images in git history, a8a1603; the current ones are already 300 px).
# Recovers the native pixel art behind each 466 px theme image (nearest-neighbour upscaled by
# ffmpeg), then writes it scaled by an integer factor and centred on a square transparent canvas.
import subprocess, sys, os
S = 466
SCALE = int(sys.argv[1]); CANVAS = int(sys.argv[2]); OUT = sys.argv[3]
def ff_map(n):
    # dest x -> source x for ffmpeg scale=flags=neighbor from n to S, found by upscaling a gradient row.
    src = bytes(i for i in range(n))
    out = subprocess.run(["ffmpeg","-v","error","-f","rawvideo","-pix_fmt","gray","-s",f"{n}x1","-i","-",
        "-vf",f"scale={S}:1:flags=neighbor","-f","rawvideo","-pix_fmt","gray","-"],input=src,capture_output=True,check=True).stdout
    return list(out)
maps = {n: ff_map(n) for n in range(70, 120)}
for path in sys.argv[4:]:
    b = subprocess.run(["ffmpeg","-v","error","-i",path,"-f","rawvideo","-pix_fmt","rgba","-"],capture_output=True,check=True).stdout
    p = lambda x, y: b[(y*S+x)*4:(y*S+x)*4+4]
    colb = set(); rowb = set()
    for y in range(S):
        for x in range(S-1):
            if p(x, y) != p(x+1, y): colb.add(x)
    for x in range(S):
        for y in range(S-1):
            if p(x, y) != p(x, y+1): rowb.add(y)
    def fits(n, bounds):
        m = maps[n]; mb = {x for x in range(S-1) if m[x] != m[x+1]}
        return bounds <= mb
    n = next(n for n in range(70, 120) if fits(n, colb) and fits(n, rowb))
    m = maps[n]
    first = {}
    for x in range(S):
        first.setdefault(m[x], x)
    # check the reconstruction reproduces the image
    small = [[p(first[sx], first[sy]) for sx in range(n)] for sy in range(n)]
    assert all(p(x, y) == small[m[y]][m[x]] for y in range(0, S, 7) for x in range(S))
    size = n * SCALE; off = (CANVAS - size) // 2
    assert size <= CANVAS
    out = bytearray(CANVAS * CANVAS * 4)
    for y in range(size):
        for x in range(size):
            i = ((y + off) * CANVAS + x + off) * 4
            out[i:i+4] = small[y // SCALE][x // SCALE]
    dst = os.path.join(OUT, os.path.basename(path))
    subprocess.run(["ffmpeg","-v","error","-y","-f","rawvideo","-pix_fmt","rgba","-s",f"{CANVAS}x{CANVAS}","-i","-",dst],input=bytes(out),check=True)
    print(os.path.basename(path), n, size)
