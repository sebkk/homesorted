/** HomeSorted mark: a house split into four compartments (the app's modules —
 * finance, pantry and those still to come; the lighter one is the next slot).
 * Same drawing as public/icons/icon.svg, which the PWA/favicon PNGs are
 * rendered from — keep the two in sync. */
export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" fill="none" aria-hidden>
      <rect x="1" y="1" width="24" height="24" rx="7" fill="var(--accent)" />
      <LogoGlyph />
    </svg>
  );
}

export function LogoGlyph() {
  return (
    <>
      <g stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M6.2 12.4L13 6.4l6.8 6" />
        <path d="M8.4 11v8.6h9.2V11" />
      </g>
      <g fill="#fff">
        <rect x="10.3" y="12.6" width="2.3" height="2.3" rx="0.6" />
        <rect x="13.4" y="12.6" width="2.3" height="2.3" rx="0.6" />
        <rect x="10.3" y="15.7" width="2.3" height="2.3" rx="0.6" />
        <rect x="13.4" y="15.7" width="2.3" height="2.3" rx="0.6" opacity={0.45} />
      </g>
    </>
  );
}
