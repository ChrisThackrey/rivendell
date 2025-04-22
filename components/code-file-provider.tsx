"use client";

import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
  useEffect,
} from "react";
import { CodeFile } from "./ui/code-block";

// Define the context type
type CodeFileContextType = {
  getCodeFiles: (documentId: string) => Promise<CodeFile[]>;
  getBatchCodeFiles: (batchId: string) => Promise<Record<string, CodeFile[]>>;
  cachedFiles: Record<string, CodeFile[]>;
  batchCaches: Record<string, Record<string, CodeFile[]>>;
  updateCachedFiles?: (key: string, files: CodeFile[]) => void;
};

// Create the context with default values
const CodeFileContext = createContext<CodeFileContextType>({
  getCodeFiles: async () => [],
  getBatchCodeFiles: async () => ({}),
  cachedFiles: {},
  batchCaches: {},
});

// Hook to use the context
export const useCodeFiles = () => useContext(CodeFileContext);

// Provider component to wrap the application
export function CodeFileProvider({ children }: { children: ReactNode }) {
  // Cache for code files
  const [cachedFiles, setCachedFiles] = useState<Record<string, CodeFile[]>>(
    {},
  );
  const [batchCaches, setBatchCaches] = useState<
    Record<string, Record<string, CodeFile[]>>
  >({});
  const [fetchingIds, setFetchingIds] = useState<Set<string>>(new Set());
  const [fetchingBatches, setFetchingBatches] = useState<Set<string>>(
    new Set(),
  );

  // Function to get code files for a document ID - using codefiles table only
  const getCodeFiles = useCallback(
    async (documentId: string): Promise<CodeFile[]> => {
      // Return cached files if available
      if (cachedFiles[documentId]) {
        console.log(`Using cached code files for document ${documentId}`);
        return cachedFiles[documentId];
      }

      // Prevent duplicate fetches for the same document
      if (fetchingIds.has(documentId)) {
        console.log(`Already fetching code files for document ${documentId}`);
        // Return an empty array if already fetching
        return [];
      }

      try {
        // Mark as fetching
        setFetchingIds((prev) => new Set(prev).add(documentId));

        // Fetch code files from search-codefiles API which uses codefiles table exclusively
        // Not using 'mode' parameter so we get direct lookups from get_codefiles_by_document_id function
        const response = await fetch("/api/search-codefiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            documentId,
            mode: "step",
            direct: true, // Flag to indicate this is a direct lookup
          }),
        });

        if (response.ok) {
          const data = await response.json();

          if (data.success && data.files && data.files.length > 0) {
            // Process the files
            const files = data.files.map(
              (file: {
                filename?: string;
                language?: string;
                code?: string;
                id: string;
                documentId: string;
                runId?: number | null;
                stepNumber?: number | null;
              }) => ({
                filename: file.filename || "unknown.txt",
                language:
                  file.language ||
                  file.filename?.split(".").pop() ||
                  "plaintext",
                code: file.code || "// No code content available for this file",
                id: file.id,
                documentId: file.documentId, // Include document ID for relation tracking
                runId: file.runId,
                stepNumber: file.stepNumber,
              }),
            );

            // Update cache
            setCachedFiles((prev) => ({
              ...prev,
              [documentId]: files,
            }));

            console.log(
              `Cached ${files.length} code files for document ${documentId} from codefiles table`,
            );
            return files;
          }
        }

        // If no files found, cache an empty array
        setCachedFiles((prev) => ({
          ...prev,
          [documentId]: [],
        }));

        return [];
      } catch (error) {
        console.error(
          `Error fetching code files for document ${documentId}:`,
          error,
        );
        return [];
      } finally {
        // Remove from fetching set
        setFetchingIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(documentId);
          return newSet;
        });
      }
    },
    [cachedFiles, fetchingIds],
  );

  // Function to get code files for all documents in a batch
  const getBatchCodeFiles = useCallback(
    async (batchId: string): Promise<Record<string, CodeFile[]>> => {
      // Return cached batch files if available
      if (batchCaches[batchId]) {
        console.log(`Using cached batch code files for batch ${batchId}`);
        return batchCaches[batchId];
      }

      // Prevent duplicate fetches for the same batch
      if (fetchingBatches.has(batchId)) {
        console.log(`Already fetching code files for batch ${batchId}`);
        // Return an empty object if already fetching
        return {};
      }

      try {
        // Mark as fetching
        setFetchingBatches((prev) => new Set(prev).add(batchId));

        // Fetch batch code files from API
        const response = await fetch("/api/search-codefiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            batchId,
            mode: "batch",
            preload: true,
          }),
        });

        if (response.ok) {
          const data = await response.json();

          if (data.success && data.files && data.files.length > 0) {
            // Group files by document ID
            const filesByDocument: Record<string, CodeFile[]> = {};

            data.files.forEach(
              (file: {
                filename?: string;
                language?: string;
                code?: string;
                id: string;
                documentId?: string;
              }) => {
                if (file.documentId) {
                  // Create array for this document if it doesn't exist
                  if (!filesByDocument[file.documentId]) {
                    filesByDocument[file.documentId] = [];
                  }

                  // Add file to document's array
                  filesByDocument[file.documentId].push({
                    filename: file.filename || "unknown.txt",
                    language:
                      file.language ||
                      file.filename?.split(".").pop() ||
                      "plaintext",
                    code:
                      file.code || "// No code content available for this file",
                    id: file.id,
                  });
                }
              },
            );

            // Also update individual document caches
            Object.entries(filesByDocument).forEach(([docId, files]) => {
              setCachedFiles((prev) => ({
                ...prev,
                [docId]: files,
              }));
            });

            // Update batch cache
            setBatchCaches((prev) => ({
              ...prev,
              [batchId]: filesByDocument,
            }));

            console.log(
              `Cached code files for ${Object.keys(filesByDocument).length} documents in batch ${batchId}`,
            );
            return filesByDocument;
          }
        }

        // If no files found, cache empty objects
        setBatchCaches((prev) => ({
          ...prev,
          [batchId]: {},
        }));

        return {};
      } catch (error) {
        console.error(
          `Error fetching batch code files for batch ${batchId}:`,
          error,
        );
        return {};
      } finally {
        // Remove from fetching set
        setFetchingBatches((prev) => {
          const newSet = new Set(prev);
          newSet.delete(batchId);
          return newSet;
        });
      }
    },
    [batchCaches, fetchingBatches],
  );

  // Function to manually update the cached files for a document ID
  const updateCachedFiles = useCallback((key: string, files: CodeFile[]) => {
    console.log(`Manually updating cache for key ${key} with ${files.length} files`);
    setCachedFiles((prev) => ({
      ...prev,
      [key]: files,
    }));
  }, []);

  // Event listener for direct cache updates
  useEffect(() => {
    const handleCacheUpdate = (event: CustomEvent) => {
      const { key, files } = event.detail;
      if (key && Array.isArray(files)) {
        console.log(
          `CodeFileProvider: Received cache update for key ${key} with ${files.length} files`,
        );
        setCachedFiles((prev) => ({
          ...prev,
          [key]: files,
        }));
      }
    };

    // Add the event listener
    const element = document.body;
    element.addEventListener(
      "update-code-files-cache",
      handleCacheUpdate as EventListener,
    );

    return () => {
      element.removeEventListener(
        "update-code-files-cache",
        handleCacheUpdate as EventListener,
      );
    };
  }, []);

  return (
    <CodeFileContext.Provider
      value={{
        getCodeFiles,
        getBatchCodeFiles,
        cachedFiles,
        batchCaches,
        updateCachedFiles,
      }}
      data-code-files-context="true"
    >
      {children}
    </CodeFileContext.Provider>
  );
}
