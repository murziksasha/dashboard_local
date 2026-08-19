"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

export function Markdown({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  if (!content?.trim()) {
    return <p className="text-sm text-zinc-500">—</p>;
  }
  return (
    <div
      className={cn(
        "prose prose-sm max-w-none dark:prose-invert prose-p:my-2 prose-headings:mb-2 prose-ul:my-2",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
