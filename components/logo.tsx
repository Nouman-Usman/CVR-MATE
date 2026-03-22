/**
 * CVR-MATE Logo — Interconnected nodes representing data intelligence.
 * Three nodes connected by lines forming an abstract "signal" shape.
 */

export function LogoIcon({
  size = 32,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="logo-grad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2563eb" />
          <stop offset="1" stopColor="#0ea5e9" />
        </linearGradient>
      </defs>
      {/* Background rounded square */}
      <rect width="40" height="40" rx="10" fill="url(#logo-grad)" />
      {/* Connecting lines */}
      <path
        d="M12 28L20 12L28 22"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.5"
      />
      <path
        d="M12 28L28 22"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.3"
      />
      {/* Nodes */}
      <circle cx="20" cy="12" r="4" fill="white" />
      <circle cx="12" cy="28" r="3.5" fill="white" opacity="0.9" />
      <circle cx="28" cy="22" r="3.5" fill="white" opacity="0.9" />
      {/* Center pulse dot */}
      <circle cx="20" cy="20" r="2" fill="white" opacity="0.6" />
    </svg>
  );
}

export function LogoFull({
  size = "default",
  variant = "light",
  className = "",
}: {
  size?: "small" | "default" | "large";
  variant?: "light" | "dark";
  className?: string;
}) {
  const iconSize = size === "small" ? 28 : size === "large" ? 40 : 32;
  const textClass =
    size === "small"
      ? "text-lg"
      : size === "large"
        ? "text-2xl"
        : "text-xl";
  const textColor =
    variant === "dark" ? "text-white" : "text-slate-900";

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoIcon size={iconSize} />
      <span
        className={`${textClass} font-black tracking-tighter font-[family-name:var(--font-manrope)] ${textColor}`}
      >
        CVR-MATE
      </span>
    </div>
  );
}

export function LogoIconOnly({
  size = 32,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return <LogoIcon size={size} className={className} />;
}
