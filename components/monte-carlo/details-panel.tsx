import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Thermometer, Flame, Snowflake, CheckCircle2, Circle, Focus } from "lucide-react"; // Icons needed by DetailCard
import { cn } from "@/lib/utils";
import type { PointWithCluster } from '@/lib/monte-carlo-service';
import { getModelCardColor } from '@/components/monte-carlo/utils';
import { DetailCard } from './DetailCard';

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
            {/* Show all points in the selected cluster(s) */}
            {selectedClusterPoints.map((point) => (
              <DetailCard 
                key={point.id} 
                point={point} 
                onSelect={onSelectPoint}
                isMain={selectedPoint?.id === point.id} 
              />
            ))}
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