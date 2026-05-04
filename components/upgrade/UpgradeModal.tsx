"use client";

import { useRouter } from "next/navigation";
import { Zap } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useUpgradePrompt, FEATURE_LABELS, FEATURE_TO_USAGE_KEY } from "@/lib/hooks/use-upgrade-prompt";
import { useSubscription } from "@/lib/hooks/use-subscription";

export function UpgradeModal() {
  const router = useRouter();
  const { open, featureKey, closeUpgrade } = useUpgradePrompt();
  const { data: sub } = useSubscription();

  const label = featureKey ? (FEATURE_LABELS[featureKey] ?? featureKey) : null;
  const usageKey = featureKey ? FEATURE_TO_USAGE_KEY[featureKey] : null;
  const quota = usageKey && sub?.usage ? sub.usage[usageKey] : null;
  const isUnlimited = quota?.limit === -1;

  const pct =
    quota && !isUnlimited && quota.limit > 0
      ? Math.min(100, Math.round((quota.used / quota.limit) * 100))
      : 100;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && closeUpgrade()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900">
            <Zap size={16} className="text-amber-500" />
            Usage Limit Reached
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <p className="text-sm text-slate-600">
            You&apos;ve used all your <strong>{label}</strong> for this billing period.
          </p>

          {quota && !isUnlimited && (
            <div>
              <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                <span>{label}</span>
                <span className="font-medium text-slate-700">
                  {quota.used} / {quota.limit}
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500 rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}

          <p className="text-xs text-slate-400">
            Upgrade your plan to get more {label?.toLowerCase()}.
          </p>

          <div className="flex gap-2 pt-1">
            <Button
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => {
                closeUpgrade();
                router.push("/settings?tab=subscription");
              }}
            >
              Upgrade Plan →
            </Button>
            <Button variant="outline" onClick={closeUpgrade}>
              Maybe Later
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
