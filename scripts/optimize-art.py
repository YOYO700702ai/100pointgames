"""Create compact WebP copies of existing game artwork; keep originals intact."""
from pathlib import Path
import json

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ARTWORK = {
    "0.jpg": "world-map", "11.jpg": "village", "unnamed.jpg": "welcome",
    "星願永恆宮.png": "palace", "養雞場.jpg": "hatchery",
    "1.jpg": "story-1", "2.jpg": "story-2", "3.jpg": "story-3",
    "4.jpg": "story-4", "5..jpg": "story-5", "END1.jpg": "ending-1",
    "END2.jpg": "ending-2", "unnamed (1).png": "egg-amethyst",
    "unnamed.png": "egg-stardust", "unnamed (2).png": "egg-vine",
    "unnamed (3).png": "egg-amber", "unname.png": "egg-obsidian",
}


def main():
    output_dir = ROOT / "assets" / "art"
    output_dir.mkdir(parents=True, exist_ok=True)
    report = []
    for original, name in ARTWORK.items():
        source, target = ROOT / original, output_dir / f"{name}.webp"
        with Image.open(source) as image:
            image = image.convert("RGBA" if "A" in image.getbands() else "RGB")
            image.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
            image.save(target, "WEBP", quality=86, method=6)
        report.append({"source": original, "output": target.relative_to(ROOT).as_posix(),
                       "before": source.stat().st_size, "after": target.stat().st_size})
    (output_dir / "manifest.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"{len(report)} images: {sum(row['before'] for row in report):,} -> "
          f"{sum(row['after'] for row in report):,} bytes")


if __name__ == "__main__":
    main()
