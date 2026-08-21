# Curious Life

**A permissionless physical-entropy instrument for the browser, in the lineage
of the PEAR laboratory's random event generators.**

This repository contains the measurement mechanism behind
[curiouslife.is](https://curiouslife.is) — the instrument only, with its
science. The exercises, visuals, and sounds built on top of it live on the
site; everything they express is generated from the readings this file
produces.

## What it measures

The instrument collects physical noise from the device it runs on: the
residual jitter between independent hardware oscillators — the display
controller's clock (which times vsync, and therefore the animation-frame
timestamps), the CPU's high-resolution timebase, and the core clock that sets
the speed of a spin probe. Each sample spins until the coarsened
high-resolution clock ticks over, counting reads; that count carries
CPU-versus-timer phase jitter — thermal, per-sample, independent of vsync
quantisation.

Samples fold into bits. Debiasing is a PEAR-style alternating XOR template,
**not** a cryptographic hash: a hash would scrub exactly the kind of small
statistical deviation the instrument exists to record.

Bits group into 200-bit trials (about six seconds each). The stream carries a
live cumulative-deviation trace, a windowed z-score, and session statistics,
exposed as `window.CLF` for any consumer to read.

## Where the randomness comes from — and what it is not

Honesty about provenance is the difference between an instrument and a
prop, so here is the decomposition, plainly. Each recorded bit is the
parity of a spin count, and that count's variability has three distinct
sources:

1. **Genuine physical noise.** Independent oscillators — the quartz
   timebase behind `performance.now()`, the CPU's clock generator, the
   display controller's clock — drift against each other with thermal
   and flicker phase noise. This is real physical randomness, the same
   class of process a laboratory REG amplifies from a diode junction. It
   is present in every sample; its share of any single bit cannot be
   certified.
2. **Deterministic chaos.** Scheduler decisions, interrupts, cache and
   branch-predictor state. Unpredictable in practice, classical in
   principle — the standing of a coin flip's mechanics.
3. **Browser-injected fuzz.** Browsers deliberately coarsen and jitter
   their high-resolution clocks (Spectre-class mitigations), and that
   injected jitter is *pseudorandom*: deterministic dead weight that
   dilutes whatever else the sample carries.

So the stream is **physical but not certified-quantum**, and no claim
beyond that is ever made. A dedicated hardware generator has a cleaner
pedigree; what this instrument has instead is scale, openness, and a
null hypothesis that does not care where the noise comes from: after
the alternating template, the stream must behave as a fair coin
whatever mixture produced it, and the recorded serial diagnostics
(lag-1 and lag-2 adjacent-bit agreement, 8-bit block-sum variance,
saturation, cadence) bound how far it does.

