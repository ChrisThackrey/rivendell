import { useState, useEffect, useCallback, useMemo } from "react"
import { useCodeFiles } from "@/components/code-file-provider"
import type { CodeFile } from "@/components/ui/code-block"

// Helper function to get language from filename (moved from SolutionCard)
function getLanguageFromFilename(filename: string): string {
  const extension = filename.split(".").pop()?.toLowerCase() || ""
  const languageMap: Record<string, string> = {
    js: "javascript", ts: "typescript", jsx: "jsx", tsx: "tsx", html: "html",
    css: "css", scss: "scss", json: "json", py: "python", rb: "ruby",
    java: "java", cs: "csharp", go: "go", rs: "rust", php: "php",
    swift: "swift", kt: "kotlin",
  }
  return languageMap[extension] || "plaintext"
}

// Helper function to check for placeholder/empty code (moved from SolutionCard)
// Import improved isPlaceholderOrEmptyCode function with enhanced code quality checks
const isPlaceholderOrEmptyCode = (
  content: string | null | undefined
): boolean => {
  if (!content || content.trim() === "") return true
  const trimmedCode = content.trim()
  if (trimmedCode.length < 30) return true // Increased threshold

  const placeholderPatterns = [
    /sample code generated for placeholder/i, /This file was auto-generated/i,
    /auto(?:\s|-)?generated/i, /reconstructed/i, /placeholder document/i,
    /placeholder implementation/i, /placeholder code/i, /no code files were found/i,
    /no code content available/i, /actual implementation would depend/i,
    /Lorem ipsum/i, /\[code would go here\]/i, /\[code\]/i, /\[insert code\]/i,
    /TODO: Implement/i, /to be implemented/i, /file intentionally left empty/i,
    /^\/\/ empty$/i, /^(\s*\/\/.*|\s*\/\*[\s\S]*?\*\/\s*)*$/,
    /^function\s+\w+\(\)\s*{\s*\/\/.*\s*}$/,
    /function\s+\w+\(\)\s*{\s*return\s+null;\s*}/i,
    /function\s+\w+\(\)\s*{\s*return\s+undefined;\s*}/i,
    /function\s+\w+\(\)\s*{\s*return\s+'';\s*}/i,
    /fallback implementation/i, /error generating code/i, /return\s*\{\s*\}/i,
    /return\s*\[\s*\]/i,
  ]
  for (const pattern of placeholderPatterns) {
    if (pattern.test(trimmedCode)) return true
  }

  const contentWithoutComments = trimmedCode
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
  if (contentWithoutComments.trim() === "") return true

  const nonEmptyLines = contentWithoutComments
    .split("\n")
    .filter((line) => line.trim() !== "").length
  if (nonEmptyLines < 5) return true // Min 5 lines

  const hasControlStructures =
    /if\s*\(|for\s*\(|while\s*\(|switch\s*\(|function\s+\w+\s*\(|=>\s*{/.test(
      contentWithoutComments
    )
  if (!hasControlStructures) return true // Must have some structure

  return false
}


// Helper function to organize file tree (moved from SolutionCard)
const organizeFileTree = (codeFiles: CodeFile[]): string => {
    const directories: Record<string, string[]> = {
      components: [], app: [], "app/api": [], lib: [], utils: [], types: [],
      pages: [], styles: [], public: [], tests: [], other: [],
    }
    codeFiles.forEach((file) => {
      const filename = file.filename;
      const extension = filename.split(".").pop()?.toLowerCase() || "";
      if (
        (extension === "tsx" || extension === "jsx") &&
        /^[A-Z][A-Za-z0-9]*\.(tsx|jsx)$/.test(filename)
      ) {
        if ( filename.includes("Page") || filename.endsWith("Page.tsx") || filename.endsWith("Page.jsx")) {
          directories["app"].push(filename);
        } else {
          directories["components"].push(filename);
        }
      } else if (filename === "page.tsx" || filename === "page.jsx" || filename === "layout.tsx") {
        directories["app"].push(filename);
      } else if (filename === "route.ts" || filename === "route.js" || filename.startsWith("api")) {
        directories["app/api"].push(filename);
      } else if (extension === "ts" || extension === "js") {
        if ( filename.includes("service") || filename.includes("client") || filename.includes("provider") || filename.includes("store")) {
          directories["lib"].push(filename);
        } else {
          directories["utils"].push(filename);
        }
      } else if (extension === "css" || extension === "scss") {
        directories["styles"].push(filename);
      } else if (filename.includes(".test.") || filename.includes(".spec.")) {
        directories["tests"].push(filename);
      } else if (extension === "d.ts") {
        directories["types"].push(filename);
      } else {
        directories["other"].push(filename);
      }
      // Special cases
      if (filename === "analyze-job.ts") {
        Object.keys(directories).forEach((dir) => { directories[dir] = directories[dir].filter((f) => f !== filename); });
        directories["lib"].push(filename);
      } else if (filename === "JobAnalyzer.tsx") {
         Object.keys(directories).forEach((dir) => { directories[dir] = directories[dir].filter((f) => f !== filename); });
        directories["components"].push(filename);
      }
    });

    let fileTreeStr = "project-root/\n";
    Object.entries(directories).forEach(([dir, files]) => {
      if (files.length === 0) return;
      fileTreeStr += `├── ${dir}/\n`;
      files.forEach((file, index) => {
        const isLast = index === files.length - 1;
        fileTreeStr += `│   ${isLast ? "└" : "├"}── ${file} [GENERATED]\n`;
      });
    });
    return fileTreeStr;
}


interface UseSolutionCodeProps {
  id: string | null | undefined
  runId: number | null | undefined
  stepIndex: number | null | undefined
  title?: string // Make title optional as it's mainly for context/logging
  metadata?: Record<string, any>
  initialCodeFiles?: CodeFile[] // Accept initial files from props
}

interface UseSolutionCodeReturn {
  filesToDisplay: CodeFile[]
  displayFileTree: string | undefined
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

export function useSolutionCode({
  id,
  runId,
  stepIndex,
  title = "Untitled Step",
  metadata = {},
  initialCodeFiles = [],
}: UseSolutionCodeProps): UseSolutionCodeReturn {
  // Assume updateCachedFiles exists in the context
  const { getCodeFiles, cachedFiles, updateCachedFiles } = useCodeFiles()

  const [internalCodeFiles, setInternalCodeFiles] = useState<CodeFile[]>(initialCodeFiles)
  const [internalFileTree, setInternalFileTree] = useState<string | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [fetchedFileTree, setFetchedFileTree] = useState<string | null>(null)

  const cacheKey = useMemo(() => {
    if (!id) return null
    return runId !== undefined && stepIndex !== undefined
      ? `step_${runId}_${stepIndex}`
      : `doc_${id}`
  }, [id, runId, stepIndex])

  // --- fetchCodeFiles Logic ---
  const fetchCodeFiles = useCallback(async (forceRefetch = false) => {
    if (!id || !cacheKey) {
      console.log("Skipping fetchCodeFiles: No ID or cacheKey");
      return
    }
    setError(null)

    // Use cache if available and not forcing refetch
    if (!forceRefetch && cachedFiles[cacheKey]?.length > 0) {
      console.log(`Using cached code files for key: ${cacheKey}`)
      // Ensure cached files are distinct from initial props if necessary
       if (internalCodeFiles !== cachedFiles[cacheKey]) {
          setInternalCodeFiles(cachedFiles[cacheKey])
       }
      return
    }

    console.log(`Fetching code files for key: ${cacheKey} (Forced: ${forceRefetch})`)
    setIsLoading(true)

    try {
      let foundFiles: CodeFile[] = []
      let fetchSource = "unknown"

      // 1. Try step-specific search if applicable
      if (runId !== undefined && stepIndex !== undefined) {
        fetchSource = `step search (run ${runId}, step ${stepIndex})`
        try {
          let searchQuery = title || (metadata as any)?.stepTitle || ""
          if (!searchQuery.includes(`step ${stepIndex + 1}`)) {
            searchQuery += ` step ${stepIndex + 1}`
          }

          const apiParams: any = {
            mode: "step", runId: runId, stepNumber: stepIndex,
            batchId: (metadata as any)?.batchId || null, query: searchQuery,
            similarityThreshold: 0.4, maxResults: 10,
          }
          const response = await fetch("/api/search-codefiles", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(apiParams),
          })

          if (response.ok) {
            const data = await response.json()
            if (data.success && data.files && data.files.length > 0) {
              const stepFiles = data.files.map((file: any) => ({
                filename: file.filename || "unknown.txt",
                language: file.language || getLanguageFromFilename(file.filename || "unknown.txt"),
                code: file.code || "// No code content available",
                id: file.id || `${cacheKey}_${file.filename || "unknown"}`,
                documentId: file.documentId,
                stepInfo: { runId, stepNumber: stepIndex }, cacheKey,
                source: file.source || "api-step-search",
              }))
              const meaningfulFiles = stepFiles.filter((file: CodeFile) => !isPlaceholderOrEmptyCode(file.code))
              if (meaningfulFiles.length > 0) {
                foundFiles = meaningfulFiles
                fetchSource = `API step search (${foundFiles.length} files)`
              }
            }
          } else {
             console.error(`API error (step search) for ${cacheKey}:`, response.statusText)
          }
        } catch (searchError) {
           console.error(`Error during step search for ${cacheKey}:`, searchError)
        }
      }

      // 2. If step search failed or not applicable, try direct document ID lookup via context/getCodeFiles
      if (foundFiles.length === 0) {
          fetchSource = `context getCodeFiles (doc ${id})`
          console.log(`Trying ${fetchSource} for key ${cacheKey}`)
          const contextFiles = await getCodeFiles(id) // Assumes getCodeFiles fetches if not cached
          if (contextFiles.length > 0) {
             foundFiles = contextFiles.map((file) => ({
                ...file,
                id: file.id || `${cacheKey}_${file.filename || "unknown"}`,
                stepInfo: { runId, stepNumber: stepIndex }, cacheKey,
                source: "context-getcodefiles",
             }))
             fetchSource = `Context getCodeFiles (${foundFiles.length} files)`
          }
      }


      // 3. If still no files, try direct API call for document ID
      if (foundFiles.length === 0) {
          fetchSource = `direct API call (doc ${id})`
          console.log(`Trying ${fetchSource} for key ${cacheKey}`)
          try {
             const directResponse = await fetch("/api/search-codefiles", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ documentId: id, mode: "step", runId: runId, stepNumber: stepIndex, direct: true }),
             })
             if (directResponse.ok) {
                const directData = await directResponse.json()
                if (directData.success && directData.files && directData.files.length > 0) {
                   const directFiles = directData.files.map((file: any) => ({
                      filename: file.filename || "unknown.txt",
                      language: file.language || getLanguageFromFilename(file.filename || "unknown.txt"),
                      code: file.code || "// No code content available",
                      id: file.id || `${cacheKey}_${file.filename || "unknown"}`,
                      documentId: file.documentId,
                      stepInfo: { runId, stepNumber: stepIndex }, cacheKey,
                      source: "api-direct-docid",
                   }))
                   foundFiles = directFiles
                   fetchSource = `Direct API call (${foundFiles.length} files)`
                }
             } else {
                console.error(`API error (direct call) for ${cacheKey}:`, directResponse.statusText)
             }
          } catch (directError) {
             console.error(`Error during direct API call for ${cacheKey}:`, directError)
          }
      }


      // Process results
      let finalFiles: CodeFile[] = []
      if (foundFiles.length > 0) {
         finalFiles = foundFiles.filter(file => !isPlaceholderOrEmptyCode(file.code))
         console.log(`Fetched ${finalFiles.length} meaningful files for ${cacheKey} via ${fetchSource}`)
         if (finalFiles.length === 0) {
             // If all fetched files were placeholders
            console.log(`All fetched files were placeholders for ${cacheKey}, creating placeholder.`)
            finalFiles = [{
                filename: "No Code Files Found", language: "plaintext",
                code: `// No meaningful code files found via ${fetchSource}\n// Document ID: ${id}\n// Step: ${stepIndex !== undefined ? stepIndex + 1 : "N/A"}, Run: ${runId || "N/A"}`,
                id: `${cacheKey}_no_meaningful_code`,
                stepInfo: { runId, stepNumber: stepIndex }, cacheKey,
                source: "placeholder-no-meaningful-code",
             }]
         }
      } else {
         // Create placeholder if no files found at all
         console.log(`No files found for ${cacheKey}, creating placeholder.`)
         finalFiles = [{
             filename: "No Code Files Found", language: "plaintext",
             code: `// No code files found for document ID: ${id}\n// Step: ${stepIndex !== undefined ? stepIndex + 1 : "N/A"}, Run: ${runId || "N/A"}`,
             id: `${cacheKey}_no_codefiles`,
             stepInfo: { runId, stepNumber: stepIndex }, cacheKey,
             source: "placeholder-no-files",
          }]
      }

      setInternalCodeFiles(finalFiles)
      // Update context cache using the assumed function
      if (updateCachedFiles) {
          updateCachedFiles(cacheKey, finalFiles)
      } else {
          console.warn("updateCachedFiles function not found in CodeFileProvider context - cache not updated.")
      }

    } catch (err) {
      console.error(`Error fetching code files for ${cacheKey}:`, err)
      setError(err instanceof Error ? err : new Error(String(err)))
      const errorFile = [{
          filename: "Error Loading Code", language: "plaintext",
          code: `// Error fetching code files for step ${stepIndex !== undefined ? stepIndex + 1 : ""} of run ${runId || "unknown"}:\n// ${err instanceof Error ? err.message : String(err)}`,
          id: `${cacheKey}_error`,
          stepInfo: { runId, stepNumber: stepIndex }, cacheKey, source: "error",
      }]
      setInternalCodeFiles(errorFile)
      if (updateCachedFiles) {
          updateCachedFiles(cacheKey, errorFile)
      }
    } finally {
      setIsLoading(false)
    }
  }, [id, runId, stepIndex, cacheKey, title, metadata, cachedFiles, getCodeFiles, updateCachedFiles, internalCodeFiles]) // Added internalCodeFiles to deps

  // --- fetchFileTree Logic ---
  const fetchFileTree = useCallback(async () => {
     if (!id || !runId || stepIndex === undefined || fetchedFileTree) return

     console.log(`Fetching file tree for key: ${cacheKey}`)
     try {
        const response = await fetch("/api/search-codefiles", {
           method: "POST", headers: { "Content-Type": "application/json" },
           body: JSON.stringify({ mode: "document-metadata", documentId: id, runId: runId, stepNumber: stepIndex }),
        })
        if (response.ok) {
           const data = await response.json()
           if (data.success && data.metadata && data.metadata.fileTree) {
              console.log(`Found file tree in metadata for ${cacheKey}`)
              setFetchedFileTree(data.metadata.fileTree)
           } else {
              console.log(`No file tree in metadata for ${cacheKey}, attempting generation.`)
              // Try generating if files exist but no tree was found
              if (internalCodeFiles.length > 0 && !isPlaceholderOrEmptyCode(internalCodeFiles[0].code)) {
                 const generatedTree = organizeFileTree(internalCodeFiles)
                 setFetchedFileTree(generatedTree)
                 console.log(`Generated file tree for ${cacheKey}`)
              } else {
                 setFetchedFileTree("") // Explicitly set to empty if no tree and no files
              }
           }
        } else {
           console.error(`API error fetching file tree for ${cacheKey}:`, response.statusText)
           setFetchedFileTree("") // Indicate fetch failed
        }
     } catch (err) {
        console.error(`Error fetching file tree for ${cacheKey}:`, err)
        setFetchedFileTree("") // Indicate fetch failed
     }
  }, [id, runId, stepIndex, cacheKey, fetchedFileTree, internalCodeFiles])


  // --- useEffect for initial/cached data load ---
  useEffect(() => {
    if (!cacheKey || isLoading) return

    // Check cache first
    if (cachedFiles[cacheKey]?.length > 0) {
       // Check if state needs update from cache
       if (internalCodeFiles !== cachedFiles[cacheKey]) {
          console.log(`Loading code files from cache for ${cacheKey}`)
          setInternalCodeFiles(cachedFiles[cacheKey])
          // Reset loading/error if loading from cache
          setIsLoading(false)
          setError(null)
       }
    } else if (internalCodeFiles.length === 0 || (internalCodeFiles.length === 1 && internalCodeFiles[0].source?.startsWith('placeholder'))) {
       // Fetch only if cache is empty and current state is empty or just a placeholder
        console.log(`Triggering initial fetch for ${cacheKey} (no valid cache/state)`)
        fetchCodeFiles()
    }

    // Attempt to fetch file tree if needed
    fetchFileTree()

  }, [cacheKey, cachedFiles, internalCodeFiles, isLoading, fetchCodeFiles, fetchFileTree])


  // --- useEffect to update displayFileTree ---
  useEffect(() => {
    if (fetchedFileTree !== null && fetchedFileTree !== internalFileTree) {
      setInternalFileTree(fetchedFileTree)
    } else if (fetchedFileTree === null && internalCodeFiles.length > 0 && !internalFileTree && !isPlaceholderOrEmptyCode(internalCodeFiles[0].code)) {
      // Generate tree only if fetch hasn't run yet (fetchedFileTree is null) and we have actual files
      const generatedFileTree = organizeFileTree(internalCodeFiles)
      setInternalFileTree(generatedFileTree)
    }
  }, [fetchedFileTree, internalCodeFiles, internalFileTree])

  // --- filesToDisplay Logic ---
  const filesToDisplay = useMemo(() => {
    // Add context header only to non-placeholder files
    const filesWithContext = internalCodeFiles.map((file) => {
      if (isPlaceholderOrEmptyCode(file.code) || stepIndex === undefined) {
        return file
      }
      // Add context header
      return {
        ...file,
        code: `// Step ${stepIndex + 1}: ${title}\n// File: ${file.filename} - Implementation for this step\n\n${file.code}`,
      }
    })

    // Keep placeholders if they are the only thing we have
    if (filesWithContext.length === 1 && filesWithContext[0].source?.startsWith('placeholder')) {
       return filesWithContext
    }
    if (filesWithContext.length === 1 && filesWithContext[0].source === 'error') {
       return filesWithContext
    }

    // Filter out placeholders if we have other files
    const meaningfulFiles = filesWithContext.filter(
      (file) => !isPlaceholderOrEmptyCode(file.code) && file.source !== 'error'
    )

    if (meaningfulFiles.length > 0) {
        return meaningfulFiles
    } else if (filesWithContext.length > 0) {
       // If all files were filtered, return a generic placeholder
       return [{
          filename: "No Meaningful Code", language: "plaintext",
          code: `// No meaningful code files available for step ${stepIndex !== undefined ? stepIndex + 1 : ""}: ${title}\n// Fetched files might have been placeholders or empty.`,
          id: `${cacheKey}_no_meaningful_code_fallback`,
          stepInfo: { runId, stepNumber: stepIndex }, cacheKey, source: "placeholder-fallback",
       }]
    }

    // Default empty array if internalCodeFiles is empty initially
    return []

  }, [internalCodeFiles, stepIndex, title, cacheKey, runId])


  // Expose a refetch function that forces cache bypass
  const refetch = useCallback(() => {
    console.log(`Force refetch triggered for ${cacheKey}`)
    fetchCodeFiles(true) // Pass true to force refetch
    setFetchedFileTree(null) // Reset fetched tree state to allow refetch
    fetchFileTree()
  }, [fetchCodeFiles, fetchFileTree, cacheKey])

  return { filesToDisplay, displayFileTree: internalFileTree, isLoading, error, refetch }
} 