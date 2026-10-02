#!/usr/bin/env python3
"""Aplica o efeito "Concrete Neon" (curtos-circuitos de pixel que alternam de sentido,
scanlines e faixa de luz) aos vídeos de "Imagem variada" (mosaico) de todos os presets.

Uso: python3 scripts/assets/apply_neon_glitch.py [dir] [--force]
Requer: numpy e imageio-ffmpeg (ou ffmpeg no PATH). Idempotente via marcador .neon_glitch_done.
"""
import json, re, subprocess, sys, zlib
from pathlib import Path
import numpy as np

try:
    import imageio_ffmpeg
    FF = imageio_ffmpeg.get_ffmpeg_exe()
except ImportError:
    FF = "ffmpeg"

SRC_PRESET = "P12"  # Concrete Neon já possui o efeito original


def probe(path):
    out = subprocess.run([FF, "-i", str(path)], capture_output=True, text=True).stderr
    w, h = map(int, re.search(r"Video:.*?, (\d{2,5})x(\d{2,5})", out).groups())
    fps = float(re.search(r"([\d.]+) fps", out).group(1))
    return w, h, fps


def glitch(frame, idx, rng):
    h, w, _ = frame.shape
    out = frame.copy()
    burst = (idx // 3) % 4 != 3  # rajadas de curto-circuito intercaladas com frames limpos
    if burst:
        direction = 1 if (idx // 6) % 2 == 0 else -1  # alterna o sentido
        for _ in range(int(rng.integers(2, 5))):
            bh = int(rng.integers(h // 60, h // 18))
            bw = int(rng.integers(w // 4, w))
            y = int(rng.integers(0, h - bh))
            x = int(rng.integers(0, w - bw + 1))
            shift = direction * int(rng.integers(w // 40, w // 8))
            out[y:y + bh, x:x + bw] = np.roll(out[y:y + bh, x:x + bw], shift, axis=1)
            if rng.random() < 0.15:  # flash neon ciano/magenta no bloco
                tint = np.array([255, 0, 255] if direction > 0 else [0, 255, 255], dtype=np.uint16)
                blk = out[y:y + bh, x:x + bw].astype(np.uint16)
                out[y:y + bh, x:x + bw] = np.minimum(255, (blk * 3 + tint * 2) // 4).astype(np.uint8)
        off = max(2, w // 200) * direction
        out[:, :, 0] = np.roll(out[:, :, 0], off, axis=1)
        out[:, :, 2] = np.roll(out[:, :, 2], -off, axis=1)
    out[::3] = (out[::3].astype(np.uint16) * 9 // 10).astype(np.uint8)  # scanlines
    y = int(h * 0.5 + (h * 0.06) * np.sin(idx / 5))
    band = out[y:y + 3].astype(np.uint16) + 70
    out[y:y + 3] = np.minimum(255, band).astype(np.uint8)  # faixa de luz horizontal
    return out


def process(src, tmp):
    w, h, fps = probe(src)
    rng = np.random.default_rng(zlib.crc32(src.name.encode()))
    rd = subprocess.Popen([FF, "-v", "error", "-i", str(src), "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                          stdout=subprocess.PIPE)
    wr = subprocess.Popen([FF, "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{w}x{h}",
                           "-r", str(fps), "-i", "-", "-an", "-c:v", "libx264", "-preset", "medium",
                           "-crf", "28", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-f", "mp4", str(tmp)],
                          stdin=subprocess.PIPE)
    size, i = w * h * 3, 0
    while True:
        buf = rd.stdout.read(size)
        if len(buf) < size:
            break
        f = np.frombuffer(buf, np.uint8).reshape(h, w, 3)
        wr.stdin.write(glitch(f, i, rng).tobytes())
        i += 1
    wr.stdin.close(); wr.wait(); rd.wait()
    if wr.returncode or not i:
        raise RuntimeError(f"falha em {src}")
    tmp.replace(src)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    root = Path(args[0] if args else "public/aura_com_material_mosaico_com_GIF")
    marker = root / ".neon_glitch_done"
    done = set(json.loads(marker.read_text())) if marker.exists() and "--force" not in sys.argv else set()
    for src in sorted(root.glob("P*_M*.mp4")):
        if src.name.startswith(SRC_PRESET + "_") or src.name in done:
            continue
        process(src, src.with_suffix(".tmp.mp4"))
        done.add(src.name)
        marker.write_text(json.dumps(sorted(done)))
        print("ok", src.name, flush=True)


if __name__ == "__main__":
    main()
