// Circular rating badge — shows a score (0-10) as a ring with percentage fill.
// Used on cards and detail pages for a distinctive "infotainment" feel.

'use client';

interface RatingRingProps {
  score: number;        // 0-10
  size?: number;        // px diameter
  className?: string;
  showNumber?: boolean;
}

export function RatingRing({ score, size = 40, className, showNumber = true }: RatingRingProps) {
  const pct = Math.max(0, Math.min(100, (score / 10) * 100));
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  // Color based on score: green (high) → gold (mid) → red (low)
  const color =
    score >= 8 ? '#22c55e' :
    score >= 6 ? '#eab308' :
    score >= 4 ? '#f97316' :
    '#ef4444';

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className ?? ''}`}
      style={{ width: size, height: size }}
      title={`Rating: ${score.toFixed(1)}/10`}
    >
      <svg
        className="rating-ring absolute inset-0"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.15)"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 600ms cubic-bezier(0.16, 1, 0.3, 1)' }}
        />
      </svg>
      {showNumber && (
        <span
          className="relative font-bold text-white leading-none"
          style={{ fontSize: size * 0.28 }}
        >
          {score.toFixed(1)}
        </span>
      )}
    </div>
  );
}
