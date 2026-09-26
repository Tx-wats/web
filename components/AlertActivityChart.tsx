import { useMemo } from "react";

export type AlertActivityItem = {
  timestamp: string | number | Date;
  network?: string;
  ruleType?: string;
};

type Bucket = {
  label: string;
  start: number;
  end: number;
  counts: Record<string, number>;
  total: number;
};

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const SERIES_COLORS = [
  "#6366f1", // indigo-500
  "#818cf8", // indigo-400
  "#a5b4fc", // indigo-300
  "#4f46e5", // indigo-600
  "#c7d2fe", // indigo-200
];

function toMillis(value: string | number | Date): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  return new Date(value).getTime();
}

function seriesKey(item: AlertActivityItem): string {
  return item.network || item.ruleType || "Other";
}

/**
 * Buckets alert activity into fixed-size time windows ending at `now`.
 * Exported so it can be unit tested independently of the chart.
 */
export function bucketAlerts(
  items: AlertActivityItem[],
  options: { windowMs: number; bucketCount: number; now?: number },
): Bucket[] {
  const { windowMs, bucketCount } = options;
  const now = options.now ?? Date.now();
  const bucketMs = windowMs / bucketCount;
  const rangeStart = now - windowMs;

  const buckets: Bucket[] = Array.from({ length: bucketCount }, (_, i) => {
    const start = rangeStart + i * bucketMs;
    return {
      label: new Date(start).toISOString(),
      start,
      end: start + bucketMs,
      counts: {},
      total: 0,
    };
  });

  for (const item of items) {
    const ts = toMillis(item.timestamp);
    if (Number.isNaN(ts) || ts < rangeStart || ts > now) continue;
    const index = Math.min(
      bucketCount - 1,
      Math.floor((ts - rangeStart) / bucketMs),
    );
    const key = seriesKey(item);
    const bucket = buckets[index];
    bucket.counts[key] = (bucket.counts[key] ?? 0) + 1;
    bucket.total += 1;
  }

  return buckets;
}

function formatHourLabel(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDayLabel(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

type ChartProps = {
  title: string;
  buckets: Bucket[];
  series: string[];
  formatLabel: (ms: number) => string;
};

function ActivityChart({ title, buckets, series, formatLabel }: ChartProps) {
  const max = Math.max(1, ...buckets.map((b) => b.total));
  const width = 560;
  const height = 160;
  const padding = { top: 12, right: 12, bottom: 28, left: 28 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const slot = plotWidth / Math.max(1, buckets.length);
  const barWidth = Math.max(2, slot * 0.6);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-200">
        {title}
      </h3>
      <svg
        role="img"
        aria-label={`${title} bar chart`}
        viewBox={`0 0 ${width} ${height}`}
        className="h-40 w-full"
        preserveAspectRatio="none"
      >
        <line
          x1={padding.left}
          y1={padding.top + plotHeight}
          x2={width - padding.right}
          y2={padding.top + plotHeight}
          stroke="#a1a1aa"
          strokeWidth={1}
        />
        {buckets.map((bucket, i) => {
          const x = padding.left + i * slot + (slot - barWidth) / 2;
          let stackY = padding.top + plotHeight;
          return (
            <g key={bucket.start}>
              {series.map((key, s) => {
                const value = bucket.counts[key] ?? 0;
                if (value === 0) return null;
                const barHeight = (value / max) * plotHeight;
                stackY -= barHeight;
                return (
                  <rect
                    key={key}
                    x={x}
                    y={stackY}
                    width={barWidth}
                    height={barHeight}
                    fill={SERIES_COLORS[s % SERIES_COLORS.length]}
                  >
                    <title>{`${key}: ${value}`}</title>
                  </rect>
                );
              })}
              <text
                x={x + barWidth / 2}
                y={height - 8}
                textAnchor="middle"
                className="fill-zinc-500 text-[9px]"
              >
                {formatLabel(bucket.start)}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-3">
        {series.map((key, s) => (
          <span
            key={key}
            className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-300"
          >
            <span
              className="inline-block h-2 w-2 rounded-sm"
              style={{ backgroundColor: SERIES_COLORS[s % SERIES_COLORS.length] }}
            />
            {key}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>{title} data table</caption>
        <thead>
          <tr>
            <th scope="col">Time</th>
            {series.map((key) => (
              <th key={key} scope="col">
                {key}
              </th>
            ))}
            <th scope="col">Total</th>
          </tr>
        </thead>
        <tbody>
          {buckets.map((bucket) => (
            <tr key={bucket.start}>
              <th scope="row">{formatLabel(bucket.start)}</th>
              {series.map((key) => (
                <td key={key}>{bucket.counts[key] ?? 0}</td>
              ))}
              <td>{bucket.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type AlertActivityChartProps = {
  alerts: AlertActivityItem[];
  now?: number;
};

export default function AlertActivityChart({
  alerts,
  now,
}: AlertActivityChartProps) {
  const { daily, hourly, series } = useMemo(() => {
    const dailyBuckets = bucketAlerts(alerts, {
      windowMs: 7 * DAY_MS,
      bucketCount: 7,
      now,
    });
    const hourlyBuckets = bucketAlerts(alerts, {
      windowMs: DAY_MS,
      bucketCount: 24,
      now,
    });
    const keys = new Set<string>();
    for (const item of alerts) keys.add(seriesKey(item));
    return {
      daily: dailyBuckets,
      hourly: hourlyBuckets,
      series: Array.from(keys).sort(),
    };
  }, [alerts, now]);

  return (
    <div className="flex flex-col gap-4">
      <ActivityChart
        title="Alert activity — last 7 days"
        buckets={daily}
        series={series}
        formatLabel={formatDayLabel}
      />
      <ActivityChart
        title="Alert activity — last 24 hours"
        buckets={hourly}
        series={series}
        formatLabel={formatHourLabel}
      />
    </div>
  );
}
