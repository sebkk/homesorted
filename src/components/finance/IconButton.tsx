export function IconButton({
  label,
  onClick,
  danger = false,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`shrink-0 w-7 h-7 rounded-md border-none bg-transparent text-ink-faint flex items-center justify-center ${
        danger ? "hover:bg-critical-soft hover:text-critical" : "hover:bg-accent-soft hover:text-accent"
      }`}
    >
      {children}
    </button>
  );
}
