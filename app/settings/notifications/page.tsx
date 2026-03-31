"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Bell, Mail, Zap, BarChart3 } from "lucide-react";

function NotificationToggle({
  icon: Icon,
  label,
  description,
  checked,
  onCheckedChange,
}: {
  icon: typeof Mail;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export default function NotificationsPage() {
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [triggerAlerts, setTriggerAlerts] = useState(true);
  const [weeklyReport, setWeeklyReport] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      // TODO: persist notification preferences
      toast.success("Notification preferences saved");
    } catch {
      toast.error("Failed to save preferences");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="size-4" />
            Notifications
          </CardTitle>
          <CardDescription>
            Choose what notifications you want to receive.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <NotificationToggle
              icon={Mail}
              label="Email Notifications"
              description="Receive important updates and alerts via email."
              checked={emailNotifs}
              onCheckedChange={setEmailNotifs}
            />
            <NotificationToggle
              icon={Zap}
              label="Trigger Alerts"
              description="Get notified when a trigger fires for a saved company."
              checked={triggerAlerts}
              onCheckedChange={setTriggerAlerts}
            />
            <NotificationToggle
              icon={BarChart3}
              label="Weekly Report"
              description="Receive a weekly summary of your workspace activity."
              checked={weeklyReport}
              onCheckedChange={setWeeklyReport}
            />
          </div>

          <div className="mt-6 flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Preferences"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
