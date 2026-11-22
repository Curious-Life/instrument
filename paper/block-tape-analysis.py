"""Block-tape analysis for paper.md, section 3.2 ("Reading the deficit").

Input: a JSON list of session rows, each with sat, bits, iv, plat and
seg_tape (one digit per committed 8-bit block: its count of ones). The
session records are not public; this script documents exactly what was
computed. For each saturation band and each platform and pacing group it
prints the variance ratio of block sums at lengths from 8 to 1,024 bits,
and the autocorrelation of 8-bit block sums at lags 1 to 32.
Usage: python3 block-tape-analysis.py tapes.json
"""
import json, math, sys
rows = json.load(open(sys.argv[1]))
def band(r): return 'low' if r['sat'] / r['bits'] < 0.25 else 'high'
K = [1, 2, 4, 8, 16, 25, 32, 64, 128]          # blocks of 8 bits -> 8..1024 bits
acc = {}   # (group, k) -> [n, sum(d^2), sum(d)]
ac = {}    # (group, lag) -> [n, sum(x_i x_{i+lag})], x = blocksum-4
tot = {}
def groups(r):
    b = band(r)
    yield b
    yield b + ' ' + r['plat'] + ' iv' + str(r['iv'])
for r in rows:
    t = r['seg_tape']
    x = [ord(c) - 52 for c in t if '0' <= c <= '8']   # blocksum - 4
    n = len(x)
    for g in groups(r):
        tot.setdefault(g, [0, 0]); tot[g][0] += 1; tot[g][1] += n
        for k in K:
            a = acc.setdefault((g, k), [0, 0.0, 0.0])
            for i in range(0, n - k + 1, k):
                d = sum(x[i:i + k]); a[0] += 1; a[1] += d * d; a[2] += d
        for lag in range(1, 33):
            a = ac.setdefault((g, lag), [0, 0.0])
            m = n - lag
            if m > 0:
                a[0] += m; a[1] += sum(x[i] * x[i + lag] for i in range(m))
for g in sorted(tot):
    if tot[g][1] < 40000: continue
    print('\n==', g, 'sessions', tot[g][0], 'blocks', tot[g][1])
    line = []
    for k in K:
        n, s2, s1 = acc[(g, k)]
        vr = (s2 / n - (s1 / n) ** 2) / (2 * k)
        line.append('%d bits: %.3f (±%.3f)' % (8 * k, vr, math.sqrt(2 / n)))
    print('  variance ratio by block length: ' + '; '.join(line))
    print('  block-sum autocorrelation, lags 1..32 (x1000; SE %.1f):' % (1000 / math.sqrt(ac[(g, 1)][0])))
    print('   ' + ' '.join('%+.0f' % (1000 * ac[(g, l)][1] / ac[(g, l)][0] / 2) for l in range(1, 33)))
