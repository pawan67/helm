/**
 * HELM mark — a machined helm wheel: steel plate, hazard-amber rim and grips,
 * chalk spokes and hub. The wheel reads as "you're at the helm / command"; the
 * hazard rim is the same hot signal as the rest of the system. Hard-cornered
 * plate to match the industrial console. Pass `size` (px) to scale it.
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
      {/* steel plate */}
      <rect
        x="1.5"
        y="1.5"
        width="37"
        height="37"
        rx="3"
        fill="#191c20"
        stroke="#454b53"
      />

      {/* grips — hazard nubs beyond the rim, at each spoke */}
      <g stroke="#f0882e" strokeWidth="2.6" strokeLinecap="square">
        <path d="M29.5 20 33.4 20" />
        <path d="M24.8 28.2 26.8 31.6" />
        <path d="M15.2 28.2 13.2 31.6" />
        <path d="M10.5 20 6.6 20" />
        <path d="M15.2 11.8 13.2 8.4" />
        <path d="M24.8 11.8 26.8 8.4" />
      </g>

      {/* rim — the hot signal */}
      <circle cx="20" cy="20" r="9.5" stroke="#f0882e" strokeWidth="2.2" />

      {/* spokes — chalk */}
      <g stroke="#e8eaee" strokeWidth="1.7" strokeLinecap="round">
        <path d="M20 20 29.5 20" />
        <path d="M20 20 24.8 28.2" />
        <path d="M20 20 15.2 28.2" />
        <path d="M20 20 10.5 20" />
        <path d="M20 20 15.2 11.8" />
        <path d="M20 20 24.8 11.8" />
      </g>

      {/* hub — chalk with a machined steel center */}
      <circle cx="20" cy="20" r="3" fill="#e8eaee" />
      <circle cx="20" cy="20" r="1.1" fill="#191c20" />
    </svg>
  );
}
