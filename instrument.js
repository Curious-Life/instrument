/**
 * The field instrument — a permissionless physical-entropy collector in the
 * lineage of the PEAR lab's random event generators. UNIVERSAL: included on
 * every page under /awareness, so the recording continues wherever the
 * visitor happens to be. Exposes window.CLF as shared state; consumers
 * (the tune field's weather and graphs, the footer panel, the nav mini sun)
 * read from it, and the tune section writes its attention level into it.
 *
 * Source: the residual jitter between independent physical oscillators —
 * the display controller's clock (which times vsync, and therefore the rAF
 * timestamps), the CPU's high-resolution timebase, and the core clock that
 * sets the spin-probe's speed. Debiasing is a PEAR-style alternating XOR
 * template, NOT a cryptographic hash: a hash would scrub exactly the kind
 * of small statistical deviation the instrument exists to record.
 *
 * Bits group into 200-bit trials (~6s each). A trial is "attended" when the
 * visitor's pointer was resting on the tune field for most of it (CLF.attn,
 * written by the tune section, decaying here when tune is not running).
 * Frames during active scroll or after stalls are dropped: scroll changes
 * main-thread load, and load must not masquerade as signal.
 *
 * Cost: ~15 arithmetic ops per sample at ~35 samples/s, no allocations.
 * Network: one sendBeacon of a few numbers when the page hides.
 *
 * Honesty notes, for the record: browsers coarsen timers (Safari to 1ms),
 * so stream quality varies by platform — hz is recorded per session to
 * allow post-hoc filtering; and this is thermal/scheduling jitter, physical
 * but not certified-quantum. The page must never claim the field responds
 * to attention; the statistics accumulate toward whatever the truth is.
 *
 * Serial diagnostics: beyond lag-1 agreement, each segment records lag-2
 * agreement and the variance of 8-bit block sums (expectation 2 per block
 * for a fair independent stream). Together they bound correlation at the
 * scales the trial statistics assume away - recorded, not gated.
 *
 * The control channel: a second stream drawn from the platform's
 * cryptographically WHITENED generator (crypto.getRandomValues), run in
 * lockstep through the identical pipeline — same pacing, same alternating
 * template, same 200-bit trials, same attention tags. Whitening is designed
 * to scrub any upstream deviation, so this channel should sit at chance
 * forever; it is the yardstick the jitter channel is read against. If the
 * jitter channel drifts while the control stays flat, the drift is not the
 * pipeline's. Strictly parallel: it never touches the primary stream, the
 * displays, or the honesty gates.
 */
