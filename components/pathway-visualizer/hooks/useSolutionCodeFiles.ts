import type { CodeFile } from '@/lib/supabase-client'; // Adjust path as needed
import { useCallback, useState } from 'react';
import type { Solution } from '../types';

export interface SolutionCodeFilesReturn {
  solutionCodeFiles: Record<string, CodeFile[]>;
  loadingCodeFiles: Record<string, boolean>;
  fetchCodeFilesForSolution: (solution: Solution) => Promise<void>;
}

export function useSolutionCodeFiles(): SolutionCodeFilesReturn {
  const [solutionCodeFiles, setSolutionCodeFiles] = useState<Record<string, CodeFile[]>>({});
  const [loadingCodeFiles, setLoadingCodeFiles] = useState<Record<string, boolean>>({});

  const fetchCodeFilesForSolution = useCallback(async (solution: Solution) => {
    // Skip if we already have code files or are currently loading them
    if (solutionCodeFiles[solution.id] || loadingCodeFiles[solution.id]) {
      return;
    }

    // Set loading state for this solution
    setLoadingCodeFiles((prev) => ({ ...prev, [solution.id]: true }));

    try {
      console.log(`Fetching code files for solution ${solution.id}`);

      // Simulate a delay
      await new Promise(r => setTimeout(r, 500));

      // Provide a placeholder code file
      const mockCodeFiles: CodeFile[] = [
        {
          filename: 'index.js',
          language: 'javascript',
          code: '// This is a placeholder code file\nconsole.log("Hello world");',
        }
      ];

      // Store the code files
      setSolutionCodeFiles((prev) => ({
        ...prev,
        [solution.id]: mockCodeFiles,
      }));
    } catch (error) {
      console.error(`Error fetching code files for solution ${solution.id}:`, error);
      setSolutionCodeFiles((prev) => ({ ...prev, [solution.id]: [] }));
    } finally {
      setLoadingCodeFiles((prev) => ({ ...prev, [solution.id]: false }));
    }
  }, [solutionCodeFiles, loadingCodeFiles]);

  return {
    solutionCodeFiles,
    loadingCodeFiles,
    fetchCodeFilesForSolution,
  };
}