"use client";

import Link from "next/link";
import { Flame, ArrowRight } from "lucide-react";
import { useLanguage } from "@/lib/i18n/language-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function LockedTeaser() {
  const { t } = useLanguage();
  const l = t.matches.locked;

  return (
    <Card className="py-16 sm:py-20 border-0 shadow-sm">
      <CardContent className="text-center max-w-md mx-auto">
        <div className="w-20 h-20 rounded-2xl bg-linear-to-br from-blue-500/10 to-cyan-400/10 flex items-center justify-center mx-auto mb-6">
          <Flame className="size-9 text-primary/60" />
        </div>
        <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground mb-2 font-(family-name:--font-manrope)">
          {l.title}
        </h2>
        <p className="text-sm text-muted-foreground leading-6 mb-7">{l.subtitle}</p>
        <Button
          variant="gradient"
          size="lg"
          className="h-11 px-6 rounded-xl gap-2 font-bold"
          render={<Link href="/settings?tab=subscription" />}
        >
          {l.cta}
          <ArrowRight className="size-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
