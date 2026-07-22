"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function MessageList({
  messages,
  isTyping,
  children,
}: {
  messages: ChatMessage[];
  isTyping: boolean;
  children?: React.ReactNode;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isTyping, children]);

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-5">
      {messages.map((message, i) =>
        message.role === "assistant" ? (
          <div key={i} className="max-w-[85%] animate-in fade-in slide-in-from-bottom-1 duration-300">
            <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-cyan-400/70 mb-1.5">
              CVR-MATE
            </p>
            <p className="border-l-2 border-white/10 pl-3 text-[15px] leading-relaxed text-white/90 whitespace-pre-wrap">
              {message.content}
            </p>
          </div>
        ) : (
          <div key={i} className="flex justify-end animate-in fade-in slide-in-from-bottom-1 duration-300">
            <div
              className={cn(
                "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                "bg-white/[0.06] border border-white/10 backdrop-blur-md text-white/95"
              )}
            >
              {message.content}
            </div>
          </div>
        )
      )}
      {isTyping && (
        <p className="font-mono text-xs text-cyan-400/60 animate-pulse">
          &gt; querying the registry...
        </p>
      )}
      {children}
      <div ref={bottomRef} />
    </div>
  );
}
