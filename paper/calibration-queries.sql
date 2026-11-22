-- The selection and formulas behind the two calibration tables in paper.md
-- (section 3.2). The session table is not public; these queries document
-- exactly what was computed, on 22 November 2026.
--
-- One row of field_sessions is one recorded segment:
--   trials, dev, dev2      trial count, sum of (trial sum - 100), sum of its square
--   att_trials, att_dev    the same for trials the page flagged as attended
--   bits, agree, agree2    bits judged, and how many matched the bit 1 and 2 before
--   sat                    samples that reached the spin cap of 8192
--   v8, b8                 sum of (8-bit block sum - 4)^2, and the block count
--   cn, cdev, cdev2        the control channel's trial count and deviations
--   iv                     pacing generation (3 visible, 4 hidden, 5 timer)
--   pg                     page tag; ua, pid  user agent, pseudonymous device tag

-- The calibration record: pages with no directed exercise, no headless browsers.
--   WHERE trials > 0
--     AND (ua IS NULL OR ua NOT LIKE '%HeadlessChrome%')
--     AND (pg IS NULL OR pg IN ('main', 'stats', 'med', 'music', 'hub', 'mind'))

-- Table 1: by platform and pacing generation.
SELECT
  CASE WHEN ua LIKE '%iPhone%' OR ua LIKE '%iPad%' THEN 'iOS'
       WHEN ua LIKE '%Android%' THEN 'Android'
       WHEN ua LIKE '%Macintosh%' THEN 'macOS'
       WHEN ua LIKE '%Windows%' THEN 'Windows' ELSE 'other' END AS plat,
  iv,
  COUNT(DISTINCT pid) AS devices,
  COUNT(*) AS sessions,
  SUM(trials) AS trials,
  -- mean z, on trials not flagged as attended
  (SUM(dev) - SUM(att_dev)) / SQRT(50.0 * (SUM(trials) - SUM(att_trials))) AS mean_z,
  -- trial variance over the fair-coin 50
  (SUM(dev2) * 1.0 / SUM(trials)
     - (SUM(dev) * 1.0 / SUM(trials)) * (SUM(dev) * 1.0 / SUM(trials))) / 50 AS variance_ratio,
  1.0 * SUM(agree) / SUM(bits) AS lag1,
  -- lag-2 counts exist only from instrument v21 on: their own denominator
  1.0 * SUM(agree2) / SUM(bits) FILTER (WHERE agree2 IS NOT NULL) AS lag2,
  1.0 * SUM(v8) / (2 * SUM(b8)) AS block_variance,
  1.0 * SUM(sat) / SUM(bits) AS saturation,
  SUM(cdev) / SQRT(50.0 * SUM(cn)) AS control_z
FROM field_sessions
WHERE trials > 0
  AND (ua IS NULL OR ua NOT LIKE '%HeadlessChrome%')
  AND (pg IS NULL OR pg IN ('main', 'stats', 'med', 'music', 'hub', 'mind'))
GROUP BY plat, iv;
-- Groups with fewer than three devices are folded into one row before
-- anything is published.

-- Table 2: by each session's share of saturated samples.
SELECT
  CASE WHEN 1.0 * sat / bits < 0.25 THEN 'below 25%' ELSE '25% or more' END AS band,
  COUNT(*) AS sessions,
  COUNT(DISTINCT pid) AS devices,
  SUM(trials) AS trials,
  (SUM(dev) - SUM(att_dev)) / SQRT(50.0 * (SUM(trials) - SUM(att_trials))) AS mean_z,
  (SUM(dev2) * 1.0 / SUM(trials)
     - (SUM(dev) * 1.0 / SUM(trials)) * (SUM(dev) * 1.0 / SUM(trials))) / 50 AS variance_ratio,
  1.0 * SUM(agree) / SUM(bits) AS lag1,
  1.0 * SUM(agree2) / SUM(bits) FILTER (WHERE agree2 IS NOT NULL) AS lag2,
  1.0 * SUM(v8) / (2 * SUM(b8)) AS block_variance,
  SUM(cdev) / SQRT(50.0 * SUM(cn)) AS control_z,
  (SUM(cdev2) * 1.0 / SUM(cn)
     - (SUM(cdev) * 1.0 / SUM(cn)) * (SUM(cdev) * 1.0 / SUM(cn))) / 50 AS control_variance_ratio
FROM field_sessions
WHERE trials > 0 AND bits > 0 AND dev2 IS NOT NULL
  AND (ua IS NULL OR ua NOT LIKE '%HeadlessChrome%')
  AND (pg IS NULL OR pg IN ('main', 'stats', 'med', 'music', 'hub', 'mind'))
GROUP BY band;

-- Rates, by pacing generation. hz is each session's sampling rate while
-- sampling (1000 / mean accepted interval in ms); dur is the session's
-- length in seconds, which includes stretches with no sampling.
SELECT
  iv,
  SUM(trials) * 1.0 / SUM(trials * 1.0 / NULLIF(hz, 0)) AS samples_per_second_while_sampling,
  200.0 * SUM(trials) / SUM(dur) AS bits_per_second_of_session_time,
  SUM(dur) / 3600.0 AS hours
FROM field_sessions
WHERE trials > 0
  AND (ua IS NULL OR ua NOT LIKE '%HeadlessChrome%')
  AND (pg IS NULL OR pg IN ('main', 'stats', 'med', 'music', 'hub', 'mind'))
GROUP BY iv;

-- Standard errors used in the text:
--   variance ratio      sqrt(2 / trials)
--   lag agreement       0.5 / sqrt(bits)
--   block variance      sqrt(7 / blocks) / 2
--   mean z              1 by construction (nominal); divided by
--                       sqrt(variance ratio) for the corrected values
