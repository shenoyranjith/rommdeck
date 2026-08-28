import { useId } from "react";
import { BRAND_MARK_FRAME } from "../assets/brand-mark-paths";

/** RD mark — chamfered frame, grid fill, neon glow (matches assets/brand-mark.svg). */
export function BrandMark({ size = 128 }: { size?: number }) {
  const uid = useId().replace(/:/g, "");
  const gridId = `brand-grid-${uid}`;
  const glowId = `brand-glow-${uid}`;
  const neonId = `brand-neon-${uid}`;

  const frame = BRAND_MARK_FRAME;

  return (
    <svg
      className="brand-mark"
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden
    >
      <defs>
        <pattern id={gridId} width="9" height="9" patternUnits="userSpaceOnUse">
          <path
            d="M 9 0 L 0 0 0 9"
            fill="none"
            stroke="var(--accent)"
            strokeOpacity="0.16"
            strokeWidth="0.65"
          />
        </pattern>
        <radialGradient id={glowId} cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.12" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
        <filter id={neonId} x="-35%" y="-35%" width="170%" height="170%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.1" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <polygon points={frame} fill="#050505" />
      <polygon points={frame} fill={`url(#${gridId})`} />
      <polygon points={frame} fill={`url(#${glowId})`} />
      <polygon
        points={frame}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2.75"
        strokeLinejoin="miter"
        filter={`url(#${neonId})`}
      />
      <text
        x="50"
        y="53"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="var(--accent)"
        fontSize="48"
        fontWeight="750"
        fontFamily="var(--font), system-ui, sans-serif"
        letterSpacing="2.5"
        filter={`url(#${neonId})`}
      >
        RD
      </text>
    </svg>
  );
}
