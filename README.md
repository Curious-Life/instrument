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
