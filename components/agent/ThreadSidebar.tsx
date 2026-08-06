"use client";

import { MessageSquarePlus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n/language-context";
import { useAgentSessions, useDeleteAgentSession } from "@/lib/hooks/use-agent-sessions";

export function ThreadSidebar({
  activeId,
  onSelect,
  onNewChat,
}: {
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
}) {
  const { t } = useLanguage();
  const a = t.agent;
  const { data: sessions, isLoading } = useAgentSessions();
  const del = useDeleteAgentSession();

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-muted/30">
      <div className="p-3">
        <Button onClick={onNewChat} className="w-full justify-start gap-2" variant="outline" size="sm">
          <MessageSquarePlus className="size-4" />
          {a.newChat}
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {isLoading && <p className="px-2 py-1 text-xs text-muted-foreground">{a.loading}</p>}
        {!isLoading && (sessions?.length ?? 0) === 0 && (
          <p className="px-2 py-1 text-xs text-muted-foreground">{a.noConversations}</p>
        )}
        <div className="space-y-0.5">
          {sessions?.map((s) => (
            <div
              key={s.id}
              className={cn(
                "group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm transition-colors",
                s.id === activeId ? "bg-background shadow-sm" : "hover:bg-background/60"
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(s.id)}
                className="min-w-0 flex-1 truncate text-left text-foreground/90"
              >
                {s.title || a.untitled}
              </button>
              <button
                type="button"
                aria-label={a.deleteConversation}
                onClick={() => del.mutate(s.id)}
                className="row-action shrink-0 text-muted-foreground hover:text-red-600"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
