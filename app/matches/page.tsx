"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Flame, X, Heart, Loader2 } from "lucide-react";
import DashboardLayout from "@/components/dashboard-layout";
import { InlineLoader } from "@/components/loading-screen";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/lib/i18n/language-context";
import { cn } from "@/lib/utils";
import { useMatchFeed } from "@/lib/hooks/use-match-feed";
import { MatchCard } from "@/components/matches/match-card";
import { LockedTeaser } from "@/components/matches/locked-teaser";

const EXIT_MS = 220;

export default function MatchesPage() {
  const { t, locale } = useLanguage();
  const m = t.matches;

  const { entitled, matches, isLoading, isError, decide, isDeciding } = useMatchFeed();

  // Track how many cards the user has decided this session. Progress = decided/total,
  // where total = remaining pending + already decided (invariant across the deck).
  // Updated only in the decide handler (an event handler) — never in render or an
  // effect — so it stays lint-clean and cascade-free.
  const [decided, setDecided] = useState(0);

  const current = matches[0] ?? null;
  const total = matches.length + decided;
  const currentIndex = decided + 1;

  const [exiting, setExiting] = useState<null | "left" | "right">(null);
  const exitingRef = useRef(false);

  const handleDecide = useCallback(
    (decision: "accepted" | "rejected") => {
      if (!current || isDeciding || exitingRef.current) return;
      exitingRef.current = true;
      setExiting(decision === "rejected" ? "left" : "right");
      const id = current.id;
      window.setTimeout(() => {
        decide(id, decision);
        setDecided((n) => n + 1);
        setExiting(null);
        exitingRef.current = false;
      }, EXIT_MS);
    },
    [current, isDeciding, decide]
  );

  // Keyboard shortcuts: ←/x = pass, →/l/Enter = save.
  useEffect(() => {
    if (!entitled || !current) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      const key = e.key.toLowerCase();
      if (e.key === "ArrowLeft" || key === "x") {
        e.preventDefault();
        handleDecide("rejected");
      } else if (e.key === "ArrowRight" || key === "l" || e.key === "Enter") {
        e.preventDefault();
        handleDecide("accepted");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [entitled, current, handleDecide]);

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground font-(family-name:--font-manrope)">
          {m.title}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{m.subtitle}</p>
      </div>

      {/* Loading */}
      {isLoading && <InlineLoader message={`${m.title}...`} />}

      {/* Error */}
      {!isLoading && isError && (
        <Card className="py-16 border-0 shadow-sm">
          <CardContent className="text-center">
            <p className="text-foreground font-semibold mb-1">
              {locale === "da" ? "Kunne ikke indlæse match" : "Couldn't load matches"}
            </p>
            <p className="text-muted-foreground text-sm">
              {locale === "da" ? "Prøv igen om lidt." : "Please try again shortly."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Locked (free / starter) */}
      {!isLoading && !isError && !entitled && <LockedTeaser />}

      {/* Empty — all caught up */}
      {!isLoading && !isError && entitled && matches.length === 0 && (
        <Card className="py-20 border-0 shadow-sm">
          <CardContent className="text-center">
            <div className="w-20 h-20 rounded-2xl bg-primary/5 flex items-center justify-center mx-auto mb-5">
              <Flame className="size-9 text-primary/30" />
            </div>
            <p className="text-foreground font-semibold text-lg mb-1.5">{m.empty.title}</p>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto">{m.empty.subtitle}</p>
          </CardContent>
        </Card>
      )}

      {/* Deck */}
      {!isLoading && !isError && entitled && current && (
        <div className="max-w-2xl mx-auto">
          {/* Progress */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-muted-foreground tabular-nums">
              {m.progress
                .replace("{current}", String(currentIndex))
                .replace("{total}", String(total))}
            </p>
            <div className="h-1.5 w-32 sm:w-48 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-linear-to-r from-blue-500 to-cyan-400 transition-all duration-300"
                style={{ width: `${total > 0 ? (currentIndex / total) * 100 : 0}%` }}
              />
            </div>
          </div>

          {/* Animated current card */}
          <div className="relative">
            <div
              key={current.id}
              className={cn(
                "transition-all duration-200 ease-out will-change-transform",
                exiting === "left" && "-translate-x-[120%] -rotate-6 opacity-0",
                exiting === "right" && "translate-x-[120%] rotate-6 opacity-0",
                !exiting && "translate-x-0 rotate-0 opacity-100"
              )}
            >
              <MatchCard item={current} colorIndex={currentIndex - 1} />
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex items-center justify-center gap-3 sm:gap-4">
            <Button
              variant="outline"
              size="lg"
              onClick={() => handleDecide("rejected")}
              disabled={isDeciding || !!exiting}
              className="h-12 px-6 rounded-xl gap-2 font-semibold border-border/70 hover:border-red-300 hover:bg-red-50/60 hover:text-red-600"
            >
              <X className="size-4" />
              {m.reject}
            </Button>
            <Button
              variant="gradient"
              size="lg"
              onClick={() => handleDecide("accepted")}
              disabled={isDeciding || !!exiting}
              className="h-12 px-6 rounded-xl gap-2 font-bold"
            >
              {isDeciding ? <Loader2 className="size-4 animate-spin" /> : <Heart className="size-4" />}
              {m.accept}
            </Button>
          </div>

          {/* Keyboard hint */}
          <p className="mt-4 text-center text-xs text-muted-foreground/60">{m.keyboardHint}</p>
        </div>
      )}
    </DashboardLayout>
  );
}
