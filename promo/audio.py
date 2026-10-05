# La bande-son du film, entièrement synthétisée : une musique à 120 BPM (une mesure = 2 s, chaque coupe tombe sur un temps)
# et les bruitages posés aux instants exacts que scene.js exporte dans cues.json. Rien d'enregistré, rien de téléchargé.
#   python3 audio.py            → audio.wav (48 kHz, stéréo)
import json, os
import numpy as np
from scipy import signal
from scipy.io import wavfile

HERE = os.path.dirname(os.path.abspath(__file__))
SR, DUR = 48000, 30.0
N = int(SR * DUR) + SR * 3
rng = np.random.default_rng(7)
BEAT = 0.5

def T(d): return np.arange(int(d * SR)) / SR
def mtof(m): return 440.0 * 2 ** ((m - 69) / 12)
def noise(d): return rng.standard_normal(int(d * SR))
def filt(x, kind, f, order=2):
    return signal.sosfilt(signal.butter(order, f, btype=kind, fs=SR, output='sos'), x)
def lp(x, f, o=2): return filt(x, 'lowpass', f, o)
def hp(x, f, o=2): return filt(x, 'highpass', f, o)
def bp(x, lo, hi, o=2): return filt(x, 'bandpass', [lo, min(hi, SR / 2 - 100)], o)
def svf(x, fc, q=1.2):  # passe-bande à fréquence variable (Chamberlin)
    y = np.empty_like(x); low = band = 0.0
    f = 2 * np.sin(np.pi * np.clip(fc, 30, 7000) / SR); damp = 1 / q
    for i in range(len(x)):
        high = x[i] - low - damp * band; band += f[i] * high; low += f[i] * band; y[i] = band
    return y

def mx(*sigs):  # somme de signaux de longueurs différentes
    out = np.zeros(max(len(x) for x in sigs))
    for x in sigs: out[:len(x)] += x
    return out
def bus(): return np.zeros((2, N))
def add(b, sig, t, pan=0.0, gain=1.0):
    sig = np.atleast_2d(sig)
    if sig.shape[0] == 1: sig = np.vstack([sig * np.cos((pan + 1) * np.pi / 4), sig * np.sin((pan + 1) * np.pi / 4)]) * np.sqrt(2)
    i = int(round(t * SR))
    if i < 0: sig = sig[:, -i:]; i = 0
    n = min(sig.shape[1], N - i)
    if n > 0: b[:, i:i + n] += sig[:, :n] * gain

# ---------- instruments ----------
def kick(g=1.0, d=0.5):
    t = T(d); f = 46 + 110 * np.exp(-t / 0.028) + 26 * np.exp(-t / 0.11)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.17) * np.minimum(1, t / 0.0008)
    s += hp(noise(d), 2500) * np.exp(-t / 0.004) * 0.3
    return np.tanh(s * 1.8) * g
def clap(g=1.0):
    d = 0.4; t = T(d); n = bp(noise(d), 850, 2800); e = np.zeros_like(t)
    for k, o in enumerate([0, 0.012, 0.024]): e += (t >= o) * np.exp(-np.maximum(0, t - o) / 0.0055)
    e += (t >= 0.024) * np.exp(-np.maximum(0, t - 0.024) / 0.075) * 0.7
    return n * e * g * 0.8
def snare(g=1.0):
    d = 0.25; t = T(d); tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.04)
    return (bp(noise(d), 1500, 8000) * np.exp(-t / 0.06) * 0.8 + tone * 0.5) * g
def hat(g=1.0, open_=False):
    d = 0.35 if open_ else 0.07; t = T(d); return hp(noise(d), 7800, 3) * np.exp(-t / (0.1 if open_ else 0.017)) * g
def shaker(g=1.0):
    d = 0.09; t = T(d); return bp(noise(d), 4500, 11000) * np.minimum(1, t / 0.014) * np.exp(-t / 0.024) * g
def crash(g=1.0, d=3.0):
    t = T(d); n = hp(noise(d), 3800) + 0.5 * bp(noise(d), 2200, 6000)
    return n * np.exp(-t / 0.8) * np.minimum(1, t / 0.002) * g * 0.5
def marimba(m, g=1.0, d=0.7):
    f = mtof(m); t = T(d)
    s = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.3) + 0.3 * np.sin(2 * np.pi * f * 3.98 * t) * np.exp(-t / 0.04) + 0.1 * np.sin(2 * np.pi * f * 9.1 * t) * np.exp(-t / 0.012)
    return s * np.minimum(1, t / 0.0015) * g
