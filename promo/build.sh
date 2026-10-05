#!/bin/sh
# Refait le film de bout en bout : images (Chrome sans tête), bande-son (numpy/scipy via uv), puis MP4.
set -e
cd "$(dirname "$0")"
rm -rf frames
node render.mjs --workers 10
uv run --no-project --python 3.12 --with numpy --with scipy python audio.py
ffmpeg -loglevel error -y -framerate 60 -i frames/f_%05d.png -i audio.wav -map 0:v -map 1:a \
  -c:v libx264 -preset slow -crf 15 -tune animation -pix_fmt yuv420p \
  -vf "scale=out_color_matrix=bt709:out_range=tv" -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
  -af "volume=-1.3dB" -c:a aac -b:a 256k -movflags +faststart -shortest notacent-motion.mp4
rm -rf frames
echo "notacent-motion.mp4"
