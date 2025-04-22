import React from "react"
import { Loader2 } from "lucide-react"
import { formatBatchId } from "./utils" // Use the utility function

interface BatchSelectionSidebarProps {
  allBatchIds: string[]
  selectedBatchId: string | null
  handleBatchChange: (batchId: string) => void
  isLoading: boolean // To disable buttons while main content loads
  isFetchingBatches: boolean // To show loader specifically for batches
}

export function BatchSelectionSidebar({
  allBatchIds,
  selectedBatchId,
  handleBatchChange,
  isLoading,
  isFetchingBatches,
}: BatchSelectionSidebarProps) {
  return (
    <div className="col-span-12 md:col-span-3 lg:col-span-2 bg-white rounded-lg shadow-md overflow-hidden h-full">
      <div className="p-3 bg-slate-50 border-b">
        <h3 className="text-sm font-medium text-slate-700 flex justify-between items-center">
          Batch Selection
          {isFetchingBatches && (
            <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
          )}
        </h3>
      </div>

      <div className="h-[calc(100%-40px)] md:h-[calc(100%-48px)] overflow-y-auto p-2">
        {allBatchIds.length > 0 ? (
          <div className="space-y-1">
            {allBatchIds.map((batchId) => (
              <button
                key={batchId}
                onClick={() => handleBatchChange(batchId)}
                className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                  selectedBatchId === batchId
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "hover:bg-slate-50 text-slate-700"
                }`}
                disabled={isLoading || isFetchingBatches} // Disable if loading main content or fetching batches
              >
                {formatBatchId(batchId)}
              </button>
            ))}
          </div>
        ) : isFetchingBatches ? (
          <div className="flex items-center justify-center h-full text-sm text-slate-500">
            Loading batches...
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-slate-500">
            No batches available
          </div>
        )}
      </div>
    </div>
  )
} 