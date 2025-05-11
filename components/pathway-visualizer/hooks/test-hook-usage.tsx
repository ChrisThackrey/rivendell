"use client";

import type { ModelConfig } from "@/components/ensemble-selection-modal";
import type { TechOption } from "@/components/tech-stack-modal";
import { useState } from 'react';
import { usePathwayDataLoader } from './usePathwayDataLoader';
import { useRunProgress } from './useRunProgress';

export function TestHookUsage() {
  const [query] = useState("Create a todo app with React and TypeScript");
  const [selectedModels] = useState<ModelConfig[]>([
    { id: 1, model: "gpt-4", runsLow: 1, runsMedium: 1, runsHigh: 1, enableReasoning: true }
  ]);
  const [selectedIntensity] = useState<"low" | "medium" | "high">("medium");
  const [selectedTechStack] = useState<TechOption[]>([
    { id: "react", name: "React", category: "Frontend", language: "TypeScript" }
  ]);
  const [initialBatchId] = useState<string | null>(null);

  const runProgress = useRunProgress();

  const {
    isLoading,
    generationError,
    allSteps,
    groupedSteps,
    currentBatchId
  } = usePathwayDataLoader(
    {
      query,
      selectedModels,
      selectedIntensity,
      selectedTechStack,
      initialBatchId
    },
    runProgress
  );

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Test Hook Usage</h2>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-100 p-4 rounded">
          <h3 className="font-semibold mb-2">Input</h3>
          <p><strong>Query:</strong> {query}</p>
          <p><strong>Models:</strong> {selectedModels.map(m => m.model).join(', ')}</p>
          <p><strong>Intensity:</strong> {selectedIntensity}</p>
          <p><strong>Tech Stack:</strong> {selectedTechStack.map(t => t.name).join(', ')}</p>
          <p><strong>Initial Batch ID:</strong> {initialBatchId || 'None'}</p>
        </div>

        <div className="bg-gray-100 p-4 rounded">
          <h3 className="font-semibold mb-2">Output</h3>
          <p><strong>Is Loading:</strong> {isLoading ? 'Yes' : 'No'}</p>
          <p><strong>Error:</strong> {generationError || 'None'}</p>
          <p><strong>Current Batch ID:</strong> {currentBatchId || 'None'}</p>
          <p><strong>Steps Count:</strong> {allSteps?.length || 0}</p>
          <p><strong>Grouped Steps:</strong> {Object.keys(groupedSteps).length} step indices</p>
        </div>
      </div>

      {/* Progress information */}
      <div className="mt-4 bg-gray-100 p-4 rounded">
        <h3 className="font-semibold mb-2">Progress</h3>
        <div className="grid grid-cols-5 gap-2">
          {runProgress.progressSteps.map(step => (
            <div
              key={step.id}
              className={`p-2 border rounded ${
                step.status === 'pending' ? 'bg-gray-200' :
                step.status === 'in-progress' ? 'bg-blue-100' :
                step.status === 'completed' ? 'bg-green-100' :
                'bg-red-100'
              }`}
            >
              <p className="font-medium">{step.title}</p>
              <p className="text-xs">{step.status}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Steps information */}
      {allSteps.length > 0 && (
        <div className="mt-4 bg-gray-100 p-4 rounded">
          <h3 className="font-semibold mb-2">All Steps</h3>
          <div className="grid grid-cols-5 gap-2">
            {allSteps.map(step => (
              <div key={step.id} className="p-2 border rounded">
                <p className="font-medium">{step.title}</p>
                <p className="text-xs">{step.solutions.length} solutions</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default TestHookUsage;