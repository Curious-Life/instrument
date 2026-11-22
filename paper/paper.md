# A browser-based clock-jitter random event generator: design, diagnostics and calibration

**Martin Balodis** · Curious Life (SIA "Curious Life", Riga, Latvia) · martin@curiouslife.is · ORCID [0009-0001-2010-2480](https://orcid.org/0009-0001-2010-2480)

*Version 1.0, 22 November 2026. doi:10.5281/zenodo.24438518*

*Describes release v1.0.0 of github.com/Curious-Life/instrument, archived at doi:10.5281/zenodo.24438226. Calibration figures were computed on 22 November 2026.*

---

## Abstract

We describe an open-source instrument that collects physical timing noise in an ordinary web browser and turns it into a bit stream for mind–matter interaction experiments in the tradition of the PEAR laboratory's random event generators. Each sample counts how many clock reads fit before the browser's high-resolution timer advances. The count is folded with two timestamps into one bit, and an alternating XOR template balances the stream. No cryptographic conditioning is applied, and a control stream from the platform's whitened generator runs in lockstep through the same pipeline. We report two calibrations. In a load-leakage test with criteria fixed in advance, full load on eight cores changed the raw spin count by a factor of 2.5 while the bit statistics stayed within one standard error of idle. Across 5,288 sessions from 270 devices with no declared aim (219,474 trials of 200 bits), the mean sits at chance in every platform group (pooled z = −1.38) and so does the control (z = −0.52). Trial variance is below the fair-coin value, and the deficit is confined to sessions in which the spin probe often reaches its cap, as it does on browsers with a 1 ms timer. In sessions where fewer than a quarter of samples saturate, the variance ratio is 0.992, lag-1 and lag-2 agreement are 0.4997 and 0.4998, and 8-bit block variance is 0.997 of its expectation. In the rest the variance ratio is 0.832. The stored block record and a simulation trace this to the timestamp term, which repeats every 8.2 seconds when the probe saturates. Tests on the mean are supported throughout. Tests on variance are supported only where saturation is low. Three people hold 82% of the record, the author among them, so it describes a few devices in depth and many briefly.

## 1. Background

Experiments on whether intention can shift the output of a physical random source go back to Schmidt's work in the late 1960s (Schmidt 1970) and the PEAR programme of 1979–2007 (Jahn et al. 1997), and continue in the Global Consciousness Project (Nelson & Bancel 2011). The record is contested. Large cumulative effects in early databases sit beside null results in the strictest replications (Jahn et al. 2000; Maier et al. 2018), and both sides of the meta-analytic debate (Radin & Nelson 1989; Bösch et al. 2006) have asked for the same remedies: pre-stated hypotheses, fixed trial structure and permanent records.

Dedicated hardware generators have a clean physical pedigree but reach few people. A browser reaches many, at the cost of a noise source whose composition can't be certified. Timing jitter has been used as an entropy source in operating systems for two decades (Seznec & Sendrier 2003; Müller 2014), and the technique of counting clock reads up to a timer edge is known from browser security research, where it recovers resolution that browsers deliberately remove (Kohlbrenner & Shacham 2016; Schwarz et al. 2017). Those systems condition their output with a hash, because they need unpredictability. This instrument needs the opposite property, a stream whose small statistical deviations survive to be measured, so it is left unconditioned and its faults are measured instead. This paper documents the instrument so that others can inspect, test and reuse it.

## 2. The instrument

### 2.1 Noise source

The instrument reads the residual jitter between independent oscillators in the host device: the timebase behind `performance.now()`, the CPU clock that sets the speed of a short spin loop, and the display controller's clock that times animation frames. The variability of each sample has three contributors:

1. **Physical phase noise** (thermal and flicker) between the oscillators.
2. **Deterministic but unpredictable system state**: scheduling, interrupts, cache and branch-predictor state.
3. **Browser-injected timer jitter**, added as a security mitigation, which is pseudorandom.

The share of each in a given bit is unknown. We describe the stream as physical but not certified-quantum, and the analysis treats it only as a candidate fair coin.

### 2.2 Sampling

Sampling is paced by a 25 ms timeout followed by an animation-frame callback, which gave about 28 samples per second in the record of section 3.2. A frame is discarded if the interval since the previous frame falls outside 2–80 ms, or if the page scrolled within the last 120 ms, since changing main-thread load is the most obvious artefact.

For each accepted frame the probe records the current value of `performance.now()` and counts further reads until the value changes, up to a cap of 8,192. Reaching the cap is logged as saturation. A saturated sample carries no information from the spin count.

### 2.3 From sample to bit

The spin count is combined by XOR with the frame timestamp (in microseconds, low 16 bits) and the frame interval (in microseconds). The resulting word is reduced to one bit, its parity, by XOR of all its bits. That parity is then XORed with a template bit that alternates on every sample. No hash or other cryptographic conditioning is applied, because conditioning would remove the small statistical deviations the instrument exists to record.

The template has three consequences that matter for everything below.

- **A constant bias cancels in the mean.** If the raw parity is 1 with probability p, successive output bits have means p and 1 − p, and every pair sums to 1 on average.
- **The same bias lowers the variance.** Each output bit still has variance p(1 − p), so a 200-bit trial has variance 200·p(1 − p), which is below the fair-coin 50 by the factor 4p(1 − p). The template turns a raw bias into under-dispersion. Such a bias would also raise lag-2 agreement above one half, to p² + (1 − p)².
- **Odd lags are inverted and even lags are untouched.** Agreement between output bits one sample apart is one minus the agreement between the raw parities. At a lag of two samples the template cancels and the output shows the raw structure directly.

### 2.4 Trials and live statistics

Bits are grouped into 200-bit trials (expectation 100, variance 50), each lasting about seven seconds at that rate. The session score is

z = Σ(sum − 100) / √(50·n)

over n trials. A live trace holds the cumulative deviation Σ(bit − 0.5), one point per 8 bits, in a ring of 240 points (about one minute). The windowed score divides the deviation across the window by √(0.25 · 8 · (points − 1)).

### 2.5 Control channel

A second stream is drawn from `crypto.getRandomValues` and passed through the same alternating template, trial structure and condition tags, one control bit for every jitter bit. A control trial counts only when all 200 of its bits were drawn. Because that generator is cryptographically whitened, the control should stay at chance in mean and in variance. A departure in the jitter channel that the control does not share is therefore not produced by the pipeline's arithmetic.

### 2.6 Diagnostics stored with each session

- Sampling rate, dropped frames, stalls and saturation count.
- Adjacent-bit agreement at lag 1 and lag 2 (about 50% each for an independent stream).
- Variance of 8-bit block sums (expectation 2).
- Per-trial tape: trial sum, condition tag and wall-clock second.
- Per-block tape: the count of ones in each 8-bit block.
- A pacing-generation tag, so that sessions paced differently can be separated.

### 2.7 Other pacers

The same probe can be paced by two other clocks. Each has its own generation tag, and a recorded segment carries exactly one tag: a change of pacer closes the segment.

**Hidden page (generation 4).** When the page is hidden and an audio pipeline keeps running, its callbacks pace the probe, at least 20 ms apart. In the record this ran at about 23 samples per second. This channel commits bits only while it meets live health conditions: at least about 8 samples per second, running lag-1 agreement between 16% and 84%, running mean between 25% and 75%, running saturation below 95%, and a 16-sample probation after any lapse. A gap of 400 ms or more counts as a lapse.

**Throttled frames (generation 5).** Some browsers deliver only a few animation frames per second on heavy pages, and then no frame passes the 2–80 ms window. When refused frames outnumber accepted ones six to one for three consecutive seconds, a 31 ms timer paces the probe under the same health conditions, with a 48-sample probation. It stops as soon as frames return.

Visibly paced sampling (section 2.2) is generation 3. A session longer than five minutes is saved in checkpoints that the server merges into one record.

### 2.8 Data and privacy

Each device is identified by a random 96-bit tag kept in a first-party cookie and local storage. Clearing storage removes it. Each session record stores the statistics above with the browser's user-agent string, the country reported by the content network, the timezone offset, the screen size and the core count. IP addresses are not stored. Everything published is an aggregate, and no published group summarises fewer than three devices. The data policy is at curiouslife.is/privacy. This work had no institutional ethics review. Data were collected under the site's data policy, and only aggregates are reported.

## 3. Calibration

### 3.1 Load-leakage test

The most natural objection to a timing-based source is that its output follows processor load. The repository includes a test for this (`loadtest.html`). It alternates idle blocks with blocks in which one busy-loop worker runs per core, tags every 8-bit segment by condition, and compares the pools.

Criteria were fixed before data collection:

- **Manipulation check:** the median spin count has to change by a factor of more than 1.4 under load, or the collection rate has to fall by 15%, for the run to count.
- **Leakage:** a difference between conditions of more than 3 standard errors in mean lean, variance ratio or lag-1 autocorrelation of the 8-bit segment sums.

**Reference run** (22 August 2026; macOS, 8 cores, Chromium headless):

| | Idle | Loaded | Difference |
|---|---|---|---|
| 8-bit segments | 667 | 669 | |
| Spin count, median | 186 | 465 | 2.5× |
| Collection rate (segments/s) | 3.71 | 3.72 | unchanged |
| Lean (bits per segment) | +0.072 | +0.021 | −0.66 SE |
| Variance ratio | 0.958 | 0.979 | +0.26 SE |
| Lag-1 autocorrelation | −0.041 | +0.001 | +0.78 SE |

Load changed the magnitude of the spin count clearly, and none of the three bit statistics moved by as much as one standard error.

The test is small. With about 5,300 bits in each condition, the 3-standard-error line for the lean corresponds to a shift of about 2.9 percentage points in the probability of a 1. The run rules out leakage of that size on that machine and says nothing about smaller effects. It is one run on one machine, in a browser whose timer is fine enough that the probe never saturates. The test ships with the code so that it can be repeated on other hardware, and results that show leakage are as useful as those that don't.

### 3.2 Fleet calibration

**The record.** The site stores every session. For calibration we take sessions recorded on pages with no directed exercise, excluding headless browsers. On 22 November 2026 that was 5,288 sessions from 270 devices, recorded between 8 August and 21 November 2026: 219,474 trials, 43.9 million bits, 882 hours of session time. While sampling, the stream ran at about 28 bits per second in visibly paced sessions and 23 in hidden-paced ones. Session time also includes stretches with no sampling, such as a tab left open in the background, so the record averages 14 bits per second of session time (11 visibly paced, 19 hidden-paced). The mean is tested on the 218,561 trials not flagged as attended by the page. Dispersion and serial statistics use all 219,474. The control channel began on 21 August and has 185,371 trials.

**What this record is not.** Four facts limit how it should be read.

- **It is concentrated.** Devices that share a login are merged into 267 people. One person holds 50% of the trials, three hold 82% and ten hold 92%. Nine people have 1,000 trials or more. The largest records come from the author's own devices.
- **"No declared aim" does not mean nobody was present.** The pages include background listening with a locked screen, which is where almost all generation 4 trials come from.
- **Page tags were faulty from 9 September to 28 October 2026.** In that period some sessions recorded during exercises were filed under a general page tag and are in this record. 124,588 of the trials were recorded in that window, though most of them were not affected. In the same period the mobile app ran two copies of the instrument at once, and both were recorded.
- **Generation tags were imprecise before 17 October 2026.** A segment kept the tag it started with, so some hidden-paced trials are filed under generation 3.

None of these affects whether the stream behaves as a fair coin, which is the question here. All of them would matter for any claim about people.

**By platform and pacing.** Groups with fewer than three devices are folded into "small groups".

| Platform | Gen. | Devices | Sessions | Trials | Mean z | Variance ratio | Lag-1 | Lag-2 | Block var. | Saturation | Control z |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Android | 3 | 47 | 279 | 2,915 | −0.40 | 0.990 | 0.500 | 0.499 | 0.995 | 0.000 | +0.14 |
| Android | 4 | 9 | 22 | 158 | −1.95 | 1.115 | 0.499 | 0.501 | 1.027 | 0.000 | −0.17 |
| Windows | 3 | 16 | 39 | 510 | +0.08 | 0.946 | 0.498 | 0.500 | 0.996 | 0.004 | +1.93 |
| iOS | 3 | 145 | 1,962 | 52,491 | −0.30 | 0.944 | 0.497 | 0.501 | 0.986 | 0.343 | +0.14 |
| iOS | 4 | 13 | 487 | 112,165 | −1.68 | 0.851 | 0.499 | 0.499 | 0.960 | 0.235 | −0.60 |
| macOS | 3 | 61 | 2,350 | 47,939 | −0.20 | 0.943 | 0.495 | 0.500 | 0.987 | 0.430 | −0.29 |
| macOS | 4 | 7 | 73 | 2,468 | +1.33 | 0.989 | 0.496 | 0.500 | 0.948 | 0.395 | −1.25 |
| Small groups | mixed | | 76 | 828 | +0.30 | 0.975 | 0.500 | 0.498 | 1.032 | 0.000 | +0.41 |
| **All** | | **270** | **5,288** | **219,474** | **−1.38** | | | | | | **−0.52** |

*Mean z is the deviation of the unattended trials from chance. Variance ratio is trial variance over the fair-coin value of 50. Lag-1 and lag-2 are adjacent-bit agreement (0.5 for independent bits). Block variance is the 8-bit block-sum variance over its expectation. Saturation is the share of samples reaching the spin cap. The "All" row pools the deviations of all groups. A device can appear in more than one group. These figures are served live at curiouslife.is/api/field?cal=1. Until 22 November 2026 that endpoint divided lag-2 counts by the bits of all sessions, including sessions recorded before the count existed, and so reported lag-2 agreement as low as 0.32. The values here use the correct denominator.*

**What holds everywhere:**

- **The mean is at chance.** No group departs from chance by two standard deviations, and the pooled record stands at z = −1.38. These values are nominal: they assume the fair-coin spread. Dividing by each group's observed spread instead moves hidden-paced iOS from −1.68 to −1.83, hidden-paced Android from −1.95 to −1.84 and the pooled record to −1.46. No group reaches two either way.
- **The control is at chance** (pooled z = −0.52), so the pipeline's arithmetic adds no lean of its own.
- **Lag-2 agreement is 0.50** in every group.

**What does not hold everywhere:**

- **Trial variance is below the fair-coin value on Apple platforms.** The ratio is 0.94 for visibly paced iOS and macOS sessions, about nine standard errors below 1, and 0.85 for hidden-paced iOS sessions, about 35 standard errors below 1.
- **Lag-1 agreement is slightly below 50% on the same platforms** (0.495 to 0.499). The gap is small but far outside sampling error in the three groups with about ten million bits or more.
- **These are the platforms where the probe saturates.** Safari reports time in steps of 1 ms, and between a quarter and two fifths of samples there reach the spin cap. On Android and Windows almost none do.

**By saturation.** Splitting the same record by each session's share of saturated samples separates the two behaviours. (72 early sessions with 789 trials stored no bit counts and are left out.)

| Saturated samples | Sessions | Devices | Trials | Mean z | Variance ratio | Lag-1 | Lag-2 | Block var. | Control z | Control variance ratio |
|---|---|---|---|---|---|---|---|---|---|---|
| Below 25% | 1,719 | 174 | 89,788 | −1.26 | 0.992 | 0.4997 | 0.4998 | 0.997 | +0.24 | 1.001 |
| 25% or more | 3,497 | 149 | 128,897 | −0.75 | 0.832 | 0.4961 | 0.4998 | 0.950 | −0.92 | 0.998 |

Below 25% saturation the variance ratio is 0.992, which is 1.7 standard errors below 1, and the figure is the same in every group with more than 2,000 trials: 0.993 for visibly paced iOS, 0.992 for hidden-paced iOS, 0.991 for macOS and 0.990 for Android. A small residual remains in this band, where block variance is 0.3% low (about three standard errors).

At 25% or more the variance ratio is 0.832, about 43 standard errors below 1, and lag-1 agreement is 0.4961, about 40 standard errors below one half. The control channel's variance ratio is 0.998 in the same sessions, so the deficit belongs to the jitter stream and not to the pipeline. The size of the deficit differs by platform and pacing within this band, from 0.71 for hidden-paced iOS to 0.93 for visibly paced macOS, and it does not rise steadily with the share of saturated samples. One small group, hidden-paced macOS with 1,858 trials, shows the deficit in its 8-bit blocks (0.93) but not in its trials.

**Reading the deficit.** Three observations locate it.

*It is not a raw bias.* By section 2.3, a bias large enough to give a variance ratio of 0.83 would raise lag-2 agreement to about 0.585. It is 0.4998.

*It is periodic.* The per-block tape was stored for 3,539 of these sessions (4.1 million blocks). The table gives the variance ratio of sums over runs of increasing length.

| Saturated samples | 8 bits | 16 | 32 | 64 | 128 | 200 | 512 | 1,024 |
|---|---|---|---|---|---|---|---|---|
| Below 25% | 0.997 | 0.998 | 0.996 | 0.995 | 0.989 | 0.992 | 0.998 | 1.015 |
| 25% or more | 0.953 | 0.984 | 1.051 | 1.142 | 0.977 | 0.831 | 0.833 | 0.814 |

Below 25% saturation the ratio stays within about 1% of 1 at every length, and the 8-bit block sums show no autocorrelation beyond ±0.002 at any lag from 1 to 32 blocks. At 25% or more the ratio dips, rises above 1 at 32 and 64 bits, and then falls to 0.83 at 200. The block sums are correlated with a period of 24 blocks. In hidden-paced iOS sessions, where the pattern is strongest, the correlation is +0.13 at a lag of 3 blocks, −0.21 at 12 and +0.18 at 24.

*The period is the timestamp's.* When a sample saturates, the spin count is the constant 8,192 and the bit is the parity of a timestamp that the browser reports in whole milliseconds, scaled to microseconds and cut to 16 bits. That quantity repeats exactly every 8.192 seconds (1,000 × 8,192 = 125 × 65,536). Hidden pacing takes about 23 samples per second, so one period spans about 190 samples, or 24 blocks. A simulation of the instrument's arithmetic under these conditions (a steady 42.67 ms pace, whole-millisecond timestamps, 35% of samples saturated; `paper/saturation-simulation.py`) reproduces the pattern: correlations of +0.11, −0.17 and +0.16 at lags of 3, 12 and 24 blocks, and variance ratios of 1.10 at 64 bits and 0.85 at 200. The same simulation with a timer fine enough never to saturate shows neither.

A 200-bit trial lasts close to one period, so the periodic part largely cancels inside each trial and the trial sums come out too narrow. The deficit is therefore specific to the trial length: shorter sums from the same sessions are over-dispersed. In visibly paced sessions the pace is less steady, and the pattern is weaker and less regular.

**Consequences.**

- Under-dispersed trials make the nominal z for a mean test slightly conservative, since the true spread is narrower than the formula assumes. In the high-saturation band the correction is about 10% (a nominal −0.75 becomes −0.82). Mean tests are supported in both bands, and a test that matters should use the observed spread of its own stratum.
- Variance-based statistics are biased wherever saturation is high, by an amount and in a direction that depend on platform, pacing and the length of the sum. They should be computed only on sessions below 25% saturation, and compared within platform and generation.
- The stored saturation count makes this filter available for every session already recorded.
- The obvious remedies are to discard saturated samples at the source, or to take the timestamps out of the fold. Either would be a new generation with its own tag, and neither is part of the release described here.

## 4. Limits

- **Provenance.** The physical share of each bit can't be certified, and browser timer fuzzing adds pseudorandom content.
- **Saturated samples.** On browsers with a 1 ms timer a large share of samples rest on timestamp parity alone. That parity is periodic, and sessions dominated by it are under-dispersed at the trial length (section 3.2).
- **Blind spot.** The alternating template cancels any constant influence on the raw parity, so an effect of that form would go unseen.
- **Concentration.** Three people hold 82% of the calibration record, and the largest records are the author's own. The low-saturation result rests on 174 devices, but the hidden-paced iOS groups rest on 13.
- **Selection of the calibration record.** It is defined by page tags that were faulty for seven weeks, and it includes sessions in which a person was present and listening.
- **Platform variation.** Stream quality differs by browser and by pacing mode. Diagnostics are stored so analyses can filter and stratify.
- **Rate.** At under 30 bits per second while sampling, and about half that over a whole session, an effect of the size reported in the literature (around one part in ten thousand per bit) would take a very long time to show in one person.
- **Scope of validation.** The load test covers processor load on one machine, with sensitivity of about three percentage points per bit. Device temperature, supply voltage and nearby radio activity have not yet been tested as inputs.

## 5. What would count as a signal

Structure in the stream is treated as a candidate signal only if it survives the template and tracks a condition declared before the data arrived. In order of strength:

1. Trials under randomly assigned aims: the pre-stated intention of Jahn et al. (1997), with the aim for each trial drawn at random.
2. Attended versus rest within one person.
3. A long-run lean in one person's record.
4. Variance readings, which section 3.2 supports only in sessions with low saturation.

A deviation with no pre-declared condition is not presented as a signal.

## 6. Availability

- **Code:** github.com/Curious-Life/instrument, MIT licence, release v1.0.0. Archived release: doi:10.5281/zenodo.24438226.
- **Load-test data:** `results/loadtest-2026-08-22-darwin-8core.json` in the repository.
- **Calibration queries and scripts:** in the repository, `paper/calibration-queries.sql` gives the exact selection and formulas behind the calibration tables, `paper/block-tape-analysis.py` the block-length analysis, and `paper/saturation-simulation.py` the simulation. Session records are not public. The platform table is served live as aggregates at curiouslife.is/api/field?cal=1, and further analyses at curiouslife.is/observatory.

## Acknowledgement

AI tools (Claude, Anthropic) assisted with drafting, code review and the calibration analysis. The author checked the results and is responsible for the content.

## References

- Bösch, H., Steinkamp, F. & Boller, E. (2006). Examining psychokinesis: the interaction of human intention with random number generators. A meta-analysis. *Psychological Bulletin* 132(4):497–523. doi:10.1037/0033-2909.132.4.497
- Jahn, R. G., Dunne, B. J., Nelson, R. D., Dobyns, Y. H. & Bradish, G. J. (1997). Correlations of random binary sequences with pre-stated operator intention: a review of a 12-year program. *Journal of Scientific Exploration* 11(3):345–367.
- Jahn, R. G. et al. (2000). Mind/Machine Interaction Consortium: PortREG replication experiments. *Journal of Scientific Exploration* 14(4):499–555.
- Kohlbrenner, D. & Shacham, H. (2016). Trusted browsers for uncertain times. *Proceedings of the 25th USENIX Security Symposium*, 463–480.
- Maier, M. A., Dechamps, M. C. & Pflitsch, M. (2018). Intentional observer effects on quantum randomness: a Bayesian analysis reveals evidence against micro-psychokinesis. *Frontiers in Psychology* 9:379. doi:10.3389/fpsyg.2018.00379
- Müller, S. (2014). CPU time jitter based non-physical true random number generator. *Proceedings of the Linux Symposium*, Ottawa.
- Nelson, R. D. & Bancel, P. A. (2011). Effects of mass consciousness: changes in random data during global events. *Explore* 7(6):373–383. doi:10.1016/j.explore.2011.08.003
- Radin, D. I. & Nelson, R. D. (1989). Evidence for consciousness-related anomalies in random physical systems. *Foundations of Physics* 19(12):1499–1514. doi:10.1007/BF00732509
- Schmidt, H. (1970). A PK test with electronic equipment. *Journal of Parapsychology* 34:175–181.
- Schwarz, M., Maurice, C., Gruss, D. & Mangard, S. (2017). Fantastic timers and where to find them: high-resolution microarchitectural attacks in JavaScript. *Financial Cryptography and Data Security (FC 2017)*, LNCS 10322:247–267. doi:10.1007/978-3-319-70972-7_13
- Seznec, A. & Sendrier, N. (2003). HAVEGE: a user-level software heuristic for generating empirically strong random numbers. *ACM Transactions on Modeling and Computer Simulation* 13(4):334–346. doi:10.1145/945511.945516
