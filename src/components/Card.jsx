import React from "react";

export function Card({ title, children, style, className = "" }) {
  return (
    <section className={`tp-card ${className}`.trim()} style={style}>
      {title ? (
        <header className="tp-card-head">
          <h2 className="tp-card-title">{title}</h2>
        </header>
      ) : null}
      <div className="tp-card-pad">{children}</div>
    </section>
  );
}