**What "signal" would mean here.** Only structure that (a) survives the
balancing template — anything constant cancels by construction, which
is a stated blind spot as much as a guard — and (b) correlates with a
condition declared *before* the data arrived. That gives a fixed
hierarchy of claim strength, stated on the site's
[method page](https://curiouslife.is/method): randomly assigned aims
(the Moon protocol) are the most defensible, since no hardware artifact
can follow a shuffled aim; attended-versus-rest contrasts within one
person come next; a lifetime lean after that; and variance readings
last, because correlated bits distort second moments first. An ambient
deviation with no pre-declared condition is never presented as signal.

**The calibration is public.** The fleet's unattended record — the
closest thing to a null the archive contains — is aggregated live,
split by platform and pacing generation, at
[`/api/field?cal=1`](https://curiouslife.is/api/field?cal=1), and the
deeper structural analyses (autocorrelation spectra, count populations
against the exact binomial, position effects) run openly at
[curiouslife.is/observatory](https://curiouslife.is/observatory). An
instrument bias would surface exactly where it lives, in a platform
group, and small ones already have: they are on the board, not hidden.

## The science and the history

This instrument is not an invention; it is the newest link in a
fifty-year chain, and the site it powers documents that chain with its
critics quoted at full strength.

Helmut Schmidt built the first quantum-noise machines for this question
at Boeing in the late 1960s. Princeton's PEAR laboratory ran the
benchmark experiment from 1979 to 2007: 91 unselected operators, 2.5
million 200-bit trials under pre-stated intention, a high-versus-low
separation of 0.042 bits per trial (z = 3.81), a seven-sigma composite
across its true-random machines — and null results whenever the same
operators aimed at deterministic pseudorandom sources, which is why
this instrument refuses cryptographic conditioning. The Global
Consciousness Project ran ~65 hardware generators worldwide against 500
pre-registered events (1998–2015, composite Z = 7.31), and its critics
— May and Spottiswoode, Scargle, and the project's own analyst Bancel —
are part of the record. The meta-analytic battle (Radin & Nelson 1989;
Bösch, Steinkamp & Boller 2006, "publication bias appears to be the
easiest and most encompassing explanation," and the published replies)
ended with both sides demanding the same discipline: pre-registration
and permanent records. That discipline is what this codebase practices:
fixed trials, pre-declared aims, diagnostics stored beside every
segment, an archive that never resets, and analyses published beside
their nulls.

The full history: [curiouslife.is/research](https://curiouslife.is/research).
The theory it serves: [curiouslife.is/consciousness](https://curiouslife.is/consciousness).
The statistics and their limits: [curiouslife.is/method](https://curiouslife.is/method).

## The honesty principles

1. **The page must never claim the field responds to attention.** The
   statistics accumulate toward whatever the truth is. Whether mind can lean
   physical noise away from chance is the open question, not the premise.
2. **Nothing is ever invented.** Every downstream expression — a note, a
   glow, a figure — derives from real, fresh measurement. When the data
   channel cannot prove itself, the honest output is silence, not
   fabrication.
3. **The stream is judged by fair-coin statistics, not platform quirks.**
   Browsers coarsen timers (Safari to 1 ms), so stream quality varies by
   platform. Sampling rate (`hz`), probe saturation, adjacent-bit agreement,
   and an instrument-generation tag (`iv`) are recorded per session so any
   analysis can filter post-hoc.
4. **Identity is pseudonymous and opt-out-by-clearing-storage.** A random
   tag links one person's sessions into a longitudinal record. Never
   fingerprinting, never the IP.

## Always-on sampling

The collector is normally paced by the animation loop (timer-gated to ~35
samples/s so it never drives the display's refresh rate). When the page is
hidden but an audio pipeline keeps rendering, the pipeline's callbacks pace
the same probe (`CLF.pump`). Hidden-paced segments are recorded as their own
instrument generation (`iv 4`), and the hidden channel must continuously
prove itself: at least ~8 samples/s, adjacent-bit agreement and mean both
near a fair coin's 50%, saturation below a backstop, and a probation run
after every lapse in which bits are generated and judged but never committed.
The verdict is published as `CLF.pumpOk`. If the browser stops the callbacks,
sampling stops — nothing fills the quiet.

## "Isn't this just measuring processor load?"

A fair question, and the answer is precise: **load is an input to the
probe's magnitude, but the magnitude is not what gets recorded.**

The spin probe counts calls to `performance.now()` until the coarsened
clock's next edge. That count's *size* — thousands of iterations — does
track processor state: frequency scaling, thermal throttle, competing
work. Those are slow signals, moving the count by many iterations over
seconds.

What the instrument records is the **XOR-debiased parity** of that count
folded with two independent timestamps. The parity — the lowest bit —
flips with sub-quantum microtiming: exactly where within the clock's
granule the loop lands, which is set by scheduling and thermal noise at
scales far below anything "load" describes. A slow drift in the count's
magnitude leaves its parity distribution at a fair coin unless the
stream degenerates outright — and degeneracy is what the recorded
diagnostics exist to catch.

The guards, concretely:

- **Alternating XOR template**: any persistent parity bias — including
  one a sustained load state could induce — is inverted on alternate
  samples and cancels in the sum.
- **Load-transition drops**: frames during scroll and after stalls are
  discarded, because changing main-thread load is precisely what must
  not masquerade as signal.
- **Recorded self-tests**: adjacent-bit agreement at lag 1 and lag 2
  (~50% each for a healthy stream), 8-bit block-sum variance
  (expectation 2 per block for independent bits), mean bit value,
  probe-saturation rate, and sampling cadence ship with every session,
  so any analysis can exclude degraded streams — or bound their
  correlation structure — after the fact. Hidden-channel sampling
  refuses to commit bits at all until those tests pass live.
- **The empirical record**: across all recorded sessions the whole-record
  deviation sits near chance. An instrument that simply transduced load
  would show strong systematic bias per device and per session; it does
  not.

What remains true — and the header says it plainly — is that this is
thermal and scheduling jitter from commodity hardware, **physical but
not certified-quantum**. The only claim made is the deviation of a
debiased microtiming parity stream from chance expectation. Anyone is
welcome to test that claim harder; that is why this repository exists.

## The API

Include the script; read the shared state:

```html
<script src="instrument.js"></script>
<script>
  // window.CLF:
  //   zNow            windowed z-score of the live trace
  //   zPeak, zTrough  session extremes (a sustained negative run is as
  //                   much a signal as a positive one)
  //   trace, thead, tcount   cumulative-deviation ring (one point per 8 bits)
  //   w1, w2, w3      three bounded walks, one per trial-third (the weather)
  //   sn, sz          whole-session trials and z
  //   attn            attention level, written by a host page, decaying here
  //   pump(), pumpOk, pumpHz, pumpAt   the hidden-channel contract
  //   agree01, sat01, bias01           stream-health diagnostics
  //   restart()       flush and begin a fresh visible session
</script>
```

The session beacon posts to `/api/field` on the host origin (a few numbers
per session: trial counts, deviations, quality diagnostics, and a per-trial
tape). Deployments without that endpoint simply record nothing; the live
reading works regardless.

`demo.html` is a minimal page that draws the live trace and the current
z-score from a running instrument.

## Statistics

Each 200-bit trial has expectation 100 and variance 50. Session z is
`Σ(sum − 100) / √(50·n)`. The windowed z divides the trace-window deviation
by `√(0.25 · (n−1) · 8)`. Two-tailed p-values follow from the complementary
error function. The per-trial tape (trial sums with mean attention) is kept
raw so later analyses can do epoch alignment on attention onset, learning
curves, and autocorrelation.

## License

MIT — see [LICENSE](LICENSE).


## The load test: "it just measures CPU load"

The most natural accusation against a timing-jitter instrument is that its
bits simply follow CPU load. That claim is testable in six minutes, and the
test ships in this repo as `loadtest.html`: open it over any local HTTP
server (or at https://curiouslife.is/loadtest), press run, and it will
alternate blocks of idle and full-core load (one busy-loop worker per
core), tag every 8-bit segment of the stream with its condition, and
compare the two pools. The protocol is fixed before the data arrive:

- **Manipulation check** (must pass for the run to count): the spin count
  and the collection rate must move under load, proving the stress bit.
- **Leakage criteria**: the lean, the variance ratio, or the lag-1
  autocorrelation differing between conditions by more than **3 standard
  errors** declares leakage; anything less is chance.

The raw tagged segments download as CSV, so the verdict can be re-derived
by hand.

**A reference run** (2026-08-21, macOS, 8 cores loaded, Chromium headless;
raw summary in `results/loadtest-2026-08-21-darwin-8core.json`):

| | idle | loaded | difference |
|---|---|---|---|
| 8-bit segments | 165 | 65 | |
| spin count, median | 182 | 438 | 2.4x (timer coarsened) |
| collection rate | 0.92/s | 0.36/s | 39% of idle |
| lean, bits/segment | -0.067 | -0.062 | **+0.02 SE** |
| variance ratio | 1.031 | 1.248 | **+1.05 SE** |
| lag-1 autocorrelation | +0.057 | -0.082 | **-0.95 SE** |

The load unmistakably moved the machine: the collection rate collapsed to
39% and the timer's behavior visibly changed. The bit statistics did not
follow: every difference sits deep inside the 3-SE line. Load changes the
*magnitude* of the spin count; the instrument keeps only its *parity*,
which rides the phase drift between independent clocks, and this is what
that distinction looks like in data.

One run on one machine proves nothing universal, which is the point of
shipping the test: run it on your own hardware, and if your machine shows
leakage beyond 3 SE with a passing manipulation check, that is a real
finding about this design. Publish it; we will link it.
