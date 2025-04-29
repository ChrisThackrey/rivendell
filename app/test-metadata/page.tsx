"use client";

import { TestMetadata } from '@/components/ui/test-metadata';

export default function TestMetadataPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col gap-4 mb-8">
          <h1 className="text-3xl font-bold">Code Block Metadata Tester</h1>
          <p className="text-muted-foreground">
            This interactive tool allows you to test and visualize how code blocks will appear with different metadata settings.
            Use the controls below to configure code content, language, and metadata display options.
          </p>
        </div>
        
        <TestMetadata />
        
        <div className="mt-12 text-sm text-muted-foreground">
          <h3 className="text-lg font-medium mb-2">About This Tool</h3>
          <p>
            The code block component supports various metadata fields and visual indicators for code changes.
            This testing tool helps visualize how these elements will appear in the UI, making it easier to
            design and debug metadata displays across the application.
          </p>
        </div>
      </div>
    </div>
  );
} 