def bell(m, g=1.0, d=1.6):
    f = mtof(m); t = T(d); s = 0
    for r, a, tau in [(1, 1, 0.9), (2.76, 0.45, 0.35), (5.4, 0.25, 0.15), (8.93, 0.12, 0.06)]: s = s + a * np.sin(2 * np.pi * f * r * t) * np.exp(-t / tau)
    return s * np.minimum(1, t / 0.001) * g * 0.6
def bass(m, d, g=1.0):
    f = mtof(m); t = T(d); ph = 2 * np.pi * f * t
    s = np.sin(ph) + 0.3 * np.sin(2 * ph) + 0.12 * np.sin(3 * ph)
    env = np.minimum(1, t / 0.006) * np.clip((d - t) / 0.035, 0, 1) * (0.72 + 0.28 * np.exp(-t / 0.1))
    return np.tanh(s * env * 1.4) * g
def pad(ms, d, g=1.0, cut=1600, att=0.25, rel=0.6):
    t = T(d + rel); s = np.zeros((2, len(t)))
    for m in ms:
        for k, det in enumerate((-0.09, 0.0, 0.08)):
            f = mtof(m + det); ph0 = rng.random()
            w = signal.sawtooth(2 * np.pi * (f * t + ph0)); s[k % 2] += w; s[(k + 1) % 2] += w * 0.5
    env = np.minimum(1, t / att) * np.clip((d + rel - t) / rel, 0, 1)
    return np.vstack([lp(s[0], cut, 2), lp(s[1], cut, 2)]) * env * g / (len(ms) * 3)
def whistle(m, d, g=1.0):
    f = mtof(m); t = T(d + 0.12)
    vib = 1 + 0.0045 * np.sin(2 * np.pi * 5.6 * t) * np.minimum(1, t / 0.18)
    ph = 2 * np.pi * np.cumsum(f * vib) / SR; s = np.sin(ph) + 0.1 * np.sin(2 * ph) + 0.03 * np.sin(3 * ph)
    s += bp(noise(d + 0.12), f * 0.85, f * 1.25) * 0.06
    return s * np.minimum(1, t / 0.025) * np.clip((d + 0.12 - t) / 0.1, 0, 1) * g

# ---------- bruitages ----------
PENTA = [0, 2, 4, 7, 9]
def penta(i, base=72): return base + PENTA[i % 5] + 12 * (i // 5)
def click_(g=1.0, p=1.0):
    d = 0.03; t = T(d); return (bp(noise(d), 2500 * p, 7000 * p) * np.exp(-t / 0.0035) + 0.4 * np.sin(2 * np.pi * 1900 * p * t) * np.exp(-t / 0.006)) * g
def whoosh(d, g=1.0, f0=250, f1=4500, q=0.9):
    t = T(d); x = t / d; fc = f0 * (f1 / f0) ** np.sin(np.pi * x / 2)
    s = svf(noise(d), fc, q) * np.sin(np.pi * x) ** 1.5
    return s / (np.abs(s).max() + 1e-9) * g
def scratch(d, lo=1800, hi=6000, g=1.0, rate=38):
    t = T(d); jit = np.abs(np.sin(2 * np.pi * rate * t + 3 * np.sin(2 * np.pi * 7 * t))) ** 0.6
    env = np.minimum(1, t / 0.012) * np.clip((d - t) / 0.03, 0, 1)
    return bp(noise(d), lo, hi) * jit * env * g
def blip(f0, f1, d=0.07, g=1.0):
    t = T(d); f = f0 * (f1 / f0) ** (t / d)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / (d * 0.35)) * np.minimum(1, t / 0.002) * g
def coin(p=1.0, g=1.0):
    d = 0.9; t = T(d); s = 0
    for r, a, tau in [(2093, 1, 0.35), (3140, 0.7, 0.25), (4720, 0.5, 0.18), (6280, 0.35, 0.1), (2637, 0.6, 0.3)]:
        s = s + a * np.sin(2 * np.pi * r * p * t + rng.random() * 6) * np.exp(-t / tau)
    return (s * 0.3 + hp(noise(d), 5000) * np.exp(-t / 0.004) * 0.4) * np.minimum(1, t / 0.0006) * g
def thud(g=1.0, big=True):
    d = 0.7 if big else 0.3; t = T(d)
    boom = np.sin(2 * np.pi * np.cumsum(55 + 70 * np.exp(-t / 0.03)) / SR) * np.exp(-t / (0.22 if big else 0.08))
    body = bp(noise(d), 180, 900) * np.exp(-t / 0.05)
    slap = hp(noise(d), 2200) * np.exp(-t / 0.012) * 0.7
    return np.tanh((boom * (1.2 if big else 0.5) + body * 0.9 + slap) * 1.5) * g

