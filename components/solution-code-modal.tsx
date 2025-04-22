import React from "react"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { CodeBlock, CodeBlockCode, type CodeFile } from "@/components/ui/code-block"
import { cn } from "@/lib/utils"
import { RefreshCw, FileText, CodeIcon, PlusIcon, MinusIcon, EditIcon } from "lucide-react"

interface SolutionCodeModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  filesToDisplay: CodeFile[]
  displayFileTree?: string
  isLoading: boolean
  error: Error | null
  model?: string
  stepIndex?: number
  runId?: number // For metadata in code blocks
  onRefetch: () => void
}

export const SolutionCodeModal: React.FC<SolutionCodeModalProps> = ({
  isOpen,
  onOpenChange,
  title,
  description,
  filesToDisplay,
  displayFileTree,
  isLoading,
  error,
  model,
  stepIndex,
  runId,
  onRefetch,
}) => {
  const noMeaningfulCodeAvailable = filesToDisplay.length === 1 && filesToDisplay[0].source?.startsWith('placeholder');

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-7xl h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle>{title}</DialogTitle>
            {stepIndex !== undefined && (
              <span className="text-xs font-normal text-slate-500">
                Step {stepIndex + 1}
              </span>
            )}
          </div>
          <DialogDescription>{description}</DialogDescription>

          {/* File Tree Display */}
          {displayFileTree ? (
            <div className="mt-4 px-4 py-2 border border-slate-200 rounded-md bg-slate-50">
              <h3 className="text-sm font-medium mb-2 flex items-center">
                <FileText className="h-4 w-4 text-slate-500 mr-2" />
                Project Structure
              </h3>
              <pre className="text-xs whitespace-pre overflow-x-auto max-h-[200px] overflow-y-auto p-2 bg-white rounded border border-slate-200 font-mono">
                {displayFileTree}
              </pre>
            </div>
          ) : isLoading ? (
              <div className="text-xs text-slate-400 italic mt-2">Loading structure...</div>
          ) : (
              <div className="text-xs text-slate-400 italic mt-2">No project structure available.</div>
          )}
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-hidden">
          {isLoading ? (
            <div className="h-full flex items-center justify-center py-10">
              <div className="flex flex-col items-center gap-4">
                <RefreshCw className="w-8 h-8 animate-spin text-primary/50" />
                <span className="text-sm text-slate-500">
                  Loading code...
                </span>
              </div>
            </div>
          ) : error ? (
            <div className="h-full flex items-center justify-center py-10 text-center text-red-600">
              <p>Error loading code files:</p>
              <p className="text-xs mt-1">{error.message}</p>
              <Button variant="outline" size="sm" onClick={onRefetch} className="mt-4">Retry</Button>
            </div>
          ) : !noMeaningfulCodeAvailable ? (
            <ScrollArea className="h-full">
              <div className="space-y-6 px-4 pb-4">
                {filesToDisplay.map((file, index) => {
                  const metadata = (file as any).metadata || {};
                  const isNewFile = metadata.isNewFile === true;
                  const hasChanges = metadata.previousStepInfo?.changes;

                  return (
                    <div key={`${file.id || index}-${file.filename}`} className="relative">
                      {/* File header */}
                      <div className="flex items-center justify-between mb-2 gap-2">
                        <div className="flex items-center">
                          <h3 className="text-base font-medium text-slate-800 mr-2">
                            {file.filename}
                          </h3>
                          {/* Badges */}
                          {isNewFile && ( <Badge className="bg-blue-50 hover:bg-blue-50 text-blue-700 border-blue-100 mr-2"> New file </Badge> )}
                          {hasChanges && ( <Badge className={cn("border", /* ... conditional class logic ... */)}> {hasChanges.summary} </Badge> )}
                        </div>
                        {/* Change stats */}
                        {hasChanges && (
                           <div className="flex items-center text-xs space-x-3 text-slate-500">
                              <span className="flex items-center"> <PlusIcon className="h-3 w-3 text-green-500 mr-1" /> {hasChanges.linesAdded} </span>
                              <span className="flex items-center"> <MinusIcon className="h-3 w-3 text-red-500 mr-1" /> {hasChanges.linesRemoved} </span>
                              <span className="flex items-center"> <EditIcon className="h-3 w-3 text-blue-500 mr-1" /> {hasChanges.linesChanged} </span>
                           </div>
                        )}
                      </div>
                      {/* Change summary */}
                      {hasChanges && hasChanges.changePercentage >= 20 && (
                         <div className="mb-2 text-xs bg-slate-50 p-2 rounded border border-slate-200 text-slate-700">
                            <span className="font-medium"> Changes from previous step: </span>
                            {hasChanges.summary}({hasChanges.linesAdded} lines added, {hasChanges.linesRemoved} lines removed, {hasChanges.linesChanged} lines modified)
                         </div>
                      )}
                      {/* Code Block */}
                      <CodeBlock>
                        <CodeBlockCode
                          code={file.code}
                          language={file.language || "plaintext"}
                          showMetadata={true}
                          changesHighlight={
                            hasChanges ? { /* ... change data ... */ } : isNewFile ? { isNewFile: true } : undefined
                          }
                          metadata={{
                            model: model || "Unknown",
                            runId: runId,
                            source: file.filename,
                            fetchSource: (file as any).source,
                          }}
                        />
                      </CodeBlock>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          ) : (
             // Placeholder when no meaningful code is available
            <div className="h-full flex items-center justify-center py-10">
              <div className="text-center">
                <CodeIcon className="h-12 w-12 mx-auto text-slate-300" />
                <p className="mt-4 text-sm text-slate-500">
                  No meaningful code files available for this step.
                </p>
                {filesToDisplay[0]?.code && <pre className="mt-2 text-xs text-slate-400 max-w-md bg-slate-50 p-2 rounded">{filesToDisplay[0].code}</pre>}
                <div className="mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs flex items-center gap-1"
                    onClick={onRefetch}
                  >
                    <RefreshCw className="h-3 w-3" />
                    Try Again
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-between items-center flex-shrink-0 mt-4">
          <div className="text-xs text-slate-500">
            {model && <span>Generated with {model}</span>}
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 