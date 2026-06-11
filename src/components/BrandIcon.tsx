export function BrandIcon({ className }: { className?: string }) {
  return (
    <span className={["brand-icon", className].filter(Boolean).join(" ")}>
      <svg className="brand-symbol" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
        <path d="M15 7.5 40.5 33 34.5 39 9 13.5z" />
        <path d="M34.5 8.5 40.5 14.5 15 40 9 34z" />
        <path className="brand-symbol-accent" d="M8.5 21.5 14.5 15.5 25.5 26.5 19.5 32.5z" />
      </svg>
    </span>
  );
}
