"use client";

import { AlertCircle } from "lucide-react";

export function VideoUnavailable() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
      <AlertCircle className="w-8 h-8 text-slate-400" />
      <div>
        <p className="text-sm font-medium text-slate-900">Video unavailable</p>
        <p className="text-xs text-slate-500 mt-1">
          This tutorial video could not be loaded.
        </p>
      </div>
    </div>
  );
}
