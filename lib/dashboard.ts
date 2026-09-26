export type AlertSeverity = "low" | "medium" | "high" | "critical";

export interface AlertRecord {
  id: string;
  createdAt: string | Date;
  severity: AlertSeverity;
  network?: string;
  ruleType?: string;
}

export interface AlertBucket {
  key: string;
  label: string;
  start: Date;
  end: Date;
  total: number;
  byGroup: Record<string, number>;
}

export interface AlertActivitySeries {
  buckets: AlertBucket[];
  groups: string[];
  total: number;
  max: number;
}

export type AlertActivityRange = "24h" | "7d";

export type AlertGroupBy = "network" | "ruleType";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

function startOfHour(date: Date): Date {
  const d = new Date(date);
  d.setMinutes(0, 0, 0);
  return d;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function groupKey(alert: AlertRecord, groupBy: AlertGroupBy): string {
  const value = groupBy === "network" ? alert.network : alert.ruleType;
  return value && value.trim().length > 0 ? value : "unknown";
}

/**
 * Buckets alerts into a fixed number of time windows and counts them,
 * optionally split by network or rule type. Pure and dependency-free so it
 * can be unit tested and reused by both the 24h and 7d dashboard charts.
 */
export function bucketAlerts(
  alerts: AlertRecord[],
  range: AlertActivityRange,
  groupBy: AlertGroupBy,
  now: Date = new Date(),
): AlertActivitySeries {
  const isHourly = range === "24h";
  const bucketCount = isHourly ? 24 : 7;
  const stepMs = isHourly ? HOUR_MS : DAY_MS;
  const anchor = isHourly ? startOfHour(now) : startOfDay(now);

  const buckets: AlertBucket[] = [];
  for (let i = bucketCount - 1; i >= 0; i -= 1) {
    const start = new Date(anchor.getTime() - i * stepMs);
    const end = new Date(start.getTime() + stepMs);
    const label = isHourly
      ? `${String(start.getHours()).padStart(2, "0")}:00`
      : start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    buckets.push({ key: start.toISOString(), label, start, end, total: 0, byGroup: {} });
  }

  const windowStart = buckets[0].start.getTime();
  const windowEnd = buckets[buckets.length - 1].end.getTime();
  const groups = new Set<string>();

  for (const alert of alerts) {
    const created = toDate(alert.createdAt);
    const time = created.getTime();
    if (Number.isNaN(time) || time < windowStart || time >= windowEnd) {
      continue;
    }
    const index = Math.floor((time - windowStart) / stepMs);
    const bucket = buckets[index];
    if (!bucket) {
      continue;
    }
    const key = groupKey(alert, groupBy);
    groups.add(key);
    bucket.total += 1;
    bucket.byGroup[key] = (bucket.byGroup[key] ?? 0) + 1;
  }

  const sortedGroups = Array.from(groups).sort();
  const total = buckets.reduce((sum, bucket) => sum + bucket.total, 0);
  const max = buckets.reduce((peak, bucket) => Math.max(peak, bucket.total), 0);

  return { buckets, groups: sortedGroups, total, max };
}
