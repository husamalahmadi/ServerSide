import React from "react";

/**
 * @param {{ label: string, value: number, color: string }[]} segments
 */
export function DonutChart({ segments, size = 140, centerLabel, centerValue }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = size / 2 - 12;
  const cx = size / 2;
  const cy = size / 2;
  let angle = -90;

  const arcs = segments.map((seg) => {
    const sweep = (seg.value / total) * 360;
    const start = angle;
    angle += sweep;
    const end = angle;
    const large = sweep > 180 ? 1 : 0;
    const rad = (deg) => (deg * Math.PI) / 180;
    const x1 = cx + r * Math.cos(rad(start));
    const y1 = cy + r * Math.sin(rad(start));
    const x2 = cx + r * Math.cos(rad(end));
    const y2 = cy + r * Math.sin(rad(end));
    const d =
      sweep >= 359.99
        ? `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy}`
        : `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
    return { ...seg, d };
  });

  return (
    <div className="tp-donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={centerLabel}>
        {arcs.map((a) => (
          <path key={a.label} d={a.d} fill="none" stroke={a.color} strokeWidth="18" strokeLinecap="butt" />
        ))}
        <circle cx={cx} cy={cy} r={r - 22} fill="var(--tp-surface)" />
        <text x={cx} y={cy - 4} textAnchor="middle" style={{ fontSize: 10, fill: "var(--tp-muted)", fontWeight: 600 }}>
          {centerLabel}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" style={{ fontSize: 15, fill: "var(--tp-ink-strong)", fontWeight: 800 }}>
          {centerValue}
        </text>
      </svg>
      <div className="tp-donut-legend">
        {segments.map((s) => (
          <div key={s.label} className="tp-donut-legend-item">
            <span>
              <span className="tp-donut-dot" style={{ background: s.color }} />
              {s.label}
            </span>
            <b>{((s.value / total) * 100).toFixed(0)}%</b>
          </div>
        ))}
      </div>
    </div>
  );
}
