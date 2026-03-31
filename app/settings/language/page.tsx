"use client";

import { useLanguage } from "@/lib/i18n/language-context";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Globe, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const languages = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "da", label: "Dansk", flag: "🇩🇰" },
] as const;

export default function LanguagePage() {
  const { locale, toggleLocale } = useLanguage();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="size-4" />
            Language
          </CardTitle>
          <CardDescription>
            Choose your preferred language for the interface.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {languages.map((lang) => {
              const isActive = locale === lang.code;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => {
                    if (locale !== lang.code) toggleLocale();
                  }}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border p-4 text-left transition-colors",
                    isActive
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "hover:bg-muted/50"
                  )}
                >
                  <span className="text-2xl">{lang.flag}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{lang.label}</p>
                  </div>
                  {isActive && (
                    <Check className="size-4 text-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
