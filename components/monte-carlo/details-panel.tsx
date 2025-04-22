import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Thermometer, Flame, Snowflake, CheckCircle2, Circle, Focus } from "lucide-react"; // Icons needed by DetailCard
import { cn } from "@/lib/utils";
import type { PointWithCluster } from './hooks/use-monte-carlo-data'; // Adjust path if needed
import { getTemperatureIcon, getTemperatureText, getModelCardColor } from '../utils';

// Detail card component (Moved here)
const DetailCard: React.FC<DetailCardProps> = ({ point, isMain = false, onSelect }) => {
  return (
    <Card className={cn("w-full", isMain ? `border-l-4 border-fuchsia-500` : "")}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="text-sm font-medium">
            {isMain ? "Selected Run" : "Related Run"}
          </CardTitle>
          <Badge variant="outline" className={getModelCardColor(point.model)}>
            {point.model}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="flex items-center gap-1">
            {getTemperatureIcon(point.temperature)}
            <span>{getTemperatureText(point.temperature)} ({point.temperature})</span>
          </Badge>
          <Badge variant="outline" className="bg-slate-50">Run #{point.runId}</Badge>
          {point.cluster && <Badge variant="outline" className="bg-slate-50">Cluster {point.cluster}</Badge>}
          {point.batchId && <Badge variant="outline" className="bg-slate-50">{point.batchId.replace("batch_", "").substring(0, 8)}...</Badge>}
        </div>
        <div className="text-xs text-slate-700"><p className="font-medium mb-1">Approach:</p><p>{point.approach}</p></div>
        <div className="text-xs text-slate-700"><p className="font-medium mb-1">Summary:</p><p>{point.solutionSummary}</p></div>
        <div className="grid grid-cols-3 gap-2 pt-1">
          {/* Metrics */}
          <div className="flex items-center gap-1 text-xs"><span className="text-slate-500">Time:</span><span className="text-slate-700 font-medium">{point.metrics.executionTime}</span></div>
          <div className="flex items-center gap-1 text-xs"><span className="text-slate-500">Complexity:</span><span className="text-slate-700 font-medium">{point.metrics.complexity}</span></div>
          <div className="flex items-center gap-1 text-xs"><span className="text-slate-500">Memory:</span><span className="text-slate-700 font-medium">{point.metrics.memoryUsage}</span></div>
          <div className="flex items-center gap-1 text-xs"><span className="text-slate-500">Lines:</span><span className="text-slate-700 font-medium">{point.metrics.lineCount}</span></div>
          <div className="flex items-center gap-1 text-xs"><span className="text-slate-500">Quality:</span><span className="text-slate-700 font-medium">{point.metrics.codeQuality}%</span></div>
          <div className="flex items-center gap-1 text-xs"><span className="text-slate-500">Convergence:</span><span className="text-slate-700 font-medium">{point.metrics.convergenceScore}%</span></div>
        </div>
        <Button size="sm" className="w-full bg-fuchsia-500 hover:bg-fuchsia-600 text-white" onClick={() => onSelect(point)}>
          Select This Run
        </Button>
      </CardContent>
    </Card>
  );
};

interface DetailsPanelProps {
  selectedPoint: PointWithCluster | null;
  hoveredPoint: PointWithCluster | null; // Need hovered to show details on hover when nothing selected
  selectedClosestPoints: PointWithCluster[];
  closestPoints: PointWithCluster[]; // Need closest points for hover state
  selectedClusterPoints: PointWithCluster[];
  selectedClusters: number[]; // Needed to decide if hover details should show
  getSelectedClusterTitle: () => string;
  onSelectPoint: (point: PointWithCluster) => void;
}

export const DetailsPanel: React.FC<DetailsPanelProps> = ({
  selectedPoint,
  hoveredPoint,
  selectedClosestPoints,
  closestPoints,
  selectedClusterPoints,
  selectedClusters,
  getSelectedClusterTitle,
  onSelectPoint,
}) => {
  return (
    <div className="col-span-12 md:col-span-12 lg:col-span-3 space-y-3 overflow-y-auto h-full pr-2 pb-4">
      {selectedClusterPoints.length > 0 ? (
        <>
          <div className="p-3 bg-green-100/40 rounded-md flex items-center justify-between sticky top-0 z-10">
            <h3 className="text-base font-semibold text-slate-900">{getSelectedClusterTitle()}</h3>
            <span className="text-sm text-slate-600">{selectedClusterPoints.length} Points</span>
          </div>
          <div className="space-y-2">
            {selectedClusterPoints.slice(0, 10).map((point) => (
              <DetailCard key={point.id} point={point} onSelect={onSelectPoint} />
            ))}
            {selectedClusterPoints.length > 10 && <p className="text-xs text-center text-slate-500"> + {selectedClusterPoints.length - 10} more</p>}
          </div>
        </>
      ) : selectedPoint ? (
        <>
          <DetailCard point={selectedPoint} isMain={true} onSelect={onSelectPoint} />
          <h3 className="text-sm font-medium text-slate-600 pt-2 sticky top-0 bg-white/90 backdrop-blur-sm z-10">Closest Related Runs</h3>
          <div className="space-y-2">
            {selectedClosestPoints.map((point) => (
              <DetailCard key={point.id} point={point} onSelect={onSelectPoint} />
            ))}
          </div>
        </>
      ) : hoveredPoint && selectedClusters.length === 0 ? ( // Show hover details only if no cluster is selected
        <>
          <DetailCard point={hoveredPoint} isMain={true} onSelect={onSelectPoint} />
          <h3 className="text-sm font-medium text-slate-600 pt-2 sticky top-0 bg-white/90 backdrop-blur-sm z-10">Closest Related Runs</h3>
          <div className="space-y-2">
            {closestPoints.map((point) => (
              <DetailCard key={point.id} point={point} onSelect={onSelectPoint} />
            ))}
          </div>
        </>
      ) : (
        <div className="bg-white rounded-lg shadow-md p-6 text-center text-slate-500 h-full flex items-center justify-center">
          <p>Select a point or cluster to view details.</p>
        </div>
      )}
    </div>
  );
}; 