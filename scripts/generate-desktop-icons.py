#!/usr/bin/env python3
"""Clip desktop app PNG/ICO assets to the chamfered octagon (transparent corners)."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw

# Matches src/apps/desktop/src/jvmMain/resources/icons/brand-mark.svg frame.
OCTAGON_100 = [
    (16, 3),
    (84, 3),
    (97, 16),
    (97, 84),
    (84, 97),
    (16, 97),
    (3, 84),
    (3, 16),
]

REPO_ROOT = Path(__file__).resolve().parents[1]
ICONS_DIR = REPO_ROOT / "src/apps/desktop/src/jvmMain/resources/icons"


def clip_to_octagon(src: Image.Image, supersample: int = 4) -> Image.Image:
    width, height = src.size
    if width != height:
        raise ValueError(f"expected square icon, got {width}x{height}")
    size = width * supersample
    scale = size / 100.0
    polygon = [(x * scale, y * scale) for x, y in OCTAGON_100]
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).polygon(polygon, fill=255)
    enlarged = src.resize((size, size), Image.LANCZOS)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(enlarged.convert("RGBA"), mask=mask)
    return out.resize((width, height), Image.LANCZOS)


def main() -> int:
    for name in ("app-icon-256.png", "app-icon-512.png"):
        path = ICONS_DIR / name
        clipped = clip_to_octagon(Image.open(path))
        clipped.save(path, optimize=True)
        print(f"wrote {path.relative_to(REPO_ROOT)}")

    ico = ICONS_DIR / "app-icon.ico"
    subprocess.run(
        [
            "magick",
            str(ICONS_DIR / "app-icon-256.png"),
            "-define",
            "icon:auto-resize=256,128,64,48,32,16",
            str(ico),
        ],
        check=True,
    )
    print(f"wrote {ico.relative_to(REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except subprocess.CalledProcessError as exc:
        print(f"icon generation failed: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
