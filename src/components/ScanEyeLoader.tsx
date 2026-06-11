export function ScanEyeLoader({ compact = false }: { compact?: boolean }) {
  return (
    <svg
      className="scan-eye-loader"
      data-compact={compact ? "true" : "false"}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 120 120"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M 15 60 Q 60 20 105 60 Q 60 100 15 60 Z"
        fill="none"
        stroke="#8c8a85"
        strokeLinejoin="round"
        strokeWidth="5"
      />
      <circle
        cx="60"
        cy="60"
        r="16"
        fill="none"
        stroke="#b0aeaa"
        strokeDasharray="25 15"
        strokeLinecap="round"
        strokeWidth="5"
      >
        <animateTransform
          attributeName="transform"
          dur="1.2s"
          from="0 60 60"
          repeatCount="indefinite"
          to="360 60 60"
          type="rotate"
        />
      </circle>
      <circle cx="60" cy="60" r="4" fill="#b0aeaa">
        <animate attributeName="r" dur="1.2s" repeatCount="indefinite" values="3; 5; 3" />
      </circle>
    </svg>
  );
}
