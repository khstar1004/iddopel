export function BrandIcon({ className }: { className?: string }) {
  return (
    <span className={["brand-icon", className].filter(Boolean).join(" ")}>
      <img className="brand-symbol" src="/brand/id-doppelganger-mark.png" alt="" />
    </span>
  );
}
