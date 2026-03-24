import "server-only";

/**
 * Compute the next run time for a trigger based on its schedule.
 *
 * @param frequency   - "daily" | "weekly" | "custom"
 * @param hour        - 0–23
 * @param minute      - 0–59
 * @param dayOfWeek   - 0=Sun..6=Sat (only used for weekly)
 * @param timezone    - IANA timezone string (e.g. "Europe/Copenhagen")
 * @param after       - compute next run AFTER this timestamp (defaults to now)
 */
export function computeNextRun(
  frequency: string,
  hour: number,
  minute: number,
  dayOfWeek: number | null,
  timezone: string,
  after?: Date
): Date {
  const now = after ?? new Date();

  // Build a candidate date in the target timezone
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  // Parse current time in the target timezone
  const parts = Object.fromEntries(
    formatter.formatToParts(now).map((p) => [p.type, p.value])
  );
  const tzYear = Number(parts.year);
  const tzMonth = Number(parts.month) - 1;
  const tzDay = Number(parts.day);
  const tzHour = Number(parts.hour);
  const tzMinute = Number(parts.minute);

  // Create candidate: today at scheduled time in UTC (we'll adjust for tz offset)
  // We use a simpler approach: work in tz-local space, then convert
  const candidate = new Date(
    Date.UTC(tzYear, tzMonth, tzDay, hour, minute, 0, 0)
  );

  // Get the UTC offset for the timezone
  const tzOffset = getTimezoneOffsetMs(timezone, candidate);
  candidate.setTime(candidate.getTime() + tzOffset);

  if (frequency === "weekly" && dayOfWeek !== null) {
    // Adjust to the correct day of week
    const candidateDow = getDayOfWeekInTz(candidate, timezone);
    let daysToAdd = dayOfWeek - candidateDow;
    if (daysToAdd < 0) daysToAdd += 7;
    candidate.setTime(candidate.getTime() + daysToAdd * 86400000);

    // If it's in the past, add a week
    if (candidate.getTime() <= now.getTime()) {
      candidate.setTime(candidate.getTime() + 7 * 86400000);
    }
  } else {
    // Daily: if today's time has passed, go to tomorrow
    if (candidate.getTime() <= now.getTime()) {
      candidate.setTime(candidate.getTime() + 86400000);
    }
  }

  return candidate;
}

/** Get the day-of-week (0=Sun..6=Sat) for a UTC date in a given timezone */
function getDayOfWeekInTz(date: Date, timezone: string): number {
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
  }).format(date);
  const map: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return map[formatted] ?? 0;
}

/** Get timezone offset in ms (positive means tz is behind UTC) */
function getTimezoneOffsetMs(timezone: string, date: Date): number {
  // Create two formatted dates: one in UTC, one in the target tz
  const utcStr = date.toLocaleString("en-US", { timeZone: "UTC" });
  const tzStr = date.toLocaleString("en-US", { timeZone: timezone });
  const utcDate = new Date(utcStr);
  const tzDate = new Date(tzStr);
  return utcDate.getTime() - tzDate.getTime();
}

/**
 * Check if a trigger is due to run.
 * A trigger is due if:
 * - It's active
 * - nextRunAt is set and is <= now
 * - OR nextRunAt is null and it's never been run
 */
export function isDue(
  nextRunAt: Date | null,
  lastRunAt: Date | null,
  isActive: boolean
): boolean {
  if (!isActive) return false;
  const now = new Date();
  if (nextRunAt) return nextRunAt.getTime() <= now.getTime();
  // No nextRunAt set yet — trigger has never been scheduled, consider it due
  return lastRunAt === null;
}

/**
 * Build a human-readable cron expression from schedule params.
 */
export function buildCronExpression(
  frequency: string,
  hour: number,
  minute: number,
  dayOfWeek: number | null
): string {
  if (frequency === "weekly" && dayOfWeek !== null) {
    return `${minute} ${hour} * * ${dayOfWeek}`;
  }
  return `${minute} ${hour} * * *`;
}
