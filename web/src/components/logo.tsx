/**
 * HELM mark — a helm wheel on a soft-rounded slate plate: teal rim and grips
 * (the same calm signal as the rest of the system), chalk spokes and hub. The
 * wheel reads as "you're at the helm / in command". Pass `size` (px) to scale.
 */
export function Logo({
  size = 32,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      {/* slate plate, soft-rounded */}
      <rect
        x="1.5"
        y="1.5"
        width="37"
        height="37"
        rx="9"
        fill="#20242b"
        stroke="#3b414a"
      />

      {/* grips — teal nubs beyond the rim, at each spoke */}
      <g stroke="#a3e635" strokeWidth="2.6" strokeLinecap="round">
        <path d="M29.5 20 33.4 20" />
        <path d="M24.8 28.2 26.8 31.6" />
        <path d="M15.2 28.2 13.2 31.6" />
        <path d="M10.5 20 6.6 20" />
        <path d="M15.2 11.8 13.2 8.4" />
        <path d="M24.8 11.8 26.8 8.4" />
      </g>

      {/* rim — the calm signal */}
      <circle cx="20" cy="20" r="9.5" stroke="#a3e635" strokeWidth="2.2" />

      {/* spokes — chalk */}
      <g stroke="#eef0f4" strokeWidth="1.7" strokeLinecap="round">
        <path d="M20 20 29.5 20" />
        <path d="M20 20 24.8 28.2" />
        <path d="M20 20 15.2 28.2" />
        <path d="M20 20 10.5 20" />
        <path d="M20 20 15.2 11.8" />
        <path d="M20 20 24.8 11.8" />
      </g>

      {/* hub — chalk with a slate center */}
      <circle cx="20" cy="20" r="3" fill="#eef0f4" />
      <circle cx="20" cy="20" r="1.1" fill="#20242b" />
    </svg>
  );
}