def sfx(cues):
    b = bus(); send = bus()
    for c in cues:
        t, k = c['t'], c['type']; g = c.get('g', 1.0); p = c.get('p', 1.0); d = c.get('d', 0.3)
        pan = (rng.random() - 0.5) * 0.5
        if k == 'key': add(b, click_(0.35 * g, 0.8 + rng.random() * 0.4), t, pan)
        elif k == 'tick': add(b, click_(0.3 * g, 1.3 * p), t, pan * 0.4)
        elif k == 'clunk': add(b, mx(blip(260 * p, 150 * p, 0.09, 0.5), click_(0.4, 0.7)), t, (p - 1.1) * 3)
        elif k == 'pencil': add(b, scratch(d, 2500, 7500, 0.12), t, pan)
        elif k == 'pen': add(b, scratch(d, 1200, 4200, 0.22 * g, rate=26), t, pan)
        elif k == 'marker':
            s = scratch(d, 700, 2600, 0.2 * g, rate=14) + blip(900, 1250, d, 0.03 * g)
            add(b, s, t, pan); add(send, s, t, 0, 0.3)
        elif k == 'drop':
            for j in range(4): add(b, blip(700 - j * 90, 220, 0.12, 0.18), t + j * 0.035, -0.4 + j * 0.25)
        elif k == 'slide': add(b, whoosh(0.3, 0.12, 400, 2500), t, 0)
        elif k == 'fallwhistle':
            tt = T(d); f = 1600 * (420 / 1600) ** (tt / d)
            s = np.sin(2 * np.pi * np.cumsum(f * (1 + 0.01 * np.sin(2 * np.pi * 9 * tt))) / SR) * np.minimum(1, tt / 0.02) * np.clip((d - tt) / 0.02, 0, 1)
            add(b, s * 0.09, t, 0); add(send, s * 0.09, t, 0, 0.5)
        elif k == 'slam':
            s = thud(0.9 * g, True); add(b, s, t, 0); add(send, s, t, 0, 0.35)
        elif k == 'stampSmall': add(b, thud(0.45, False), t, 0.2)
        elif k == 'pops':
            n = c.get('n', 6)
            for j in range(n):
                tj = t + d * j / max(1, n) + rng.random() * 0.01; m = penta(rng.integers(0, 8) + int(j * 5 / max(1, n)), 72 + int((p - 1) * 12))
                s = blip(mtof(m) * 0.55, mtof(m), 0.05, 0.07); add(b, s, tj, (rng.random() - 0.5) * 0.9); add(send, s, tj, 0, 0.4)
        elif k == 'pop': s = blip(420 * p, 1100 * p, 0.08, 0.22); add(b, s, t, pan); add(send, s, t, 0, 0.4)
        elif k == 'blip': s = blip(500 * p, 1500 * p, 0.1, 0.2); add(b, s, t, 0); add(send, s, t, 0, 0.4)
        elif k == 'riser':
            tt = T(d); x = tt / d
            s = svf(noise(d), 200 * (7000 / 200) ** x, 2.5) * x ** 2 * 0.5 + np.sin(2 * np.pi * np.cumsum(180 * (6 ** x)) / SR) * x ** 3 * 0.12
            add(b, s * 0.5, t, 0); add(send, s, t, 0, 0.4)
        elif k == 'boom': add(b, thud(0.7, True), t, 0)
        elif k in ('whoosh', 'wipe', 'whip'):
            gg = {'whoosh': 0.22, 'wipe': 0.3, 'whip': 0.45}[k] * g
            s = whoosh(d, gg, 180, 5000 if k != 'wipe' else 3500)
            sw = np.linspace(-0.8, 0.8, len(s)); st = np.vstack([s * np.cos((sw + 1) * np.pi / 4), s * np.sin((sw + 1) * np.pi / 4)]) * np.sqrt(2)
            add(b, st, t); add(send, st, t, 0, 0.25)
        elif k == 'click': add(b, click_(0.6, 0.9), t, 0.2); add(b, click_(0.4, 1.1), t + 0.07, 0.2)
        elif k == 'shimmer':
            for j in range(14): tj = t + d * (j / 14) ** 0.8; s = blip(mtof(penta(j, 84)), mtof(penta(j, 84)) * 1.02, 0.08, 0.035); add(b, s, tj, (rng.random() - 0.5)); add(send, s, tj, 0, 0.6)
        elif k == 'fill':
            m = penta(int(round(c['i'] / 52 * 14)), 69)
            s = marimba(m, 0.16 * g, 0.5); add(b, s, t, -0.7 + 1.4 * c['i'] / 52); add(send, s, t, 0, 0.35)
        elif k == 'ding': s = bell(84, 0.25) + bell(88, 0.18); add(b, s, t, 0); add(send, s, t, 0, 0.6)
        elif k == 'clack':
            s = (bp(noise(0.05), 900 * p, 3200 * p) * np.exp(-T(0.05) / 0.008) + np.sin(2 * np.pi * 750 * p * T(0.05)) * np.exp(-T(0.05) / 0.012) * 0.5) * 0.35 * g
            add(b, s, t, (rng.random() - 0.5) * 1.2)
        elif k == 'count':
            m = penta(c['i'] + 2, 72); s = blip(mtof(m) * 0.7, mtof(m), 0.06, 0.12 * c.get('g', 1)); add(b, s, t, 0.3); add(send, s, t, 0, 0.3)
        elif k == 'swap':
            add(b, whoosh(0.4, 0.2, 300, 3000), t - 0.05, 0); s = marimba(79, 0.15) + marimba(84, 0.12); add(b, s, t + 0.2, 0); add(send, s, t + 0.2, 0, 0.5)
        elif k == 'coin': s = coin(p, 0.5); add(b, s, t, 0.1); add(send, s, t, 0, 0.5)
        elif k == 'tab': add(b, whoosh(0.3, 0.14, 500, 3000), t, 0.3); add(b, click_(0.3, 0.6), t + 0.3, 0.3)
        elif k == 'sparkle':
            for j, m in enumerate([84, 88, 91, 96]): s = bell(m, 0.16, 1.4); add(b, s, t + j * 0.055, -0.3 + j * 0.2); add(send, s, t + j * 0.055, 0, 0.7)
    return b, send

