import React from 'react';
import { CodeBlockCode } from '@/components/ui/code-block';

export function TestMetadata() {
  return (
    <CodeBlockCode
      code="console.log('Hello world');" 
      language="javascript"
      showMetadata={true}
      metadata={{
        model: "gpt-4o",
        runId: 123,
        stepInfo: { runId: 123, stepNumber: 2 },
        cacheKey: "step_123_2",
        fetchSource: "API step search",
        description: "Sample code for testing metadata display"
      }}
    />
  );
} 