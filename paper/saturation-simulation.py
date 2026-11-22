"""Saturation simulation for paper.md, section 3.2 ("Reading the deficit").

Runs the instrument's own bit arithmetic (instrument.js, probeBit) on a
simulated clock to ask one question: when the spin count saturates and the
browser reports time in whole milliseconds, does the timestamp term alone
produce the periodic structure seen in the recorded block tapes?

Assumptions, all stated in the paper: sample times sit on a steady clock
with a small jitter that does not accumulate; timestamps are whole
milliseconds; a sample saturates when more of the current millisecond is
left than the capped spin can cover. Seeds are fixed, so the output is
reproducible. Standard library only: python3 saturation-simulation.py
"""
import random, math
def parity(x):
    x &= 0xffffffff
    x ^= x >> 16; x ^= x >> 8; x ^= x >> 4; x ^= x >> 2; x ^= x >> 1
    return x & 1
def run(step_ms, cap_ms, jit, n=1_600_000, seed=1, drift=0.0):
    rnd = random.Random(seed)
    t0 = rnd.random() * 1000; prev = math.floor(t0); tm = 0; bits = []; sat = 0
    for i in range(1, n + 1):
        t = t0 + i * step_ms * (1 + drift) + rnd.gauss(0, jit)
        ts = math.floor(t); d = ts - prev; prev = ts
        left = 1 - (t - ts)                       # ms until the clock ticks
        if left > cap_ms: c = 8192; sat += 1
        else: c = int(left / cap_ms * 8192 * (1 + rnd.gauss(0, 0.02)))
        x = c ^ ((ts * 1000) & 0xffff) ^ (d * 1000)
        tm ^= 1; bits.append(parity(x) ^ tm)
    return bits, sat / n
def report(name, res):
    bits, sat = res
    x = [sum(bits[i:i + 8]) - 4 for i in range(0, len(bits) - 7, 8)]
    n = len(x)
    ac = [sum(x[i] * x[i + l] for i in range(n - l)) / (n - l) / 2 for l in range(1, 33)]
    out = []
    for k in (1, 2, 4, 8, 16, 25, 32, 64, 128):
        s = [sum(x[i:i + k]) for i in range(0, n - k + 1, k)]
        m = sum(s) / len(s); out.append('%d: %.3f' % (8 * k, (sum(v * v for v in s) / len(s) - m * m) / (2 * k)))
    a1 = sum(1 for i in range(1, len(bits)) if bits[i] == bits[i - 1]) / (len(bits) - 1)
    a2 = sum(1 for i in range(2, len(bits)) if bits[i] == bits[i - 2]) / (len(bits) - 2)
    print('\n==', name, ' saturated %.2f  lag1 %.4f lag2 %.4f' % (sat, a1, a2))
    print('  vr by length:', '; '.join(out))
    print('  block autocorr x1000:', ' '.join('%+.0f' % (1000 * a) for a in ac))
report('hidden: 42.667 ms steps (2 audio buffers), jitter 0.15 ms', run(128/3, 0.65, 0.15))
report('hidden: 42.667 ms steps, jitter 0.5 ms', run(128/3, 0.65, 0.5, seed=4))
report('visible: 33.333 ms steps (2 frames), jitter 0.3 ms', run(100/3, 0.65, 0.3, seed=2))
report('fine timer (never saturates): 42.667 ms, cap 5 ms', run(128/3, 5.0, 0.15, seed=3))
