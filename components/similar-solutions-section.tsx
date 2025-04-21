"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, Search, ThumbsUp, SearchX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  CodeBlock,
  CodeBlockCode,
  CodeBlockTabs,
} from "@/components/ui/code-block";
import Link from "next/link";
import { useToast } from "@/components/ui/use-toast";

type SimilarSolution = {
  id: string;
  batchId?: string;
  prompt: string;
  solution: string;
  model: string;
  similarity: number;
  steps: any[];
  codeFiles: any[];
};

type SimilarSolutionsProps = {
  prompt: string;
  onUseSolution?: (solution: SimilarSolution) => void;
  similarityThreshold?: number;
  maxResults?: number;
};

export default function SimilarSolutionsSection({
  prompt,
  onUseSolution,
  similarityThreshold = 0.75,
  maxResults = 3,
}: SimilarSolutionsProps) {
  const [isSearching, setIsSearching] = useState(false);
  const [similarSolutions, setSimilarSolutions] = useState<SimilarSolution[]>(
    [],
  );
  const [hasSearched, setHasSearched] = useState(false);
  const [expandedSolution, setExpandedSolution] = useState<string | null>(null);
  const [activeCodeFile, setActiveCodeFile] = useState(0);
  const { toast } = useToast();

  // Automatically search when the component mounts if there's a prompt
  useEffect(() => {
    if (prompt && prompt.trim().length > 10 && !hasSearched) {
      searchSimilarSolutions();
    }
  }, [prompt, hasSearched]);

  const searchSimilarSolutions = async () => {
    if (!prompt || prompt.trim().length < 10) {
      toast({
        title: "Prompt too short",
        description: "Please enter a longer prompt to find similar solutions.",
        variant: "destructive",
      });
      return;
    }

    setIsSearching(true);
    setHasSearched(true);

    try {
      const response = await fetch("/api/similar-solutions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          similarityThreshold,
          maxResults,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to search for similar solutions");
      }

      const data = await response.json();
      setSimilarSolutions(data.similarSolutions || []);
    } catch (error) {
      console.error("Error searching for similar solutions:", error);
      toast({
        title: "Search failed",
        description: "An error occurred while searching for similar solutions.",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleUseSolution = (solution: SimilarSolution) => {
    if (onUseSolution) {
      onUseSolution(solution);
    }

    toast({
      title: "Solution selected",
      description: "Using this solution as a starting point.",
    });
  };

  const toggleExpandSolution = (id: string) => {
    if (expandedSolution === id) {
      setExpandedSolution(null);
    } else {
      setExpandedSolution(id);
    }
  };

  if (!hasSearched) {
    return (
      <div className="py-4">
        <Button
          variant="secondary"
          onClick={searchSimilarSolutions}
          disabled={isSearching || !prompt || prompt.trim().length < 10}
          className="flex items-center gap-2"
        >
          {isSearching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          Find similar solutions
        </Button>
      </div>
    );
  }

  if (isSearching) {
    return (
      <div className="py-4 flex flex-col items-center gap-2">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Searching for similar solutions...
        </p>
      </div>
    );
  }

  if (similarSolutions.length === 0 && hasSearched) {
    return (
      <div className="py-4">
        <Card className="bg-muted/50">
          <CardContent className="pt-6 pb-4 flex flex-col items-center gap-2">
            <SearchX className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground text-center">
              No similar solutions found. Creating a new solution for you.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="py-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium flex items-center gap-2">
          <ThumbsUp className="h-5 w-5 text-green-500" />
          Similar Solutions Found ({similarSolutions.length})
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSimilarSolutions([]);
            setHasSearched(false);
          }}
        >
          Clear Results
        </Button>
      </div>

      <div className="space-y-3">
        {similarSolutions.map((solution) => (
          <Card key={solution.id} className="overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <CardTitle className="text-base truncate">
                    {solution.prompt.split("\n")[0]}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-2">
                    <Badge variant="outline">{solution.model}</Badge>
                    <span className="text-xs">
                      Similarity: {(solution.similarity * 100).toFixed(1)}%
                    </span>
                  </CardDescription>
                </div>
                <Button size="sm" onClick={() => handleUseSolution(solution)}>
                  Use This Solution
                </Button>
              </div>
            </CardHeader>

            <CardContent className="pb-2">
              <p className="text-sm line-clamp-3">{solution.prompt}</p>
            </CardContent>

            <CardFooter className="flex justify-between pt-2 pb-2 border-t">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleExpandSolution(solution.id)}
              >
                {expandedSolution === solution.id
                  ? "Hide Details"
                  : "Show Details"}
              </Button>

              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {solution.steps.length} steps
                </Badge>

                {solution.codeFiles.length > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {solution.codeFiles.length} code files
                  </Badge>
                )}
              </div>
            </CardFooter>

            {expandedSolution === solution.id && (
              <div className="border-t p-3 bg-muted/30">
                <div className="space-y-3">
                  {solution.steps.length > 0 && (
                    <div className="space-y-1">
                      <h4 className="text-sm font-medium">Steps</h4>
                      <ul className="space-y-1">
                        {solution.steps.map((step, index) => (
                          <li key={index} className="text-xs truncate">
                            • {step.title}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {solution.codeFiles.length > 0 && (
                    <div className="space-y-1">
                      <h4 className="text-sm font-medium">Code Files</h4>
                      <CodeBlock>
                        <CodeBlockTabs
                          files={solution.codeFiles}
                          activeTab={activeCodeFile}
                          onTabChange={setActiveCodeFile}
                        />

                        <CodeBlockCode
                          code={
                            solution.codeFiles[activeCodeFile]?.code ||
                            "// No code available"
                          }
                          language={
                            solution.codeFiles[activeCodeFile]?.language ||
                            "tsx"
                          }
                        />
                      </CodeBlock>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
