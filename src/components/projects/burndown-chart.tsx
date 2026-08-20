import type { BurndownPoint } from "@/lib/reports";

export function BurndownChart({
  points,
  committed,
}: {
  points: BurndownPoint[];
  committed: number;
}) {
  const w = 640;
  const h = 220;
  const pad = 28;
  if (!points.length) {
    return <p className="text-sm text-zinc-500">Ще немає точок для burndown — почніть спринт і рухайте задачі.</p>;
  }
  const maxY = Math.max(committed, ...points.map((p) => p.remaining_points), 1);
  const xs = points.map((_, i) => pad + (i * (w - pad * 2)) / Math.max(points.length - 1, 1));
  const y = (v: number) => pad + (1 - v / maxY) * (h - pad * 2);
  const remaining = points.map((p, i) => `${xs[i]},${y(p.remaining_points)}`).join(" ");
  const idealPts = points.map((p, i) => `${xs[i]},${y(p.ideal ?? 0)}`).join(" ");

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-56 w-full min-w-[320px]">
        <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="#a1a1aa" strokeWidth="1" />
        <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="#a1a1aa" strokeWidth="1" />
        {idealPts ? (
          <polyline fill="none" stroke="#94a3b8" strokeDasharray="4 4" strokeWidth="2" points={idealPts} />
        ) : null}
        <polyline fill="none" stroke="#0284c7" strokeWidth="2.5" points={remaining} />
        {points.map((p, i) => (
          <circle key={p.day} cx={xs[i]} cy={y(p.remaining_points)} r="3" fill="#0284c7" />
        ))}
        <text x={pad} y={16} className="fill-zinc-500" fontSize="11">
          {Math.round(maxY)} SP
        </text>
        <text x={w - pad - 40} y={h - 8} className="fill-zinc-500" fontSize="11">
          {points[points.length - 1]?.day}
        </text>
      </svg>
      <p className="text-xs text-zinc-500">
        Суцільна — залишок story points. Пунктир — ідеальна лінія до кінця спринту.
      </p>
    </div>
  );
}
