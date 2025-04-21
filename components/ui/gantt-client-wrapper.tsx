"use client";

import { GanttDemo, GanttDemoProps } from "./demo-gantt";
import { useEffect, useState, useMemo } from "react";
import { parseISO, isValid } from "date-fns";

export function GanttClientWrapper({ ganttData }: GanttDemoProps) {
  // Use state to ensure the component is only rendered on the client
  const [isMounted, setIsMounted] = useState(false);

  // Process and optimize the Gantt data for dense packing
  const optimizedGanttData = useMemo(() => {
    if (!ganttData || !ganttData.features || ganttData.features.length === 0) {
      return ganttData;
    }

    // Make a deep copy of the data
    const processedData = {
      ...ganttData,
      features: [...ganttData.features].map((feature) => ({ ...feature })),
    };

    try {
      // Sort features by start date
      const sortedFeatures = processedData.features.sort((a, b) => {
        const startA =
          typeof a.startAt === "string" ? parseISO(a.startAt) : a.startAt;
        const startB =
          typeof b.startAt === "string" ? parseISO(b.startAt) : b.startAt;

        if (!isValid(startA) || !isValid(startB)) return 0;
        return startA.getTime() - startB.getTime();
      });

      // Group features by their phase
      const featuresByGroup: Record<string, any[]> = {};
      sortedFeatures.forEach((feature) => {
        const groupName = feature.group?.name || "Ungrouped";
        if (!featuresByGroup[groupName]) {
          featuresByGroup[groupName] = [];
        }
        featuresByGroup[groupName].push(feature);
      });

      // For each group, ensure tasks are overlapping
      Object.values(featuresByGroup).forEach((features) => {
        features.sort((a, b) => {
          const startA =
            typeof a.startAt === "string" ? parseISO(a.startAt) : a.startAt;
          const startB =
            typeof b.startAt === "string" ? parseISO(b.startAt) : b.startAt;

          if (!isValid(startA) || !isValid(startB)) return 0;
          return startA.getTime() - startB.getTime();
        });
      });

      return {
        ...processedData,
        features: sortedFeatures,
      };
    } catch (error) {
      console.error("Error optimizing Gantt data:", error);
      return ganttData;
    }
  }, [ganttData]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div className="h-[500px] border rounded-md bg-muted/20 flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading Gantt chart...</p>
      </div>
    );
  }

  return <GanttDemo ganttData={optimizedGanttData} />;
}
