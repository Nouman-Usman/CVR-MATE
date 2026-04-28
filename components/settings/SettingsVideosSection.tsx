"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

export function SettingsVideosSection() {
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-videos"],
    queryFn: async () => {
      const res = await fetch("/api/admin/videos");
      if (!res.ok) throw new Error("Failed to fetch videos");
      return res.json();
    },
  });

  if (isLoading) return <div className="text-sm text-slate-500">Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Feature Videos</h3>
        <p className="text-sm text-slate-500">Manage contextual tutorial videos</p>
      </div>

      {/* Placeholder: Full admin UI comes next iteration */}
      <div className="border rounded-lg p-4 text-sm text-slate-600">
        Videos admin UI coming soon. {data?.length || 0} features registered.
      </div>
    </div>
  );
}
