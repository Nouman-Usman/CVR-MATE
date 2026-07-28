"use client";

import { memo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { remarkLinkVat } from "./remark-link-vat";

/**
 * Chat markdown renderer. Each element is mapped to an explicitly-styled node
 * (the app has no @tailwindcss/typography plugin, so `prose` is unavailable).
 * Kept compact for a chat bubble. Safe by default — react-markdown strips
 * dangerous URLs; links open in a new tab with noopener.
 */
const components: Components = {
  p: ({ children }) => <p className="my-1.5 first:mt-0 last:mb-0 leading-relaxed">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-blue-600 underline decoration-blue-300 underline-offset-2 hover:text-blue-700"
    >
      {children}
    </a>
  ),
  ul: ({ children }) => <ul className="my-1.5 ml-4 list-disc space-y-1 marker:text-muted-foreground">{children}</ul>,
  ol: ({ children }) => <ol className="my-1.5 ml-4 list-decimal space-y-1 marker:text-muted-foreground">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed [&>ul]:my-1 [&>ol]:my-1">{children}</li>,
  h1: ({ children }) => <h1 className="mt-3 mb-1.5 text-base font-bold text-foreground first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="mt-3 mb-1.5 text-sm font-bold text-foreground first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="mt-2.5 mb-1 text-sm font-semibold text-foreground first:mt-0">{children}</h3>,
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-border pl-3 text-muted-foreground italic">{children}</blockquote>
  ),
  hr: () => <hr className="my-3 border-border" />,
  code: ({ className, children }) => {
    const isBlock = /language-/.test(className ?? "");
    if (isBlock) {
      return <code className="block font-mono text-[12px] leading-relaxed">{children}</code>;
    }
    return (
      <code className="rounded bg-muted px-1 py-0.5 font-mono text-[12px] text-foreground">{children}</code>
    );
  },
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-lg border border-border bg-muted/60 p-3">{children}</pre>
  ),
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-border bg-muted/60 px-2 py-1 text-left font-semibold">{children}</th>
  ),
  td: ({ children }) => <td className="border border-border px-2 py-1">{children}</td>,
};

function MarkdownImpl({ text }: { text: string }) {
  return (
    <div className="text-sm text-foreground">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkLinkVat]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
}

/** Memoized so a re-render of the message list doesn't re-parse settled messages. */
export const Markdown = memo(MarkdownImpl, (prev, next) => prev.text === next.text);
