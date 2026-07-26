"use client";

import { useState, type KeyboardEvent } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ArrowUp } from "lucide-react";
import { useLanguage } from "@/lib/i18n/language-context";

export function ChatInput({
  onSend,
  disabled,
}: {
  onSend: (text: string) => void;
  disabled: boolean;
}) {
  const { t } = useLanguage();
  const [value, setValue] = useState("");

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="relative shrink-0 border-t border-white/6 bg-[#0a0f1e]/80 backdrop-blur-2xl">
      <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
      <div className="flex items-end gap-2 p-4 max-w-2xl mx-auto">
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
          placeholder={t.chat.inputPlaceholder}
          className="resize-none min-h-[46px] max-h-32 bg-white/[0.04] border-white/10 text-white placeholder:text-slate-500 rounded-xl focus-visible:border-cyan-400/50 focus-visible:ring-cyan-400/20"
        />
        <Button
          onClick={submit}
          disabled={disabled || !value.trim()}
          size="icon"
          variant="gradient"
          className="rounded-xl h-[46px] w-[46px] shrink-0"
        >
          <ArrowUp className="size-4" />
        </Button>
      </div>
    </div>
  );
}