(function () {
  'use strict';

  // an embedded card window runs the instrument for its live reading but
  // records nothing: the host page's instrument owns the session
  var EMBED = /(?:\?|&)embed=1/.test(location.search);

  var lastScrollT = -1e4;
  window.addEventListener('scroll', function () { lastScrollT = performance.now(); }, { passive: true });
  function scrolling() { return performance.now() - lastScrollT < 120; }

  var FIELD = window.CLF = {
    attn: 0, w1: 0, w2: 0, w3: 0,
    trace: null, tlen: 240, thead: 0, tcount: 0,
    zNow: 0, zPeak: 0, zTrough: 0,   // windowed z, session best, session low
                                     // (a sustained negative run is as much
                                     // a signal as a positive one)
    sn: 0, sz: 0,           // whole-session trials and z (never reset by flush)
  };

  if (!navigator.sendBeacon) return;

  // a stable pseudonymous id, so one person's sessions can be linked
  // into a longitudinal record. A random tag in localStorage — never
  // fingerprinting, never the IP; identity here is opt-out-by-clearing-
  // storage. (crypto here is identity plumbing, not the experiment
  // stream — the stream stays hash-free.)
  // Identity is doubly stored: an HTTP-set first-party cookie (exempt from
  // Safari's 7-day cap on script-written storage, so it survives infrequent
  // visits) mirrored with localStorage — whichever survives re-seeds the
  // other. The server refreshes the cookie's ~400-day clock on every visit.
  function readCookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([0-9a-f]{24})'));
    return m ? m[1] : '';
  }
  var pid = '';
  try {
    pid = readCookie('clf_pid') || localStorage.getItem('clf_pid') || '';
    if (!pid && window.crypto && crypto.getRandomValues) {
      var idb = new Uint8Array(12);
      crypto.getRandomValues(idb);
      for (var ib = 0; ib < 12; ib++) pid += (idb[ib] + 256).toString(16).slice(1);
    }
    if (pid) localStorage.setItem('clf_pid', pid);
  } catch (e) { pid = ''; }
  if (pid && window.fetch && !EMBED) {
    fetch('/api/field?pid=' + pid, { credentials: 'same-origin' }).catch(function () {});
  }

  // a segment name: one continuous same-pacing stretch of recording. A long
  // hidden sitting (an overnight ambient session) checkpoints itself to the
  // server every few minutes under one name, and the server folds the
  // checkpoints back into the single row they are — so a phone the system
  // quietly kills at 3am has still kept its night. The name rotates whenever
  // a segment seals (any flush that is not a mid-sitting checkpoint).
  function mintSeg() {
    var s = '';
    try {
      var sb = new Uint8Array(8);
      crypto.getRandomValues(sb);
      for (var si = 0; si < 8; si++) s += (sb[si] + 256).toString(16).slice(1);
    } catch (e) { s = ''; }
    return s;
  }
  var seg = mintSeg();

  // session context, recorded once — device class, local-time offset, and
  // which page this instrument instance ran on (the stats page has no wave
  // field, so its trials are pure unattended baseline)
  var tz = 0, scr = '', hc = 0, dm = 0;
  try {
    tz = -new Date().getTimezoneOffset();
    scr = screen.width + 'x' + screen.height + 'x' + (Math.round((window.devicePixelRatio || 1) * 10) / 10);
    hc = navigator.hardwareConcurrency || 0;
    dm = navigator.deviceMemory || 0;
  } catch (e) {}
  var pg = /exercises|development/.test(location.pathname) ? 'hub'
    : /exercise/.test(location.pathname) ? 'game'
    : /meditate/.test(location.pathname) ? 'med'
    : /mycelium/.test(location.pathname) ? 'mind'
    : /music/.test(location.pathname) ? 'music'
    : /field/.test(location.pathname) ? 'stats'
    : /live/.test(location.pathname) ? (function () {
        // each full-screen exercise is its own tag, so records filter
        var v = '';
        try { v = new URLSearchParams(location.search).get('v') || ''; } catch (e) {}
        return 'x-' + (['three', 'osc', 'emo', 'forms', 'elems', 'sync', 'forms5', 'qual', 'oracle', 'chladni', 'orch', 'compass', 'snake', 'moon', 'drift'].indexOf(v) >= 0 ? v : 'three');
      })()
    : 'main';

  var prev = -1, tmpl = 0, ivNow = 3;
  var bits = 0, sum = 0, attnAcc = 0, s3 = [0, 0, 0];
  var n = 0, dev = 0, dev2 = 0, an = 0, adev = 0, adev2 = 0;
  var hzN = 0, hzSum = 0;

  // the control channel's own books, kept beside the primary's
  var csum = 0, ccount = 0, ctlTmpl = 0;
  var cn = 0, cdev = 0, cdev2 = 0, can = 0, cadev = 0, cadev2 = 0;
  var ctlBuf = null, ctlAt = 0;
  var ctlOk = !!(window.crypto && crypto.getRandomValues);
  function ctlBit() {
    if (!ctlOk) return -1;
    if (!ctlBuf || ctlAt >= 2048) {
      if (!ctlBuf) ctlBuf = new Uint8Array(256);
      try { crypto.getRandomValues(ctlBuf); } catch (e) { ctlOk = false; return -1; }
      ctlAt = 0;
    }
    var b = (ctlBuf[ctlAt >> 3] >> (ctlAt & 7)) & 1;
    ctlAt++;
    return b ^ (ctlTmpl ^= 1);
  }
  var sessN = 0, sessDev = 0;   // for display only — never flushed
  var warmSess = null;
  try { warmSess = JSON.parse(sessionStorage.getItem('clf_warm') || 'null'); } catch (e) {}
  if (warmSess && Date.now() - warmSess.at < 60000) {
    sessN = warmSess.sn | 0; sessDev = +warmSess.sdev || 0;
    if (sessN > 0) { FIELD.sn = sessN; FIELD.sz = sessDev / Math.sqrt(50 * sessN); }
  }

  // the tape and its quality: per-trial [sum, mean-attention] pairs (the
  // raw series later analyses need — epoch alignment on attention onset,
  // learning curves, autocorrelation), plus stream self-tests: adjacent-bit
  // agreement (~50% for a healthy stream) and probe-saturation count (the
  // spin loop hitting its cap, a degenerate-timer indicator)
  var trialLog = [];
  var segT = performance.now();
  var drops = 0, stalls = 0, sat = 0, agree = 0, bitsAll = 0, prevBit = -1;
  var agree2 = 0, prevBit2 = -1;          // lag-2 agreement, same denominator
  var v8 = 0, b8 = 0, blkSum = 0, blkN = 0;   // 8-bit block-sum variance
  var sunEl = document.getElementById('nav-sun');

  // the live trace: cumulative deviation of the bit stream (in bits above
  // or below chance), one point per 8 bits, in a preallocated ring
  var TR = FIELD.tlen, trace = new Array(TR), ti = 0, tn = 0, cum = 0, since = 0;
  for (var z0 = 0; z0 < TR; z0++) trace[z0] = 0;
  FIELD.trace = trace;

  // the warm hand-over: within one sitting, navigating between pages must
  // not restart the measurement. The leaving page saves its live trace;
  // the arriving page, within a minute, resumes it - the reading is alive
  // from the first frame and no second calibration is asked for. A stale
  // trace is never resumed: past the minute, the sitting has ended.
  var resumed = false;
  if (!EMBED) {
    try {
      var wj = JSON.parse(sessionStorage.getItem('clf_warm') || 'null');
      if (wj && Date.now() - wj.at < 60000 && wj.tr && wj.tr.length === TR) {
        for (var wi = 0; wi < TR; wi++) trace[wi] = +wj.tr[wi] || 0;
        ti = wj.ti | 0; tn = wj.tn | 0; cum = +wj.cum || 0; since = wj.since | 0;
        FIELD.thead = ti; FIELD.tcount = tn;
        FIELD.zPeak = +wj.pk || 0; FIELD.zTrough = +wj.trg || 0;
        FIELD.zNow = +wj.z || 0;
        resumed = tn > 12;
      }
      sessionStorage.removeItem('clf_warm');
    } catch (e) {}
  }
  FIELD.resumed = resumed;

  function clampW(v) { return v > 1 ? 1 : v < -1 ? -1 : v; }

  function tick(ts) {
    // timer-gated, NOT a bare rAF chain: a continuous rAF stream from
    // this loop promoted ProMotion displays to 120Hz and every animation
    // on the page visibly quickened. Pacing through a ~25ms timeout means
    // the collector never drives the display's refresh rate.
    setTimeout(function () { requestAnimationFrame(tick); }, 25);
    FIELD.attn *= 0.99;   // fades unless the tune section keeps writing it
    if (prev < 0) { prev = ts; return; }
    var d = ts - prev; prev = ts;
    if (scrolling()) { drops++; return; }
    if (!(d > 2 && d < 80)) { stalls++; return; }
    hzN++; hzSum += d;
    harvest(ts, d);
  }

  // always-on: when the page is hidden but a voice keeps the audio graph
  // rendering, the graph's steady callbacks pace the collector in place
  // of the stilled rAF (FIELD.pump, called from the audio pipeline). The
  // physical probe is the same; only the pacer differs, so hidden-paced
  // segments are recorded as their own instrument generation (iv 4) and
  // the record can always tell the two apart.
  //
  // A locked phone cannot promise the probe its rate or its granularity:
  // throttled, metronomic callbacks fold near-constant timer values into
  // a biased, correlated stream — noise that would masquerade as signal.
  // So the hidden channel must continuously prove itself: cadence at
  // least ~8 samples/s, adjacent-bit agreement near a fair coin's 50%,
  // probe saturation near zero, and a probation run after every lapse
  // where bits are generated and judged but never committed. While the
  // proof holds, FIELD.pumpOk is true and consumers may sound; the
  // moment it fails, sampling stops committing and pumpOk falls — and
  // nothing is ever invented to fill the quiet.
  var pumpPrev = -1, pumpProb = 0;
  var agreeEma = 0.5, satEma = 0, biasEma = 0.5;   // stream health, per bit
  FIELD.pumpAt = 0; FIELD.pumpHz = 0; FIELD.pumpOk = false;
  function pumpDown() { FIELD.pumpOk = false; pumpProb = 0; }
  FIELD.pump = function () {
    if (!document.hidden) { pumpPrev = -1; FIELD.pumpHz = 0; pumpDown(); return; }
    var now = performance.now();
    if (pumpPrev < 0) { pumpPrev = now; return; }
    var d = now - pumpPrev;
    if (d < 20) return;             // audio buffers can come thick; keep spacing
    pumpPrev = now;
    if (d >= 400) { stalls++; pumpDown(); return; }
    FIELD.pumpHz = FIELD.pumpHz ? FIELD.pumpHz * 0.9 + 100 / d : 1000 / d;
    FIELD.pumpAt = now;
    var bit = probeBit(now, d);
    // the hidden stream is held to the visible stream's own standard:
    // fair-coin statistics (agreement and mean both near 50%), not the
    // platform's clock granularity - Safari saturates the spin probe by
    // design (1ms coarsening) exactly as it does in visible sampling,
    // where it was never disqualifying. What IS disqualifying is the
    // degenerate stream of a throttled lock screen: metronomic
    // callbacks fold into biased or correlated bits, and those two
    // tests catch it.
    var healthy = FIELD.pumpHz >= 8 &&
                  agreeEma > 0.16 && agreeEma < 0.84 &&
                  biasEma > 0.25 && biasEma < 0.75 &&
                  satEma < 0.95;
    if (!healthy) { pumpDown(); return; }
    if (pumpProb < 16) { pumpProb++; return; }   // probation: judged, not kept
    FIELD.pumpOk = true;
    if (n === 0) ivNow = 4;         // a clean segment boundary takes the label
    FIELD.attn *= 0.99;
    hzN++; hzSum += d;
    commit(bit);
  };

  function probeBit(ts, d) {
    // jitter probe: spin until the coarsened high-res clock ticks over,
    // counting reads. The count carries CPU-vs-timer phase jitter —
    // thermal, per-sample, independent of vsync quantisation (the frame
    // delta alone went degenerate once the loop was timer-paced).
    var t0 = performance.now(), c = 0;
    while (performance.now() === t0 && c < 8192) c++;
    if (c >= 8192) sat++;
    var x = (c ^ (Math.round(ts * 1000) & 0xffff) ^ (Math.round(d * 1000) | 0)) | 0;
    x ^= x >> 16; x ^= x >> 8; x ^= x >> 4; x ^= x >> 2; x ^= x >> 1;
    var bit = (x & 1) ^ (tmpl ^= 1);
    // slow EMAs: wide enough (±4σ for a fair stream) that honest noise
    // never grazes the health bands, yet a genuinely degenerate stream
    // still drifts out within a couple of seconds
    agreeEma += ((bit === prevBit ? 1 : 0) - agreeEma) * 0.03;
    satEma += ((c >= 8192 ? 1 : 0) - satEma) * 0.08;
    biasEma += (bit - biasEma) * 0.03;
    FIELD.agree01 = agreeEma; FIELD.sat01 = satEma;   // read-only diagnostics
    FIELD.bias01 = biasEma;
    if (bit === prevBit) agree++;
    if (bit === prevBit2) agree2++;
    prevBit2 = prevBit; prevBit = bit; bitsAll++;
    return bit;
  }

  function harvest(ts, d) { commit(probeBit(ts, d)); }

  function commit(bit) {
    // the control walks in step: one whitened bit beside every real one
    var cb = ctlBit();
    if (cb >= 0) { csum += cb; ccount++; }
    sum += bit; s3[bits % 3] += bit; attnAcc += FIELD.attn; bits++;
    cum += bit - 0.5;
    blkSum += bit;
    if (++blkN === 8) { v8 += (blkSum - 4) * (blkSum - 4); b8++; blkSum = 0; blkN = 0; }
    if (++since === 8) {
      since = 0;
      trace[ti] = cum; ti = (ti + 1) % TR;
      if (tn < TR) tn++;
      FIELD.thead = ti; FIELD.tcount = tn;
      if (tn > 12) {
        var zw = (cum - trace[(ti - tn + TR) % TR]) / Math.sqrt(0.25 * (tn - 1) * 8);
        FIELD.zNow = zw;
        if (zw > FIELD.zPeak) FIELD.zPeak = zw;
        if (zw < FIELD.zTrough) FIELD.zTrough = zw;
        // the nav's mini sun. tanh spends most of the dial on the z range
        // sessions actually visit (|z| < 1.5), so ordinary swings are
        // visibly different states, not tremors around the midpoint
        if (sunEl) {
          var gl = 0.5 + 0.5 * Math.tanh(zw / 1.1);
          sunEl.style.setProperty('--g', gl.toFixed(3));
        }
      }
    }
    if (bits < 200) return;

    var dv = sum - 100;
    n++; dev += dv; dev2 += dv * dv;
    // the tape entry: score, attention, and the absolute second - the
    // synchrony analyses key on wall-clock simultaneity across devices
    if (trialLog.length < 1800) {
      trialLog.push(sum, Math.round(attnAcc / 2), Math.round(Date.now() / 1000));
    }
    var attended = attnAcc / 200 > 0.45;
    if (attended) { an++; adev += dv; adev2 += dv * dv; }

    // a control trial counts only when all 200 of its bits were drawn;
    // it wears the same attention tag its real twin earned
    if (ccount === 200) {
      var cdv = csum - 100;
      cn++; cdev += cdv; cdev2 += cdv * cdv;
      if (attended) { can++; cadev += cdv; cadev2 += cdv * cdv; }
    }
    csum = 0; ccount = 0;
    sessN++; sessDev += dv;   // display totals: survive beacon flushes
    FIELD.sn = sessN;
    FIELD.sz = sessDev / Math.sqrt(50 * sessN);

    // the weather: three slow bounded walks, one per trial-third
    // (~67 bits each, expectation 33.5), decaying toward calm
    FIELD.w1 = clampW(FIELD.w1 * 0.985 + (s3[0] - 33.5) * 0.012);
    FIELD.w2 = clampW(FIELD.w2 * 0.985 + (s3[1] - 33.5) * 0.012);
    FIELD.w3 = clampW(FIELD.w3 * 0.985 + (s3[2] - 33.5) * 0.012);

    bits = 0; sum = 0; attnAcc = 0; s3[0] = s3[1] = s3[2] = 0;

    // the night guard: a hidden sitting saves itself as it goes. The page's
    // only other flushes ride visibility changes, and a screen that stays
    // dark for eight hours never has one — everything would sit in memory,
    // forfeit the moment iOS reclaims the process. Paced here, per trial,
    // because the audio callbacks are the one clock a locked phone keeps.
    if (document.hidden && performance.now() - segT > 300000) flush(true);
  }

  function flush(checkpoint) {
    if (EMBED) return;
    if (n < 3) return;
    var hz = hzN ? Math.round(10000 / (hzSum / hzN)) / 10 : 0;
    var ok = navigator.sendBeacon('/api/field', JSON.stringify({
      n: n, dev: dev, dev2: dev2, an: an, adev: adev, adev2: adev2, hz: hz, pid: pid,
      seg: seg || undefined,
      cn: cn, cdev: cdev, cdev2: cdev2, can: can, cadev: cadev, cadev2: cadev2,
      pk: Math.round(FIELD.zPeak * 100) / 100, tr: Math.round(FIELD.zTrough * 100) / 100,
      iv: ivNow,   // instrument generation: 3 = timer-gated clock-edge jitter
                   // probe (rAF-paced); 4 = same probe, audio-callback-paced
                   // while the page is hidden
      dur: Math.round((performance.now() - segT) / 1000),
      drops: drops, stalls: stalls, sat: sat, agree: agree, bits: bitsAll,
      a2: agree2, v8: v8, b8: b8,
      tz: tz, scr: scr, hc: hc, dm: dm, pg: pg,
      t3: trialLog,   // [score, attention, epoch-second] triples
    }));
    if (ok) {
      n = 0; dev = 0; dev2 = 0; an = 0; adev = 0; adev2 = 0; hzN = 0; hzSum = 0;
      drops = 0; stalls = 0; sat = 0; agree = 0; bitsAll = 0;
      agree2 = 0; v8 = 0; b8 = 0;
      cn = 0; cdev = 0; cdev2 = 0; can = 0; cadev = 0; cadev2 = 0;
      trialLog = []; segT = performance.now();
      FIELD.savedAt = Date.now();   // consumers may show "kept to HH:MM"
      if (!checkpoint) seg = mintSeg();
    }
  }
  function saveWarm() {
    if (EMBED) return;
    try {
      sessionStorage.setItem('clf_warm', JSON.stringify({
        at: Date.now(), tr: trace, ti: ti, tn: tn, cum: cum, since: since,
        sn: sessN, sdev: sessDev,
        pk: FIELD.zPeak, trg: FIELD.zTrough, z: FIELD.zNow,
      }));
    } catch (e) {}
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') { saveWarm(); flush(); }
    else {
      // returning: seal the hidden-paced segment under its own label and
      // let the vsync-paced one start clean
      if (ivNow === 4) { flush(); ivNow = 3; }
      pumpPrev = -1; prev = -1; FIELD.pumpHz = 0; pumpDown();
    }
  });
  window.addEventListener('pagehide', function () { saveWarm(); flush(); });

  // a deliberate fresh start (the game's restart): the segment so far is
  // saved as its own session, and the visible session stats begin again
  FIELD.restart = function () {
    flush();
    sessN = 0; sessDev = 0;
    FIELD.sn = 0; FIELD.sz = 0;
    FIELD.zPeak = 0; FIELD.zTrough = 0;
  };

  requestAnimationFrame(tick);
})();
