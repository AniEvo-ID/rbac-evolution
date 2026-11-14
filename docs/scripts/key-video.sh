#!/usr/bin/env bash
# Turns a green-screen character clip from Google Flow into two transparent videos for the docs:
#   <out>.webm  VP9 with alpha  (Chrome, Edge, Firefox)
#   <out>.mov   HEVC with alpha (Safari)
#   <out>.webp  the first frame, used as the poster
# Usage: [CROP=w:h:x:y] [FRAMES=n] [HEIGHT=640] [KEY=0xRRGGBB] [SIM=0.38] docs/scripts/key-video.sh input.mp4 docs/public/mascots/<id>-<chibi|anime>
#   CROP   trims Veo's letterbox bars and the empty screen around the figure
#   KEY    the screen color; by default it is read from the top-left corner of the first frame
#          (Veo drifts from the asked #00FF00, and green-haired guardians use a magenta screen)
#   SIM    how far from KEY still counts as screen (0.38; lower it when the outfit is dark green)
#   FRAMES keeps only the first n frames (Veo sometimes zooms on the last frames)
# Needs ffmpeg on macOS (hevc_videotoolbox) and cwebp.
set -euo pipefail
in=$1
out=$2
# colorkey works on RGB distance, so the dark greens and teals in the art survive; then fit the clip in 960 x HEIGHT (580 chibi, 640 anime: the largest the site shows it).
key=${KEY:-0x$(ffmpeg -loglevel error -i "$in" -vf "crop=16:16:24:24,scale=1:1" -frames:v 1 -f rawvideo -pix_fmt rgb24 - | xxd -p)}
echo "key $key"
pre="${CROP:+crop=$CROP,}${FRAMES:+trim=end_frame=$FRAMES,setpts=PTS-STARTPTS,}"
filter="${pre}colorkey=$key:${SIM:-0.38}:0.10,scale=960:${HEIGHT:-640}:force_original_aspect_ratio=decrease:force_divisible_by=2,format=yuva420p"
ffmpeg -y -loglevel error -i "$in" -an -vf "$filter" \
  -c:v libvpx-vp9 -pix_fmt yuva420p -crf 38 -b:v 1500k -row-mt 1 -auto-alt-ref 0 "$out.webm"
ffmpeg -y -loglevel error -i "$in" -an -vf "${filter/yuva420p/bgra}" \
  -c:v hevc_videotoolbox -alpha_quality 0.6 -b:v 1500k -maxrate 2000k -bufsize 3000k -tag:v hvc1 "$out.mov"
ffmpeg -y -loglevel error -i "$in" -vf "${filter/,format=yuva420p/}" -frames:v 1 "$out.poster.png"
cwebp -quiet -q 88 -alpha_q 90 "$out.poster.png" -o "$out.webp" && rm "$out.poster.png"
ls -la "$out.webm" "$out.mov" "$out.webp"