# ---------- musique ----------
BARS = ['Am', 'Am', 'C', 'G', 'Am', 'F', 'C', 'G', 'Am', 'F', 'Dm', 'G', 'C', 'G', 'C']
CH = {'C': [60, 64, 67], 'G': [55, 59, 62], 'Am': [57, 60, 64], 'F': [53, 57, 60], 'Dm': [50, 53, 57]}
ROOT = {'C': 36, 'G': 43, 'Am': 45, 'F': 41, 'Dm': 38}
MOTIF = {
    'CG': [(0, 76, .75), (.75, 79, .75), (1.5, 81, .5), (2, 79, 1), (3, 76, .5), (3.5, 74, .5), (4, 74, .75), (4.75, 76, .75), (5.5, 79, .5), (6, 74, 1.5)],
    'AmF': [(0, 76, .75), (.75, 72, .75), (1.5, 76, .5), (2, 79, 1), (3, 77, .5), (3.5, 76, .5), (4, 72, .75), (4.75, 69, .75), (5.5, 72, .5), (6, 76, 1.5)],
}
def groove_on(t):  # la batterie joue-t-elle à l'instant t ?
    return (4.0 <= t < 20.0) or (21.0 <= t < 26.74)

def music():
    drums, keys, low, lead, send = bus(), bus(), bus(), bus(), bus()
    kicks = []
    step = BEAT / 4
    for bi, ch in enumerate(BARS):
        t0 = bi * 2.0; notes = CH[ch]
        # nappe
        cut = 700 if bi < 2 else 1900 if bi != 10 else 1100
        if bi == 14: add(keys, pad([48, 55, 60, 64, 67, 74], 1.6, 0.55, 2600, 0.01, 0.9), t0)
        else: add(keys, pad([n - 12 for n in notes] + [notes[0]], 2.0, 0.32 if bi >= 2 else 0.4, cut, 0.08 if bi >= 2 else 0.6), t0)
        # arpège de marimba en doubles croches
        tones = [n + 12 for n in notes] + [n + 24 for n in notes]
        pat = [0, 1, 2, 3, 4, 3, 2, 1, 0, 2, 1, 3, 2, 4, 3, 5]
        for s in range(16):
            t = t0 + s * step
            if bi == 14 and s > 0: break
            if 26.74 <= t < 28.0: continue
            if bi < 2 and s % 2: continue
            g = (0.2 if s % 4 == 0 else 0.12) * (0.55 if bi < 2 or (bi == 10 and t < 21) else 1)
            sig = marimba(tones[pat[s]], g, 0.6)
            if bi < 2 or (bi == 10 and t < 21): sig = lp(sig, 1400)
            add(keys, sig, t, 0.35 if s % 2 else -0.35)
        # basse
        if 2 <= bi <= 13:
            for s, (off, dur, oct_) in enumerate([(0, .45, 0), (.75, .2, 12), (1, .45, 0), (1.5, .2, 12), (2, .45, 0), (2.75, .2, 12), (3, .45, 0), (3.5, .45, 7)]):
                t = t0 + off * BEAT
                if not groove_on(t): continue
                add(low, bass(ROOT[ch] + oct_, dur * BEAT * 1.9, 0.5), t)
        if bi == 14: add(low, bass(36, 1.9, 0.6), t0); add(low, bass(24, 1.9, 0.35), t0)
        # batterie
        for s in range(16):
            t = t0 + s * step
            if not groove_on(t): continue
            if s in (0, 6, 8): add(drums, kick(0.9), t); kicks.append(t)
            if s in (4, 12): c = clap(0.55); add(drums, c, t); add(send, c, t, 0, 0.35)
            if s in (2, 6, 10, 14): add(drums, hat(0.16), t, 0.25)
            add(drums, shaker(0.07 if s % 2 else 0.04), t + (0.012 if s % 2 else 0), -0.3)
    # temps forts et roulements
    for t in [4.0, 8.0, 14.0, 21.0, 24.0, 28.0]: add(drums, crash(0.55 if t != 28 else 0.75), t, 0.1); add(drums, kick(1.0), t); kicks.append(t)
    add(drums, kick(1.0), 2.0); kicks.append(2.0); add(drums, kick(0.6), 3.0); kicks.append(3.0)
    for a, b_, g in [(3.0, 4.0, 0.45), (23.5, 24.0, 0.35), (27.0, 28.0, 0.5)]:
        t = a; k = 0
        while t < b_ - 1e-6:
            x = (t - a) / (b_ - a); add(drums, snare(g * (0.25 + 0.75 * x)), t, 0); k += 1
            t += step * (2 if x < 0.5 else 1 if x < 0.8 else 0.5)
    # la mélodie sifflée
    for bi in [6, 8, 12]:
        phrase = MOTIF['CG'] if BARS[bi] == 'C' else MOTIF['AmF']
        for off, m, du in phrase:
            t = bi * 2.0 + off * BEAT
            if 26.7 <= t: continue
            w = whistle(m, du * BEAT * 0.95, 0.13); add(lead, w, t, 0.1); add(send, w, t, 0, 0.5)
    # 28 s : l'accord final à la marimba, en arpège montant
    for j, m in enumerate([60, 64, 67, 72, 76, 79, 84]): add(keys, marimba(m, 0.18, 1.2), 28.0 + j * 0.035, -0.5 + j * 0.16)
    # pompe : la nappe, la basse et les touches s'effacent sous la grosse caisse
    duck = np.ones(N)
    for t in kicks:
        i = int(t * SR); n = int(0.3 * SR); e = 1 - 0.45 * np.exp(-np.arange(n) / SR / 0.09)
        duck[i:i + n] = np.minimum(duck[i:i + n], e[:max(0, min(n, N - i))])
    for x in (keys, low, lead): x *= duck
    add(send, keys, 0, 0, 0.18)
    return drums + keys + low + lead, send

