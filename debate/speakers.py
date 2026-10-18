#!/usr/bin/env python3
"""Reconhece quem fala pela voz (resemblyzer) nos trechos de out/segments.jsonl.

  .venv/bin/python speakers.py cluster 4        agrupa as vozes em 4 grupos e mostra amostras de cada um
  .venv/bin/python speakers.py label 0=Lula 1=Flavio 2=Mediador   grava os nomes dos grupos (out/speakers.json)
  .venv/bin/python speakers.py assign           rotula todos os trechos (out/labeled.jsonl) pelo grupo mais próximo
"""
import json
import os
import subprocess
import sys

import numpy as np
from resemblyzer import VoiceEncoder, preprocess_wav
from sklearn.cluster import AgglomerativeClustering

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
AUDIO = os.path.join(HERE, "raw", "audio.ts")
WAV = os.path.join(OUT, "all.wav")
SEG = os.path.join(OUT, "segments.jsonl")
SPK = os.path.join(OUT, "speakers.json")


def load_segments():
    return [s for s in (json.loads(l) for l in open(SEG)) if s["start"] >= float(os.environ.get("MIN_START", 0))]


def full_wav():
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", AUDIO, "-vn", "-ac", "1", "-ar", "16000", WAV], check=True)
    import wave
    with wave.open(WAV) as w:
        data = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    return data


def embeds(segs, wav, enc, min_s=1.2):
    out = []
    for i, s in enumerate(segs):
        a, b = int(s["start"] * 16000), int(s["end"] * 16000)
        if (b - a) / 16000 < min_s:
            continue
        try:
            e = enc.embed_utterance(preprocess_wav(wav[a:b]))
        except Exception:
            continue
        out.append((i, e))
    return out


def cluster(k):
    segs, wav, enc = load_segments(), full_wav(), VoiceEncoder()
    em = embeds(segs, wav, enc)
    X = np.array([e for _, e in em])
    lab = AgglomerativeClustering(n_clusters=k, metric="cosine", linkage="average").fit_predict(X)
    info = {}
    for (i, e), c in zip(em, lab):
        info.setdefault(int(c), []).append(i)
    cent = {c: np.mean([e for (i, e), l in zip(em, lab) if l == c], axis=0).tolist() for c in info}
    json.dump({"centroids": cent, "labels": {}}, open(SPK, "w"))
    for c, idx in sorted(info.items(), key=lambda kv: -len(kv[1])):
        secs = sum(segs[i]["end"] - segs[i]["start"] for i in idx)
        print(f"\n=== grupo {c}: {len(idx)} trechos, {secs/60:.1f} min")
        for i in idx[:: max(1, len(idx) // 5)][:5]:
            print(f"   [{segs[i]['start']:.0f}s] {segs[i]['text'][:140]}")


def seed(pairs):
    """Cria as vozes a partir de intervalos conhecidos: seed Flavio=810-1034 Lula=1102-1190 Mediador=540-806,1053-1100"""
    segs, wav, enc = load_segments(), full_wav(), VoiceEncoder()
    em = dict(embeds(segs, wav, enc))
    cent, labels = {}, {}
    for k, pair in enumerate(pairs):
        name, spans = pair.split("=", 1)
        spans = [tuple(map(float, x.split("-"))) for x in spans.split(",")]
        vecs = [em[i] for i, sg in enumerate(segs) if i in em and any(a <= sg["start"] and sg["end"] <= b for a, b in spans)]
        cent[str(k)] = np.mean(vecs, axis=0).tolist()
        labels[str(k)] = name
        print(name, len(vecs), "trechos de referência")
    json.dump({"centroids": cent, "labels": labels}, open(SPK, "w"))


def label(pairs):
    d = json.load(open(SPK))
    d["labels"] = {k: v for k, v in (p.split("=", 1) for p in pairs)}
    json.dump(d, open(SPK, "w"))
    print(d["labels"])


def assign():
    d = json.load(open(SPK))
    cent = {int(c): np.array(v) for c, v in d["centroids"].items()}
    segs, wav, enc = load_segments(), full_wav(), VoiceEncoder()
    em = dict(embeds(segs, wav, enc, min_s=0.8))
    prev = None
    out = []
    for i, s in enumerate(segs):
        who = prev
        if i in em:
            e = em[i]
            c = max(cent, key=lambda k: float(e @ cent[k] / (np.linalg.norm(e) * np.linalg.norm(cent[k]))))
            who = d["labels"].get(str(c), f"grupo {c}")
        prev = who
        out.append({**s, "speaker": who})
    # suavização: um trecho curto cercado pelo mesmo outro falante provavelmente é dele
    for i in range(1, len(out) - 1):
        a, b, c = out[i - 1]["speaker"], out[i]["speaker"], out[i + 1]["speaker"]
        if a == c and b != a and out[i]["end"] - out[i]["start"] < 3.0:
            out[i]["speaker"] = a
    with open(os.path.join(OUT, "labeled.jsonl"), "w") as f:
        for s in out:
            f.write(json.dumps(s, ensure_ascii=False) + "\n")
    print("ok:", len(segs), "trechos rotulados")


if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "cluster":
        cluster(int(sys.argv[2]))
    elif cmd == "seed":
        seed(sys.argv[2:])
    elif cmd == "label":
        label(sys.argv[2:])
    elif cmd == "assign":
        assign()
    else:
        sys.exit(__doc__)
