#!/usr/bin/env bash
# Regenerate small map previews used by the map picker and recent-maps rail.
# Full-size region maps are ~2 MB each; previews are ~30 KB.
# Requires macOS `sips` (or swap in ImageMagick: `magick in.jpg -resize 360x360 -quality 60 out.jpg`).
set -euo pipefail
cd "$(dirname "$0")/../public/maps"
mkdir -p thumbs
for f in *.jpg; do
  sips -Z 360 -s formatOptions 60 "$f" --out "thumbs/$f" >/dev/null
done
du -sh thumbs
