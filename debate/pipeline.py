#!/usr/bin/env python3
"""Transcreve o áudio gravado da live do debate em blocos (whisper.cpp) e identifica quem fala (voz).

Gravação (separado):  yt-dlp -f "ba/best" --hls-use-mpegts -o "raw/band.%(ext)s" URL   → raw/band.mp4.part
Transcrição ao vivo:   .venv/bin/python pipeline.py live
Tudo de uma vez:       .venv/bin/python pipeline.py full raw/band.mp4
Rotular vozes:         .venv/bin/python pipeline.py speakers   (agrupa as vozes; depois: label 0=Lula 1=Flavio ...)
"""
import json
import os
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "raw", "audio.ts")
MODEL = os.path.join(HERE, "models", "ggml-large-v3-turbo-q5_0.bin")
OUT = os.path.join(HERE, "out")
SEG = os.path.join(OUT, "segments.jsonl")
CH = 30  # segundos por bloco


def sh(*a, **k):
    return subprocess.run(a, capture_output=True, text=True, **k)


def duration(path):
    r = sh("ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", path)
    try:
        return float(r.stdout.strip())
    except ValueError:
        return 0.0


def wav_of(path, t0, dur, out):
    sh("ffmpeg", "-y", "-v", "error", "-ss", str(t0), "-t", str(dur), "-i", path, "-vn", "-ac", "1", "-ar", "16000", out)


def whisper(wav, base):
    sh("whisper-cli", "-m", MODEL, "-l", "pt", "-f", wav, "-oj", "-of", base, "-t", "8", "--no-prints")
    with open(base + ".json") as f:
        j = json.load(f)
    return [(s["offsets"]["from"] / 1000, s["offsets"]["to"] / 1000, s["text"].strip()) for s in j["transcription"] if s["text"].strip()]


def live():
    os.makedirs(OUT, exist_ok=True)
    done = 0.0
    if os.path.exists(SEG):                       # retoma de onde parou
        for line in open(SEG):
            done = max(done, json.loads(line)["end"])
    while True:
        total = duration(RAW)
        while done + CH <= total - 4:
            wav = os.path.join(OUT, "chunk.wav")
            wav_of(RAW, done, CH, wav)
            segs = whisper(wav, os.path.join(OUT, "chunk"))
            with open(SEG, "a") as f:
                for a, b, text in segs:
                    f.write(json.dumps({"start": round(done + a, 2), "end": round(done + b, 2), "text": text}, ensure_ascii=False) + "\n")
            print(f"[{time.strftime('%H:%M:%S')}] {done:.0f}-{done + CH:.0f}s: {len(segs)} trechos", flush=True)
            done += CH
            total = duration(RAW)
        time.sleep(5)


def full(path):
    """Transcreve o arquivo inteiro de uma vez (melhor qualidade; use no fim do debate)."""
    os.makedirs(OUT, exist_ok=True)
    wav = os.path.join(OUT, "full.wav")
    sh("ffmpeg", "-y", "-v", "error", "-i", path, "-vn", "-ac", "1", "-ar", "16000", wav)
    segs = whisper(wav, os.path.join(OUT, "full"))
    with open(os.path.join(OUT, "segments_full.jsonl"), "w") as f:
        for a, b, text in segs:
            f.write(json.dumps({"start": a, "end": b, "text": text}, ensure_ascii=False) + "\n")
    print(len(segs), "trechos")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "live"
    if cmd == "live":
        live()
    elif cmd == "full":
        full(sys.argv[2] if len(sys.argv) > 2 else RAW)
    else:
        sys.exit(__doc__)
