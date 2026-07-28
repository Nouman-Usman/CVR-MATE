"use client";

import DashboardLayout from "@/components/dashboard-layout";
import { AgentChat } from "@/components/agent/AgentChat";

export default function AgentPage() {
  return (
    <DashboardLayout>
      <AgentChat />
    </DashboardLayout>
  );
}