def reverb_ir(rt=1.7, d=2.4):
    t = T(d); ir = np.vstack([noise(d), noise(d)]) * np.exp(-6.9 * t / rt)
    ir = np.vstack([lp(ir[0], 5200), lp(ir[1], 5200)]); ir[:, :int(0.012 * SR)] = 0
    return ir / np.sqrt((ir ** 2).sum() / 2)

def main():
    cues = json.load(open(os.path.join(HERE, 'cues.json')))
    fx, fx_send = sfx(cues)
    mus, mus_send = music()
    ir = reverb_ir()
    wet_src = fx_send + mus_send
    wet = np.vstack([signal.fftconvolve(wet_src[0], ir[0])[:N], signal.fftconvolve(wet_src[1], ir[1])[:N]]) * 0.22
    mix = mus * 0.85 + fx * 1.0 + wet
    mix = mix[:, :int(DUR * SR)]
    # fin : dernière demi-seconde en fondu, pour que le film se termine sans claquement
    n = int(0.5 * SR); mix[:, -n:] *= np.linspace(1, 0, n) ** 2
    mix = np.vstack([hp(mix[0], 28), hp(mix[1], 28)])
    mix /= np.abs(mix).max()
    mix = np.tanh(mix * 1.6) / np.tanh(1.6)
    mix *= 10 ** (-1.0 / 20) / np.abs(mix).max()
    wavfile.write(os.path.join(HERE, 'audio.wav'), SR, (mix.T * 32767).astype(np.int16))
    print('audio.wav', mix.shape[1] / SR, 's, rms', 20 * np.log10(np.sqrt((mix ** 2).mean())), 'dBFS')

if __name__ == '__main__':
    main()
