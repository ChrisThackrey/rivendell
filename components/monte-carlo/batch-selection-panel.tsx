import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatBatchId } from '@/components/monte-carlo/utils';

interface BatchSelectionPanelProps {
  allBatchIds: string[] | null;
  selectedBatchId: string | null;
  onBatchChange: (batchId: string) => void;
  isLoadingData: boolean; // Is main data loading?
  isFetchingBatches: boolean; // Is the batch list itself loading?
}

export const BatchSelectionPanel: React.FC<BatchSelectionPanelProps> = ({
  allBatchIds,
  selectedBatchId,
  onBatchChange,
  isLoadingData,
  isFetchingBatches,
}) => {
  return (
    <div className="col-span-12 md:col-span-3 lg:col-span-2 bg-white rounded-lg shadow-md overflow-hidden h-full flex flex-col">
      <div className="p-3 bg-slate-50 border-b flex-shrink-0">
        <h3 className="text-sm font-medium text-slate-700 flex justify-between items-center">
          Batch Selection
          {isFetchingBatches && <Loader2 className="h-4 w-4 animate-spin text-slate-500" />}
        </h3>
      </div>
      <div className="flex-grow overflow-y-auto p-2">
        {allBatchIds && allBatchIds.length > 0 ? (
          <div className="space-y-1">
            {allBatchIds.map((batchId) => (
              <button
                key={batchId}
                onClick={() => onBatchChange(batchId)}
                className={cn(
                  "w-full text-left px-3 py-2 rounded text-sm transition-colors",
                  selectedBatchId === batchId
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "hover:bg-slate-50 text-slate-700"
                )}
                disabled={isLoadingData || isFetchingBatches}
              >
                {formatBatchId(batchId)}
              </button>
            ))}
          </div>
        ) : isFetchingBatches ? (
          <div className="flex items-center justify-center h-full text-sm text-slate-500">Loading batches...</div>
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-slate-500">No batches found</div>
        )}
      </div>
    </div>
  );
}; 