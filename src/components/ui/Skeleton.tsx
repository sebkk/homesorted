/** A shimmering placeholder block; size and shape come from `className`. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`skeleton rounded-md ${className}`} />;
}

/** Wraps skeleton blocks and announces the loading state to screen readers
 * (the blocks themselves are hidden from them). */
export function SkeletonScreen({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
