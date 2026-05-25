"use client";

import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SECONDARY_NACE_CODES, searchSecondaryNaceCodes } from "@/lib/constants/secondary-nace-codes";
import { useLanguage } from "@/lib/i18n/language-context";
import { Search, X } from "lucide-react";

interface SecondaryNaceCodeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (code: string) => void;
  currentValue?: string;
}

export function SecondaryNaceCodeModal({
  open,
  onOpenChange,
  onSelect,
  currentValue,
}: SecondaryNaceCodeModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const { locale } = useLanguage();

  const results = useMemo(() => {
    if (!searchQuery.trim()) return SECONDARY_NACE_CODES;
    return searchSecondaryNaceCodes(searchQuery);
  }, [searchQuery]);

  const handleSelect = (code: string) => {
    onSelect(code);
    onOpenChange(false);
    setSearchQuery("");
  };

  const labels = {
    da: {
      title: "Sekundær industrikode",
      searchPlaceholder: "Søg efter kode eller beskrivelse...",
      noResults: "Ingen resultater fundet",
      select: "Vælg",
      total: "Resultater",
    },
    en: {
      title: "Secondary Industry Code",
      searchPlaceholder: "Search by code or description...",
      noResults: "No results found",
      select: "Select",
      total: "Results",
    },
  };

  const l = labels[locale as keyof typeof labels] || labels.en;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{l.title}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={l.searchPlaceholder}
              className="pl-9 h-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="text-xs text-muted-foreground">
            {results.length} {l.total}
          </div>

          <div className="flex-1 overflow-y-auto border rounded-lg divide-y">
            {results.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                {l.noResults}
              </div>
            ) : (
              results.map((item) => (
                <button
                  key={item.code}
                  onClick={() => handleSelect(item.code)}
                  className={`w-full px-4 py-3 flex items-center justify-between hover:bg-accent transition-colors text-left ${
                    currentValue === item.code ? "bg-accent" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-mono font-medium text-sm">{item.code}</div>
                    <div className="text-xs text-muted-foreground truncate">{item.label}</div>
                  </div>
                  {currentValue === item.code && (
                    <div className="ml-2 w-2 h-2 rounded-full bg-foreground flex-shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
