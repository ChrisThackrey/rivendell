"use client";

import { TestMetadata } from '@/components/ui/test-metadata';

export default function TestMetadataPage() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Code Block Metadata Test</h1>
      <div className="w-full max-w-3xl">
        <TestMetadata />
      </div>
    </div>
  );
} 