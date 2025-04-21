"use client";

import {
  CodeBlock,
  CodeBlockCode,
  CodeBlockGroup,
  CodeBlockTabs,
  type CodeFile,
} from "@/components/ui/code-block";
import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CodeBlockWithHeader() {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  const files: CodeFile[] = [
    {
      filename: "counter.tsx",
      language: "tsx",
      code: `import { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <p>You clicked {count} times</p>
      <button onClick={() => setCount(count + 1)}>
        Click me
      </button>
    </div>
  );
}`,
    },
    {
      filename: "styles.css",
      language: "css",
      code: `button {
  background-color: #0070f3;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 8px 16px;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.2s;
}

button:hover {
  background-color: #0051a8;
}

p {
  color: #333;
  margin-bottom: 16px;
}`,
    },
    {
      filename: "useCounter.ts",
      language: "typescript",
      code: `import { useState, useCallback } from 'react';

export function useCounter(initialValue = 0) {
  const [count, setCount] = useState(initialValue);

  const increment = useCallback(() => {
    setCount(prev => prev + 1);
  }, []);

  const decrement = useCallback(() => {
    setCount(prev => prev - 1);
  }, []);

  const reset = useCallback(() => {
    setCount(initialValue);
  }, [initialValue]);

  return { count, increment, decrement, reset };
}`,
    },
  ];

  const handleCopy = () => {
    navigator.clipboard.writeText(files[activeTab].code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full max-w-[550px]">
      <CodeBlock>
        <CodeBlockGroup className="border-border border-b py-2 pr-2 pl-4">
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 text-primary rounded px-2 py-1 text-xs font-medium">
              {files[activeTab].language === "tsx"
                ? "React"
                : files[activeTab].language === "css"
                  ? "CSS"
                  : "TypeScript"}
            </div>
            <span className="text-muted-foreground text-sm">
              {files[activeTab].filename}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </CodeBlockGroup>

        <CodeBlockTabs
          files={files}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        <CodeBlockCode
          code={files[activeTab].code}
          language={files[activeTab].language}
        />
      </CodeBlock>
    </div>
  );
}
