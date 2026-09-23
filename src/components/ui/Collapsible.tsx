"use client";

// Animates height via grid-template-rows (0fr -> 1fr) instead of plain
// conditional rendering, so expand/collapse transitions smoothly regardless
// of the content's actual height.
export function Collapsible({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div className="grid transition-[grid-template-rows] duration-200 ease-out" style={{ gridTemplateRows: open ? "1fr" : "0fr" }}>
      <div className="overflow-hidden min-h-0">{children}</div>
    </div>
  );
}
