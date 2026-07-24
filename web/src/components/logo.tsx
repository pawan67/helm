/**
 * IRONHANG mark — a pull-up bar with a figure hanging, drawn as a minimal
 * instrument glyph. Uses the lime accent and reads at small sizes.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="1"
        y="1"
        width="38"
        height="38"
        rx="10"
        fill="#101318"
        stroke="#262c35"
      />
      {/* mounts */}
      <path d="M9 8v5M31 8v5" stroke="#38404b" strokeWidth="2.4" strokeLinecap="round" />
      {/* bar */}
      <rect x="7" y="12" width="26" height="3.2" rx="1.6" fill="#c8f731" />
      {/* hands */}
      <path
        d="M14.5 13.6v3M25.5 13.6v3"
        stroke="#c8f731"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      {/* hanging body */}
      <path
        d="M20 16.5v11"
        stroke="#eceef1"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <circle cx="20" cy="30.5" r="2.6" fill="#34e0d0" />
    </svg>
  );
}
