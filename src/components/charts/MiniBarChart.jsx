import React from "react";

/** Falcon-style mini bar chart for stat cards. */
export function MiniBarChart({ values = [], color = "var(--tp-primary)", width = 88, height = 44 }) {
  const data = values.length ? values : [4, 7, 5, 9, 6, 11, 8];
  const max = Math.max(...data, 1);
  const barW = Math.max(4, (width - (data.length - 1) * 3) / data.length);

  return (
    <svg className="tp-chart-mini" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      {data.map((v, i) => {
        const h = (v / max) * (height - 6);
        const x = i * (barW + 3);
        const y = height - h;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barW}
            height={h}
            rx={2}
            fill={color}
            opacity={0.35 + (i / data.length) * 0.55}
          />
        );
      })}
    </svg>
  );
}
