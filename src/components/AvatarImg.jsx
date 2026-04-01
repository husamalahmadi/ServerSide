import React from "react";

/**
 * Google-hosted avatars often return 403 in the browser unless Referer is suppressed.
 */
export function AvatarImg({ src, alt = "", size = 28, style = {} }) {
  if (!src) return null;
  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      loading="lazy"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        objectFit: "cover",
        ...style,
      }}
    />
  );
}
