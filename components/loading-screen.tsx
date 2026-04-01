"use client";

/**
 * InlineLoader — lighter version for use inside DashboardLayout pages.
 * Shows the animated logo centered in a container (not full-screen).
 */
export function InlineLoader({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 sm:py-32">
      <div className="relative">
        {/* Pulse rings */}
        <div className="absolute inset-[-8px] rounded-2xl border border-blue-500/10 animate-[pulse-ring_2s_ease-out_infinite]" />
        <div className="absolute inset-[-16px] rounded-3xl border border-blue-500/5 animate-[pulse-ring_2s_ease-out_infinite_0.5s]" />

        {/* Animated logo */}
        <svg
          width={56}
          height={56}
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="relative z-10 drop-shadow-[0_4px_20px_rgba(37,99,235,0.12)]"
        >
          <defs>
            <linearGradient id="inline-logo-grad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
              <stop stopColor="#2563eb" />
              <stop offset="1" stopColor="#0ea5e9" />
            </linearGradient>
          </defs>
          <rect width="40" height="40" rx="10" fill="url(#inline-logo-grad)" />
          <path d="M12 28L20 12L28 22" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-[line-draw_2s_ease-in-out_infinite]" />
          <path d="M12 28L28 22" stroke="white" strokeWidth="2" strokeLinecap="round" className="animate-[line-draw_2s_ease-in-out_infinite_0.3s]" />
          <circle cx="20" cy="12" r="4" fill="white" className="animate-[node-pulse_1.5s_ease-in-out_infinite]" />
          <circle cx="12" cy="28" r="3.5" fill="white" className="animate-[node-pulse_1.5s_ease-in-out_infinite_0.3s]" />
          <circle cx="28" cy="22" r="3.5" fill="white" className="animate-[node-pulse_1.5s_ease-in-out_infinite_0.6s]" />
          <circle cx="20" cy="20" r="2" fill="white" className="animate-[center-ping_2s_ease-in-out_infinite]" />
        </svg>
      </div>

      {/* Loading dots + optional message */}
      <div className="flex flex-col items-center gap-2 mt-6">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-600/50 animate-[bounce-dot_1.2s_ease-in-out_infinite]" />
          <div className="w-1.5 h-1.5 rounded-full bg-blue-600/50 animate-[bounce-dot_1.2s_ease-in-out_infinite_0.2s]" />
          <div className="w-1.5 h-1.5 rounded-full bg-blue-600/50 animate-[bounce-dot_1.2s_ease-in-out_infinite_0.4s]" />
        </div>
        {message && (
          <p className="text-sm text-muted-foreground/60 font-medium">{message}</p>
        )}
      </div>
    </div>
  );
}

export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#f7f9fb]">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/[0.04] rounded-full blur-[120px]" />
        <div className="absolute top-1/3 left-1/3 w-[300px] h-[300px] bg-cyan-500/[0.03] rounded-full blur-[80px] animate-[drift_8s_ease-in-out_infinite]" />
      </div>

      <div className="relative flex flex-col items-center gap-8">
        {/* Logo container with animations */}
        <div className="relative">
          {/* Orbiting ring */}
          <div className="absolute inset-[-20px] animate-[spin_4s_linear_infinite]">
            <svg viewBox="0 0 120 120" className="w-full h-full">
              <circle
                cx="60"
                cy="60"
                r="56"
                fill="none"
                stroke="url(#orbit-grad)"
                strokeWidth="1.5"
                strokeDasharray="8 16"
                strokeLinecap="round"
                opacity="0.4"
              />
              <defs>
                <linearGradient id="orbit-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity="0.6" />
                  <stop offset="50%" stopColor="#0ea5e9" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {/* Pulse rings */}
          <div className="absolute inset-[-8px] rounded-2xl border border-blue-500/10 animate-[pulse-ring_2s_ease-out_infinite]" />
          <div className="absolute inset-[-16px] rounded-3xl border border-blue-500/5 animate-[pulse-ring_2s_ease-out_infinite_0.5s]" />

          {/* Animated logo */}
          <svg
            width={80}
            height={80}
            viewBox="0 0 40 40"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="relative z-10 drop-shadow-[0_8px_30px_rgba(37,99,235,0.15)]"
          >
            <defs>
              <linearGradient id="loading-logo-grad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                <stop stopColor="#2563eb" />
                <stop offset="1" stopColor="#0ea5e9" />
              </linearGradient>
            </defs>
            {/* Background */}
            <rect width="40" height="40" rx="10" fill="url(#loading-logo-grad)" />
            {/* Connecting lines — animate opacity */}
            <path
              d="M12 28L20 12L28 22"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="animate-[line-draw_2s_ease-in-out_infinite]"
            />
            <path
              d="M12 28L28 22"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              className="animate-[line-draw_2s_ease-in-out_infinite_0.3s]"
            />
            {/* Nodes — staggered pulse */}
            <circle cx="20" cy="12" r="4" fill="white" className="animate-[node-pulse_1.5s_ease-in-out_infinite]" />
            <circle cx="12" cy="28" r="3.5" fill="white" className="animate-[node-pulse_1.5s_ease-in-out_infinite_0.3s]" />
            <circle cx="28" cy="22" r="3.5" fill="white" className="animate-[node-pulse_1.5s_ease-in-out_infinite_0.6s]" />
            {/* Center pulse */}
            <circle cx="20" cy="20" r="2" fill="white" className="animate-[center-ping_2s_ease-in-out_infinite]" />
          </svg>
        </div>

        {/* Text with shimmer */}
        <div className="flex flex-col items-center gap-3">
          <span className="text-xl font-black tracking-tighter font-[family-name:var(--font-manrope)] bg-gradient-to-r from-slate-900 via-blue-600 to-slate-900 bg-[length:200%_100%] bg-clip-text text-transparent animate-[shimmer_3s_linear_infinite]">
            CVR-MATE
          </span>
          {/* Loading dots */}
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-600/60 animate-[bounce-dot_1.2s_ease-in-out_infinite]" />
            <div className="w-1.5 h-1.5 rounded-full bg-blue-600/60 animate-[bounce-dot_1.2s_ease-in-out_infinite_0.2s]" />
            <div className="w-1.5 h-1.5 rounded-full bg-blue-600/60 animate-[bounce-dot_1.2s_ease-in-out_infinite_0.4s]" />
          </div>
        </div>
      </div>
    </div>
  );
}
