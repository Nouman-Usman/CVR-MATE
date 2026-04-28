"use client";

import { PlayCircle } from "lucide-react";

interface VideoButtonProps {
  onClick: () => void;
  className?: string;
}

export function VideoButton({ onClick, className = "" }: VideoButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors ${className}`}
      title="Watch tutorial"
    >
      <PlayCircle className="w-4 h-4" />
      <span>Watch tutorial</span>
    </button>
  );
}
