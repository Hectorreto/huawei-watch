"""Writes the black radial vignette laid over the big cookie (common/vignette.png).

Pure Python (Pillow is not installed): a 466x466 RGBA PNG, all black, with alpha 0
up to INNER px from the centre, rising smoothly to EDGE_ALPHA at OUTER px (the edge of
the round screen) and staying there beyond it.

Usage: python tools/make_vignette.py
"""
import math
import os
import struct
import zlib

SIZE = 466
INNER = 150
OUTER = 233
EDGE_ALPHA = 215  # about 85 %

OUT = os.path.join(os.path.dirname(__file__), '..', 'apps', 'bakery-clicker', 'entry', 'src', 'main',
                   'js', 'MainAbility', 'common', 'vignette.png')


def alpha(x, y):
    c = (SIZE - 1) / 2
    r = math.hypot(x - c, y - c)
    t = min(max((r - INNER) / (OUTER - INNER), 0.0), 1.0)
    return round(EDGE_ALPHA * t * t * (3 - 2 * t))  # smoothstep


def chunk(kind, data):
    body = kind + data
    return struct.pack('>I', len(data)) + body + struct.pack('>I', zlib.crc32(body))


def main():
    rows = bytearray()
    for y in range(SIZE):
        rows.append(0)  # filter: none
        for x in range(SIZE):
            rows += bytes((0, 0, 0, alpha(x, y)))
    png = (b'\x89PNG\r\n\x1a\n'
           + chunk(b'IHDR', struct.pack('>IIBBBBB', SIZE, SIZE, 8, 6, 0, 0, 0))
           + chunk(b'IDAT', zlib.compress(bytes(rows), 9))
           + chunk(b'IEND', b''))
    with open(OUT, 'wb') as f:
        f.write(png)


if __name__ == '__main__':
    main()
