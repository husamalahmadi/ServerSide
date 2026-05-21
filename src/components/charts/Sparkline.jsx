import React from "react";

export function Sparkline({ values = [], color = "#2c7be5", width = 88, height = 36 }) {
  const data = values.length ? values : [12, 18, 14, 22, 19, 28, 24];
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 4;
  const iw = width - pad * 2;
  const ih = height - pad * 2;

  const points = data.map((v, i) => {
    const x = pad + (i / Math.max(1, data.length - 1)) * iw;
    const y = pad + ih - ((v - min) / range) * ih;
    return `${x},${y}`;
  });
  const line = `M ${points.join(" L ")}`;
  const area = `${line} L ${pad + iw} ${pad + ih} L ${pad} ${pad + ih} Z`;

  return (
    <svg className="tp-chart-mini" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <path d={area} fill={color} opacity="0.15" />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
