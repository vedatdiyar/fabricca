/**
 * Pacific TTL helpers — single source for America/Los_Angeles date handling.
 *
 * Gemini RPD quotas reset at midnight Pacific time. All TTLs and date keys
 * must use this timezone to avoid off-by-one errors during DST transitions.
 */

/** Pacific date key in YYYY-MM-DD format (e.g. 2026-09-03). */
export function getPacificDateKey(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Milliseconds until the next Pacific midnight (00:00 America/Los_Angeles).
 * Uses binary search over UTC timestamps to handle DST 23h/25h days exactly.
 * Accurate to ~1 second, sufficient for Redis PEXPIRE TTL.
 */
export function msUntilNextPacificMidnight(now: Date = new Date()): number {
  const todayKey = getPacificDateKey(now);
  const startMs = now.getTime();
  // Next midnight is at most 25h away (DST fall-back 25h day)
  let low = startMs;
  let high = startMs + 25 * 60 * 60 * 1000;

  // Binary search for smallest timestamp where Pacific date != today
  // ~27 iterations for 1s precision over 25h window
  while (high - low > 1000) {
    const mid = Math.floor((low + high) / 2);
    const midKey = getPacificDateKey(new Date(mid));
    if (midKey === todayKey) {
      low = mid;
    } else {
      high = mid;
    }
  }
  // high is first ms of next Pacific day (approx)
  return Math.max(1000, high - startMs);
}

/** Seconds until next Pacific midnight (minimum 1). */
export function secondsUntilNextPacificMidnight(now: Date = new Date()): number {
  return Math.ceil(msUntilNextPacificMidnight(now) / 1000);
}
