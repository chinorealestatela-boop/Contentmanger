"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SEQUENTIAL_BLUE, stableColor } from "@/lib/chart-colors";
import { formatCurrency } from "@/lib/format";

type ValueFormat = "number" | "currency";

function formatVal(v: number, format?: ValueFormat) {
  return format === "currency" ? formatCurrency(v) : String(v);
}

function ChartTooltip({ active, payload, label, valueFormat }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string; valueFormat?: ValueFormat }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-[var(--text)]">{label}</p>
      <p className="text-[var(--text-muted)]">{formatVal(payload[0].value, valueFormat)}</p>
    </div>
  );
}

export function SingleSeriesBarChart({
  data,
  xKey,
  yKey,
  valueFormat,
  horizontal,
}: {
  data: Record<string, string | number>[];
  xKey: string;
  yKey: string;
  valueFormat?: ValueFormat;
  horizontal?: boolean;
}) {
  if (data.length === 0) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 34)}>
      <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 4, right: 12, left: 4, bottom: 4 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={!horizontal} vertical={horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" tick={{ fontSize: 11, fill: "var(--text-faint)" }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey={xKey} width={110} tick={{ fontSize: 11.5, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} interval={0} angle={-25} textAnchor="end" height={50} />
            <YAxis tick={{ fontSize: 11, fill: "var(--text-faint)" }} axisLine={false} tickLine={false} />
          </>
        )}
        <Tooltip content={<ChartTooltip valueFormat={valueFormat} />} cursor={{ fill: "var(--bg-subtle)" }} />
        <Bar dataKey={yKey} radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={28}>
          {data.map((_, i) => <Cell key={i} fill={SEQUENTIAL_BLUE} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CategoricalBarChart({
  data,
  xKey,
  yKey,
  knownOrder,
  valueFormat,
}: {
  data: Record<string, string | number>[];
  xKey: string;
  yKey: string;
  knownOrder: string[];
  valueFormat?: ValueFormat;
}) {
  if (data.length === 0) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 34)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 4 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} vertical />
        <XAxis type="number" tick={{ fontSize: 11, fill: "var(--text-faint)" }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey={xKey} width={130} tick={{ fontSize: 11.5, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
        <Tooltip content={<ChartTooltip valueFormat={valueFormat} />} cursor={{ fill: "var(--bg-subtle)" }} />
        <Bar dataKey={yKey} radius={[0, 4, 4, 0]} maxBarSize={22}>
          {data.map((d, i) => <Cell key={i} fill={stableColor(String(d[xKey]), knownOrder)} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function EmptyChart() {
  return <div className="flex h-32 items-center justify-center text-sm text-[var(--text-faint)]">No data in this range.</div>;
}
