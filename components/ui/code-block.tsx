"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { codeToHtml } from "shiki";
import { Check, Copy } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type CodeFile = {
  filename: string;
  code: string;
  language?: string;
  id?: string;
  source?: string;
  metadata?: Record<string, unknown>;
};

export type CodeBlockProps = {
  children?: React.ReactNode;
  className?: string;
} & React.HTMLProps<HTMLDivElement>;

function CodeBlock({ children, className, ...props }: CodeBlockProps) {
  return (
    <div
      className={cn(
        "not-prose flex w-full flex-col overflow-clip border",
        "border-border bg-card text-card-foreground rounded-xl",
        "max-w-[98%] mx-auto",
        "[counter-reset:line]" /* Add line counter reset for line numbers */,
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// Add a new container component to avoid duplicate borders
export type CodeBlockContainerProps = {
  children?: React.ReactNode;
  className?: string;
} & React.HTMLProps<HTMLDivElement>;

function CodeBlockContainer({
  children,
  className,
  ...props
}: CodeBlockContainerProps) {
  return (
    <div
      className={cn(
        "overflow-hidden", // No border here, only overflow handling
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export type CodeBlockCodeProps = {
  code: string;
  language?: string;
  theme?: string;
  className?: string;
  showMetadata?: boolean;
  changesHighlight?: {
    isNewFile?: boolean;
    linesAdded?: number;
    linesRemoved?: number;
    linesChanged?: number;
    changePercentage?: number;
    summary?: string;
  };
  metadata?: {
    model?: string;
    runId?: number | string;
    source?: string;
    description?: string;
    fetchSource?: string;
    stepInfo?: { runId?: number | string | null; stepNumber?: number | null };
    cacheKey?: string;
    [key: string]: unknown;
  };
} & React.HTMLProps<HTMLDivElement>;

function CodeBlockCode({
  code,
  language = "tsx",
  theme = "github-light",
  className,
  showMetadata = false,
  changesHighlight,
  metadata,
  ...props
}: CodeBlockCodeProps) {
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);

  useEffect(() => {
    async function highlight() {
      // Handle empty or whitespace-only code
      if (!code || code.trim() === "") {
        setHighlightedHtml(
          "<pre><code class='language-plaintext'>// No code content available</code></pre>",
        );
        return;
      }

      try {
        // Enable line numbers through CSS styling instead of Shiki options
        const html = await codeToHtml(code, {
          lang: language,
          theme,
        });

        // Process the HTML for line numbers
        let processedHtml = html;

        // Add the with-line-numbers class to the pre element
        processedHtml = processedHtml.replace(
          '<pre class="',
          '<pre class="with-line-numbers ',
        );

        // First, eliminate any whitespace and newlines between the span tags
        processedHtml = processedHtml.replace(/>\s+</g, "><");

        // Extract all line spans and replace them with numbered versions
        const linePattern = /<span class="line">(.*?)<\/span>/g;
        let lineMatch;
        let lineNumber = 1;
        let resultHtml = "";
        let lastIndex = 0;

        // Handle lines that may span multiple matches (using a non-greedy regex)
        const safeLinePattern = /<span class="line">([\s\S]*?)<\/span>/g;

        // Find each line and replace it with a numbered version
        while ((lineMatch = safeLinePattern.exec(processedHtml)) !== null) {
          // Add content before this match
          resultHtml += processedHtml.substring(lastIndex, lineMatch.index);

          // Add the line with its number - with improved styling to prevent overlap
          resultHtml += `<span class="line line-numbered" data-line-number="${lineNumber}" style="line-height: 1; height: 1.2em; padding: 0; margin: 0; display: block; white-space: pre; padding-left: 4rem;">${lineMatch[1]}</span>`;

          // Update position and line number
          lastIndex = lineMatch.index + lineMatch[0].length;
          lineNumber++;
        }

        // Add any remaining content after the last match
        resultHtml += processedHtml.substring(lastIndex);

        // Eliminate any remaining whitespace between tags that might cause line spacing
        resultHtml = resultHtml.replace(/>\s+</g, "><");

        setHighlightedHtml(resultHtml);
      } catch (error) {
        console.error("Error highlighting code:", error);
        // Generate fallback html with line numbers
        const codeLines = (code || "// No code content available").split("\n");
        let fallbackHtml =
          '<pre class="with-line-numbers"><code class="language-' +
          (language || "plaintext") +
          '">';

        // Add each line with the line-numbered class for styling
        codeLines.forEach((line, index) => {
          const lineNum = index + 1;
          fallbackHtml += `<span class="line line-numbered" data-line-number="${lineNum}" style="line-height: 1; height: 1.2em; padding: 0; margin: 0; display: block; white-space: pre; padding-left: 4rem;">${line}</span>`;
        });

        // Remove the newline character that was being added after each line
        fallbackHtml = fallbackHtml.replace(/\n/g, "");

        fallbackHtml += "</code></pre>";
        setHighlightedHtml(fallbackHtml);
      }
    }
    highlight();
  }, [code, language, theme]);

  const classNames = cn(
    // Base styling for the code container
    "w-full overflow-y-auto max-h-[600px] text-[13px] relative",
    // Pre element styling with explicit line height and spacing
    "[&>pre]:px-8 [&>pre]:py-4 [&>pre]:overflow-y-auto [&>pre]:max-h-[580px] [&>pre]:leading-none [&>pre]:space-y-0",

    // Line height styling for compact code display - with more explicit rules
    "[&_.line]:leading-none [&_.line]:my-0 [&_.line]:py-0 [&_.line]:h-[1.2em] [&_.line]:block [&_.line]:whitespace-pre",
    "[&_.line-numbered]:leading-none [&_.line-numbered]:my-0 [&_.line-numbered]:py-0 [&_.line-numbered]:h-[1.2em] [&_.line-numbered]:block [&_.line-numbered]:whitespace-pre",

    // Remove any letter-spacing or word-spacing that might affect layout
    "[&_*]:tracking-normal [&_*]:word-spacing-normal",

    // Line number gutter styling - adjust width and positioning
    "[&>pre.with-line-numbers]:pl-20 [&>pre.with-line-numbers]:relative",
    "[&>pre.with-line-numbers]:before:content-[''] [&>pre.with-line-numbers]:before:absolute",
    "[&>pre.with-line-numbers]:before:left-0 [&>pre.with-line-numbers]:before:top-4 [&>pre.with-line-numbers]:before:bottom-4",
    "[&>pre.with-line-numbers]:before:w-12 [&>pre.with-line-numbers]:before:border-r [&>pre.with-line-numbers]:before:border-border/50",
    "[&>pre.with-line-numbers]:before:bg-muted/30",

    // Line number styling using data attribute - increased spacing
    "[&_.line-numbered]:relative [&_.line-numbered]:pl-16 [&_.line-numbered]:block",
    "[&_.line-numbered]:before:absolute [&_.line-numbered]:before:left-0 [&_.line-numbered]:before:w-12",
    "[&_.line-numbered]:before:content-[attr(data-line-number)] [&_.line-numbered]:before:text-right",
    "[&_.line-numbered]:before:text-muted-foreground/70 [&_.line-numbered:hover]:before:bg-muted/50 [&_.line-numbered:hover]:bg-muted/10",

    // Content styling
    "max-w-full border-0",
    className,
  );

  const renderMetadata = () => {
    if (!showMetadata || (!metadata && !changesHighlight)) return null;

    return (
      <div className="flex flex-wrap items-center gap-2 px-4 py-2 bg-muted/30 border-t text-xs text-muted-foreground">
        {metadata?.model && (
          <span className="flex items-center gap-1">
            <span className="font-medium">Model:</span> {metadata.model}
          </span>
        )}
        {metadata?.runId && (
          <>
            <span>•</span>
            <span className="flex items-center gap-1">
              <span className="font-medium">Run:</span> #{metadata.runId}
            </span>
          </>
        )}
        {metadata?.source && (
          <>
            <span>•</span>
            <span className="flex items-center gap-1">
              <span className="font-medium">Source:</span> {metadata.source}
            </span>
          </>
        )}
        {metadata?.fetchSource && (
          <>
            <span>•</span>
            <span className="flex items-center gap-1">
              <span className="font-medium">Fetch Source:</span> {metadata.fetchSource}
            </span>
          </>
        )}
        {/* Display step number if available */}
        {metadata?.stepInfo?.stepNumber != null && (
          <>
            <span>•</span>
            <span className="flex items-center gap-1">
              <span className="font-medium">Step:</span> {metadata.stepInfo.stepNumber + 1}
            </span>
          </>
        )}
        {/* Display cache key if available */}
        {metadata?.cacheKey && (
          <>
            <span>•</span>
            <span className="flex items-center gap-1">
              <span className="font-medium">CacheKey:</span> {metadata.cacheKey}
            </span>
          </>
        )}
        {/* Display change information */}
        {changesHighlight && (
          <>
            <span>•</span>
            <span
              className={cn(
                "flex items-center gap-1 px-1.5 py-0.5 rounded",
                changesHighlight.isNewFile
                  ? "bg-blue-50 text-blue-700"
                  : changesHighlight.changePercentage &&
                      changesHighlight.changePercentage >= 40
                    ? "bg-yellow-50 text-amber-700"
                    : changesHighlight.changePercentage &&
                        changesHighlight.changePercentage >= 20
                      ? "bg-green-50 text-green-700"
                      : "bg-slate-50 text-slate-700",
              )}
            >
              {changesHighlight.isNewFile
                ? "New File"
                : changesHighlight.summary || "Modified"}
              {!changesHighlight.isNewFile &&
                changesHighlight.linesAdded !== undefined && (
                  <span className="text-xs ml-1">
                    (+{changesHighlight.linesAdded}, -
                    {changesHighlight.linesRemoved}, ~
                    {changesHighlight.linesChanged})
                  </span>
                )}
            </span>
          </>
        )}
        {metadata?.description && (
          <>
            <span>•</span>
            <span className="flex items-center gap-1">
              {metadata.description}
            </span>
          </>
        )}
      </div>
    );
  };

  // Update the inline styles to include change highlighting
  const inlineCodeStyles = `
    <style>
      .line, .line-numbered {
        line-height: 1 !important;
        height: 1.2em !important;
        padding: 0 !important;
        margin: 0 !important;
        display: block !important;
        white-space: pre !important;
      }
      .line-numbered {
        padding-left: 4rem !important; /* Increase padding to prevent overlap */
        position: relative !important;
      }
      .line-numbered::before {
        position: absolute !important;
        left: 0 !important;
        width: 3rem !important; /* Wider area for line numbers */
        text-align: right !important;
        padding-right: 1rem !important;
        color: #6b7280 !important; /* Text color for line numbers */
        user-select: none !important;
        content: attr(data-line-number) !important;
      }
      pre.with-line-numbers {
        line-height: 1 !important;
        padding-left: 5rem !important; /* Increase left padding */
        position: relative !important;
      }
      pre.with-line-numbers::before {
        content: '' !important;
        position: absolute !important;
        left: 0 !important;
        top: 1rem !important;
        bottom: 1rem !important;
        width: 3rem !important;
        background-color: rgba(0,0,0,0.03) !important;
        border-right: 1px solid rgba(0,0,0,0.1) !important;
      }
      pre.with-line-numbers code {
        line-height: 1 !important;
        border: 0 !important;
      }
      /* Remove all internal borders */
      pre *, code *, .not-prose div, .not-prose pre {
        border: 0 !important;
      }
      /* Change highlight styles */
      .line-added {
        background-color: rgba(74, 222, 128, 0.1) !important;
        position: relative !important;
      }
      .line-added::after {
        content: '+' !important;
        position: absolute !important;
        left: 3.2rem !important;
        color: #22c55e !important;
      }
      .line-removed {
        background-color: rgba(248, 113, 113, 0.1) !important;
        position: relative !important;
      }
      .line-removed::after {
        content: '-' !important;
        position: absolute !important;
        left: 3.2rem !important;
        color: #ef4444 !important;
      }
      .line-changed {
        background-color: rgba(96, 165, 250, 0.1) !important;
        position: relative !important;
      }
      .line-changed::after {
        content: '~' !important;
        position: absolute !important;
        left: 3.2rem !important;
        color: #3b82f6 !important;
      }
    </style>
  `;

  // SSR fallback: render plain code if not hydrated yet
  return (
    <div className="relative">
      {/* Add the copy button */}
      <CopyButton code={code} />

      <div {...props}>
        {highlightedHtml ? (
          <div
            className={classNames}
            dangerouslySetInnerHTML={{
              __html: inlineCodeStyles + highlightedHtml,
            }}
          />
        ) : (
          <div className={classNames}>
            <pre className="border-0">
              <code className="border-0">{code}</code>
            </pre>
          </div>
        )}
        {renderMetadata()}
      </div>
    </div>
  );
}

export type CodeBlockGroupProps = React.HTMLAttributes<HTMLDivElement>;

function CodeBlockGroup({
  children,
  className,
  ...props
}: CodeBlockGroupProps) {
  return (
    <div
      className={cn("flex items-center justify-between", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export type CodeBlockTabsProps = {
  files: CodeFile[];
  activeTab?: number;
  onTabChange?: (index: number) => void;
  className?: string;
};

function CodeBlockTabs({
  files,
  activeTab = 0,
  onTabChange,
  className,
}: CodeBlockTabsProps) {
  const [activeIndex, setActiveIndex] = useState(activeTab);

  const handleTabChange = (index: number) => {
    setActiveIndex(index);
    if (onTabChange) {
      onTabChange(index);
    }
  };

  return (
    <div className={cn("border-b border-border overflow-x-auto", className)}>
      <div className="flex">
        {files.map((file, index) => (
          <button
            key={index}
            onClick={() => handleTabChange(index)}
            className={cn(
              "px-4 py-2 text-sm whitespace-nowrap transition-colors",
              index === activeIndex
                ? "border-b-2 border-primary text-primary font-medium"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {file.filename}
          </button>
        ))}
      </div>
    </div>
  );
}

// Define a function to add copy functionality
function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);

      // Reset after 2 seconds
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={copyToClipboard}
            className="absolute right-3 top-3 p-1.5 rounded-md bg-background/80 hover:bg-background border border-border shadow-sm hover:shadow-md transition-all duration-200 backdrop-blur-sm z-10"
            aria-label="Copy code to clipboard"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                copyToClipboard();
              }
            }}
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4 text-muted-foreground hover:text-foreground" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p>{copied ? "Copied!" : "Copy code"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export {
  CodeBlockGroup,
  CodeBlockCode,
  CodeBlock,
  CodeBlockTabs,
  CodeBlockContainer,
};
