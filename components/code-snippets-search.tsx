"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CodeBlock, CodeBlockCode } from "@/components/ui/code-block";
import {
  Search,
  Loader2,
  Code,
  Plus,
  ExternalLink,
  Copy,
  Check,
  Filter,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/use-toast";

type CodeSnippet = {
  id: string;
  documentId: string;
  documentTitle: string;
  documentBatchId?: string;
  filename: string;
  language: string;
  code: string;
  description: string;
  similarity: number;
  modelUsed: string;
  createdAt: string;
  source: string;
  stepTitle?: string;
};

type CodeSnippetsSearchProps = {
  onSelectSnippet?: (snippet: CodeSnippet) => void;
  onImportSnippets?: (snippets: CodeSnippet[]) => void;
  currentPrompt?: string;
};

export default function CodeSnippetsSearch({
  onSelectSnippet,
  onImportSnippets,
  currentPrompt = "",
}: CodeSnippetsSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [snippets, setSnippets] = useState<CodeSnippet[]>([]);
  const [selectedSnippets, setSelectedSnippets] = useState<CodeSnippet[]>([]);
  const [activeSnippet, setActiveSnippet] = useState<CodeSnippet | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [fileTypeFilter, setFileTypeFilter] = useState<string | undefined>();
  const [componentTypeFilter, setComponentTypeFilter] = useState<
    string | undefined
  >();

  const { toast } = useToast();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus search input when dialog opens
  useEffect(() => {
    if (searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, []);

  // Auto-populate search field with relevant terms from the current prompt
  useEffect(() => {
    if (currentPrompt && !searchQuery) {
      // Extract potential component names from the prompt
      const componentMatches = currentPrompt.match(
        /(?:component|function|module|class|widget)\s+(\w+)/gi,
      );
      if (componentMatches && componentMatches.length > 0) {
        const extractedTerms = componentMatches
          .map((match) =>
            match.replace(/(?:component|function|module|class|widget)\s+/i, ""),
          )
          .filter((term) => term.length > 3);

        if (extractedTerms.length > 0) {
          setSearchQuery(extractedTerms[0]);
        }
      }
    }
  }, [currentPrompt, searchQuery]);

  const searchSnippets = async () => {
    if (!searchQuery || searchQuery.trim().length < 3) {
      toast({
        title: "Search query too short",
        description: "Please enter at least 3 characters to search.",
        variant: "destructive",
      });
      return;
    }

    setIsSearching(true);
    setSnippets([]);

    try {
      const response = await fetch("/api/code-snippets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: searchQuery,
          similarityThreshold: 0.6,
          maxResults: 20,
          fileType: fileTypeFilter,
          componentType: componentTypeFilter,
          mode: "search", // Explicitly set mode to search to ensure we're using the right API path
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to search for code snippets");
      }

      const data = await response.json();

      if (data.success) {
        if (Array.isArray(data.snippets)) {
          console.log(`Found ${data.snippets.length} code snippets`);

          if (data.snippets.length === 0) {
            // Show "no snippets found" toast with helpful message
            toast({
              title: "No code snippets found",
              description:
                data.message ||
                "Try a different search term or create some code files first.",
            });

            setSnippets([]);
            setActiveSnippet(null);
            return;
          }

          // Process snippet data to ensure consistent format
          // This handles both code files and document-extracted snippets
          const processedSnippets = data.snippets.map((snippet: any) => ({
            ...snippet,
            // Ensure these fields exist with appropriate fallbacks
            id:
              snippet.id ||
              `snippet_${Math.random().toString(36).substring(2, 11)}`,
            documentId: snippet.documentId || "unknown",
            documentTitle:
              snippet.documentTitle || snippet.filename || "Unknown document",
            filename: snippet.filename || "untitled.txt",
            language: snippet.language || "plaintext",
            code:
              snippet.code || snippet.code_content || "// No code available",
            description:
              snippet.description ||
              `Code from ${snippet.filename || "untitled.txt"}`,
            similarity: snippet.similarity || 0.5,
            modelUsed: snippet.modelUsed || "Unknown model",
            createdAt: snippet.createdAt || new Date().toISOString(),
            source: snippet.source || "unknown",
          }));

          setSnippets(processedSnippets);

          if (processedSnippets.length > 0) {
            setActiveSnippet(processedSnippets[0]);
          }
        } else {
          console.error("Invalid snippets array in response", data);
          toast({
            title: "Invalid response",
            description: "Server returned data in an unexpected format.",
            variant: "destructive",
          });
        }
      } else {
        console.error("Invalid response format", data);
        toast({
          title: "Error",
          description: data.error || "Invalid response from the server.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error searching for code snippets:", error);
      toast({
        title: "Search failed",
        description: "An error occurred while searching for code snippets.",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      searchSnippets();
    }
  };

  const handleSelectSnippet = (snippet: CodeSnippet) => {
    setActiveSnippet(snippet);

    if (onSelectSnippet) {
      onSelectSnippet(snippet);
    }
  };

  const toggleSnippetSelection = (snippet: CodeSnippet) => {
    if (selectedSnippets.some((s) => s.id === snippet.id)) {
      setSelectedSnippets(selectedSnippets.filter((s) => s.id !== snippet.id));
    } else {
      setSelectedSnippets([...selectedSnippets, snippet]);
    }
  };

  const handleImportSnippets = () => {
    if (onImportSnippets && selectedSnippets.length > 0) {
      onImportSnippets(selectedSnippets);
      toast({
        title: "Snippets imported",
        description: `${selectedSnippets.length} code snippet${selectedSnippets.length > 1 ? "s" : ""} added to your project.`,
      });
    }
  };

  const copySnippetToClipboard = (snippet: CodeSnippet) => {
    navigator.clipboard.writeText(snippet.code).then(
      () => {
        setCopiedId(snippet.id);
        setTimeout(() => setCopiedId(null), 2000);

        toast({
          title: "Code copied",
          description: "Code snippet copied to clipboard.",
        });
      },
      (err) => {
        console.error("Could not copy text: ", err);
        toast({
          title: "Copy failed",
          description: "Failed to copy code to clipboard.",
          variant: "destructive",
        });
      },
    );
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Code className="h-4 w-4" />
          <span>Find Code Snippets</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Find Code Snippets</DialogTitle>
          <DialogDescription>
            Search for code snippets from past projects to reuse in your current
            project.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col space-y-4 pt-4 overflow-hidden">
          <div className="flex gap-3">
            <div className="flex-1">
              <div className="flex w-full items-center space-x-2">
                <Input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search for functions, components, or specific code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1"
                />
                <Button onClick={searchSnippets} disabled={isSearching}>
                  {isSearching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  <span className="ml-2 hidden sm:inline">Search</span>
                </Button>
              </div>
            </div>

            <Select
              value={fileTypeFilter || "all"}
              onValueChange={(value) =>
                setFileTypeFilter(value === "all" ? undefined : value)
              }
            >
              <SelectTrigger className="w-[120px]">
                <span className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  {fileTypeFilter === undefined
                    ? "All Files"
                    : fileTypeFilter === "all"
                      ? "All Files"
                      : fileTypeFilter}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Files</SelectItem>
                <SelectItem value="js">JavaScript</SelectItem>
                <SelectItem value="ts">TypeScript</SelectItem>
                <SelectItem value="jsx">JSX</SelectItem>
                <SelectItem value="tsx">TSX</SelectItem>
                <SelectItem value="css">CSS</SelectItem>
                <SelectItem value="py">Python</SelectItem>
                <SelectItem value="html">HTML</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isSearching ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="ml-2 text-sm text-muted-foreground">
                Searching for code snippets...
              </p>
            </div>
          ) : snippets.length > 0 ? (
            <div className="grid grid-cols-3 gap-4 overflow-hidden h-[calc(80vh-200px)]">
              <div className="col-span-1 overflow-y-auto pr-2 border-r">
                <div className="space-y-2">
                  {snippets.map((snippet) => (
                    <div
                      key={snippet.id}
                      className={`p-3 rounded-md cursor-pointer transition-colors ${
                        activeSnippet?.id === snippet.id
                          ? "bg-primary/10 border-primary/20 border"
                          : "hover:bg-muted border border-transparent"
                      }`}
                      onClick={() => handleSelectSnippet(snippet)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-medium truncate">
                              {snippet.filename}
                            </h4>
                            <Badge variant="outline" className="text-xs">
                              {snippet.language}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {snippet.description || "No description"}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 rounded-md"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSnippetSelection(snippet);
                          }}
                        >
                          <Plus
                            className={`h-4 w-4 ${
                              selectedSnippets.some((s) => s.id === snippet.id)
                                ? "text-primary"
                                : "text-muted-foreground"
                            }`}
                          />
                        </Button>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <p className="text-xs text-muted-foreground">
                          Match: {(snippet.similarity * 100).toFixed(0)}%
                        </p>
                        <span className="text-xs text-muted-foreground">•</span>
                        <p className="text-xs text-muted-foreground">
                          {snippet.modelUsed}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="col-span-2 overflow-hidden flex flex-col">
                {activeSnippet ? (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <div className="space-y-1">
                        <h3 className="text-sm font-medium flex items-center gap-2">
                          {activeSnippet.filename}
                          <Badge variant="outline" className="text-xs">
                            {activeSnippet.language}
                          </Badge>
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          From:{" "}
                          {activeSnippet.documentTitle || "Unknown project"}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <span className="font-medium">Model:</span>{" "}
                            {activeSnippet.modelUsed || "Unknown"}
                          </span>
                          {activeSnippet.source && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <span className="font-medium">Source:</span>{" "}
                                {activeSnippet.source}
                              </span>
                            </>
                          )}
                          {(activeSnippet as any).runId && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <span className="font-medium">Run:</span> #
                                {(activeSnippet as any).runId}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() =>
                                  copySnippetToClipboard(activeSnippet)
                                }
                              >
                                {copiedId === activeSnippet.id ? (
                                  <Check className="h-4 w-4 text-green-500" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Copy to clipboard</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() =>
                                  toggleSnippetSelection(activeSnippet)
                                }
                              >
                                <Plus
                                  className={`h-4 w-4 ${
                                    selectedSnippets.some(
                                      (s) => s.id === activeSnippet.id,
                                    )
                                      ? "text-primary"
                                      : "text-muted-foreground"
                                  }`}
                                />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>
                                {selectedSnippets.some(
                                  (s) => s.id === activeSnippet.id,
                                )
                                  ? "Remove from selection"
                                  : "Add to selection"}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>

                    <div className="overflow-y-auto border rounded-md">
                      <CodeBlock>
                        <CodeBlockCode
                          code={activeSnippet.code}
                          language={activeSnippet.language}
                          showMetadata={true}
                          metadata={{
                            model: activeSnippet.modelUsed,
                            runId: (activeSnippet as any).runId,
                            source: activeSnippet.source,
                            description: activeSnippet.description,
                          }}
                        />
                      </CodeBlock>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full">
                    <Code className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Select a snippet to view the code
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : searchQuery && !isSearching ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Code className="h-8 w-8 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">
                No code snippets found for &quot;{searchQuery}&quot;
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Try a different search term or check the following:
              </p>
              <ul className="text-xs text-muted-foreground mt-2 list-disc list-inside space-y-1">
                <li>Ensure you have code files in the database</li>
                <li>
                  Try using broader keywords (e.g., &quot;button&quot; instead
                  of &quot;SubmitButton&quot;)
                </li>
                <li>Remove language/file type filters</li>
                <li>
                  Check that embeddings are properly generated for your code
                  files
                </li>
              </ul>
            </div>
          ) : null}
        </div>

        <DialogFooter className="flex items-center justify-between">
          <div>
            {selectedSnippets.length > 0 && (
              <p className="text-sm">
                {selectedSnippets.length} snippet
                {selectedSnippets.length > 1 ? "s" : ""} selected
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" type="button">
              Cancel
            </Button>
            <Button
              type="button"
              disabled={selectedSnippets.length === 0}
              onClick={handleImportSnippets}
            >
              Import Selected
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
