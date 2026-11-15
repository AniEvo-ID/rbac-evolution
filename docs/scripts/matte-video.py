# Turns a screen-colored character clip from Google Flow into transparent videos for the docs:
#   <out>.webm  VP9 with alpha  (Chrome, Edge, Firefox)
#   <out>.mov   HEVC with alpha (Safari)
#   <out>.webp  the first frame, used as the poster
# Usage: python -I docs/scripts/matte-video.py input-1080p.mp4 docs/public/mascots/<id>-<chibi|anime> CROP HEIGHT
#   CROP    w:h:x:y, the area the action uses (Veo's letterbox rows and empty screen trimmed off)
#   HEIGHT  largest height of the encoded clip: 870 for chibi, 960 for anime (twice the size the page shows)
# Needs ffmpeg (macOS, for hevc_videotoolbox), cwebp and `pip install "rembg[cpu]"` (Python 3.9-3.12).
# The matte is AI segmentation (BiRefNet), so outfits in the screen color survive; frames are kept in
# $TMPDIR/<id>-<mode>.frames/ so an interrupted run resumes. About 10 s per 1080p frame on a CPU.
import json, os, subprocess, sys, tempfile
import numpy as np
from PIL import Image


def unmix(I, a, key):
    """Recovers the foreground color from a pixel mixed with the screen: I = a*F + (1-a)*key."""
    return np.where(a[..., None] > 0, (I - (1 - a[..., None]) * key) / np.maximum(a[..., None], 1e-3), 0)


# self-check: a half-transparent white pixel over green comes back white
assert np.allclose(unmix(np.array([[[127.5, 255, 127.5]]]), np.array([[0.5]]), np.array([0, 255, 0])), 255)

if __name__ == '__main__':
    from rembg import new_session, remove

    src, out, crop, height = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
    w, h, x, y = map(int, crop.split(':'))
    frames = os.path.join(tempfile.gettempdir(), os.path.basename(out) + '.frames')  # outside docs/public, so it is never published
    os.makedirs(frames, exist_ok=True)
    # screen color from the top-left corner of the first frame (Veo drifts from the asked #00FF00)
    key = np.frombuffer(subprocess.check_output(['ffmpeg', '-loglevel', 'error', '-i', src, '-vf', 'crop=24:24:30:30,scale=1:1', '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']), np.uint8).astype(np.float32)
    total = int(json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-count_packets', '-show_entries', 'stream=nb_read_packets', '-of', 'json', src]))['streams'][0]['nb_read_packets'])
    p = subprocess.Popen(['ffmpeg', '-loglevel', 'error', '-nostdin', '-i', src, '-vf', f'crop={w}:{h}:{x}:{y}', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE)
    # lite model: same matte as the full one on these clips, twice as fast; CoreML hangs compiling it, so CPU only
    sess = new_session('birefnet-general-lite', providers=['CPUExecutionProvider'])
    n = 0
    while len(buf := p.stdout.read(w * h * 3)) == w * h * 3:
        path = f'{frames}/{n:04d}.png'
        n += 1
        if os.path.exists(path):
            continue
        I = np.frombuffer(buf, np.uint8).reshape(h, w, 3).astype(np.float32)
        ai = np.asarray(remove(Image.fromarray(I.astype(np.uint8)), session=sess, only_mask=True), np.float32) / 255
        # a soft color key keeps glows and sparks the AI matte drops; strict enough that clothes in the screen color stay with the AI
        ck = np.clip((np.linalg.norm(I - key, axis=2) / (255 * np.sqrt(3)) - 0.38) / 0.10, 0, 1)
        a = np.maximum(ai, ck)
        a[a < 0.03] = 0
        Image.fromarray(np.dstack([np.clip(unmix(I, a, key), 0, 255), a * 255]).astype(np.uint8)).save(path)
        print(f'frame {n}/{total}', flush=True)
    if n != total:
        sys.exit(f'read {n} of {total} frames, not encoding')
    scale = f'scale=1440:{height}:force_original_aspect_ratio=decrease:force_divisible_by=2'
    seq = ['ffmpeg', '-y', '-loglevel', 'error', '-nostdin', '-framerate', '24', '-i', f'{frames}/%04d.png']
    subprocess.run(seq + ['-vf', f'{scale},format=yuva420p', '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-crf', '32', '-b:v', '3000k', '-row-mt', '1', '-auto-alt-ref', '0', out + '.webm'], check=True)
    subprocess.run(seq + ['-vf', f'{scale},format=bgra', '-c:v', 'hevc_videotoolbox', '-alpha_quality', '0.8', '-b:v', '3000k', '-maxrate', '4000k', '-bufsize', '6000k', '-tag:v', 'hvc1', out + '.mov'], check=True)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-nostdin', '-i', f'{frames}/0000.png', '-vf', scale, out + '.png'], check=True)
    subprocess.run(['cwebp', '-quiet', '-q', '88', '-alpha_q', '90', out + '.png', '-o', out + '.webp'], check=True)
    os.remove(out + '.png')
    print('wrote', out + '.webm', out + '.mov', out + '.webp')
