"use client";

import { GanttDemo, GanttDemoProps } from "./demo-gantt";
import {
  addWeeks,
  endOfWeek,
  format,
  getWeek,
  startOfWeek,
  getDay,
  differenceInDays,
  addDays,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { useEffect, useState, useMemo } from "react";
import { parseISO, isValid } from "date-fns";

// Define types for our Gantt data
interface GanttFeature {
  id: string;
  name: string;
  startAt: Date;
  endAt: Date;
  status: { id: string; name: string; color: string };
  group: { id: string; name: string };
  product: { id: string; name: string };
  owner: { id: string; name: string };
  initiative: { id: string; name: string };
  release: { id: string; name: string };
}

interface GanttMarker {
  id: string;
  date: Date;
  label: string;
  className: string;
}

// Custom Gantt wrapper that uses weeks instead of months
export function WeeklyGanttWrapper({ ganttData }: GanttDemoProps) {
  // Use state to ensure the component is only rendered on the client
  const [isMounted, setIsMounted] = useState(false);

  // Process and optimize the Gantt data for weekly view
  const weeklyGanttData = useMemo(() => {
    if (!ganttData || !ganttData.features || ganttData.features.length === 0) {
      return ganttData;
    }

    // Make a deep copy of the data
    const processedData = {
      ...ganttData,
      features: [...ganttData.features].map((feature) => {
        // Parse dates if they're strings
        const startAt =
          typeof feature.startAt === "string"
            ? parseISO(feature.startAt)
            : feature.startAt;
        const endAt =
          typeof feature.endAt === "string"
            ? parseISO(feature.endAt)
            : feature.endAt;

        if (!isValid(startAt) || !isValid(endAt)) {
          return feature;
        }

        // Adjust to weekly boundaries
        const weekStart = startOfWeek(startAt);
        const weekEnd = endOfWeek(endAt);

        return {
          ...feature,
          startAt: weekStart.toISOString(),
          endAt: weekEnd.toISOString(),
        };
      }),
    };

    // Process markers for weekly alignment
    if (processedData.markers && Array.isArray(processedData.markers)) {
      processedData.markers = processedData.markers.map((marker) => {
        const date =
          typeof marker.date === "string" ? parseISO(marker.date) : marker.date;

        if (!isValid(date)) {
          return marker;
        }

        // Adjust to start of week
        const weekStart = startOfWeek(date);

        return {
          ...marker,
          date: weekStart.toISOString(),
        };
      });
    }

    return processedData;
  }, [ganttData]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div className="h-[500px] border rounded-md bg-muted/20 flex items-center justify-center">
        <p className="text-muted-foreground text-sm">
          Loading weekly Gantt chart...
        </p>
      </div>
    );
  }

  // Pass the modified data to the standard Gantt component
  return <WeeklyGanttProvider ganttData={weeklyGanttData} />;
}

// Custom Gantt provider that overrides the default with weekly settings
function WeeklyGanttProvider({ ganttData }: GanttDemoProps) {
  // Use dynamic data or fall back to defaults
  const [statuses, setStatuses] = useState([
    { id: "1", name: "Planned", color: "#6B7280" },
    { id: "2", name: "In Progress", color: "#F59E0B" },
    { id: "3", name: "Done", color: "#10B981" },
  ]);

  const today = new Date();

  const [markers, setMarkers] = useState<GanttMarker[]>([
    {
      id: "1",
      date: startOfWeek(today),
      label: "This Week",
      className: "bg-blue-100 text-blue-900",
    },
  ]);

  const [features, setFeatures] = useState<GanttFeature[]>([
    {
      id: "1",
      name: "Example Feature",
      startAt: startOfWeek(today),
      endAt: endOfWeek(addWeeks(today, 1)),
      status: { id: "1", name: "Planned", color: "#6B7280" },
      group: { id: "1", name: "Example Group" },
      product: { id: "1", name: "Product" },
      owner: { id: "1", name: "Owner" },
      initiative: { id: "1", name: "Initiative" },
      release: { id: "1", name: "Release" },
    },
  ]);

  // Convert ISO date strings to Date objects if needed
  useEffect(() => {
    if (ganttData) {
      // Process statuses (directly usable)
      if (ganttData.statuses && ganttData.statuses.length > 0) {
        setStatuses(ganttData.statuses);
      }

      // Process features (need date conversion)
      if (ganttData.features && ganttData.features.length > 0) {
        try {
          const processedFeatures = ganttData.features.map((feature) => {
            // Ensure we're working with valid dates
            const startAtDate =
              typeof feature.startAt === "string"
                ? parseISO(feature.startAt)
                : feature.startAt;

            const endAtDate =
              typeof feature.endAt === "string"
                ? parseISO(feature.endAt)
                : feature.endAt;

            // Validate dates - if either is invalid, create fallback dates
            const validStartAt =
              startAtDate instanceof Date && !isNaN(startAtDate.getTime())
                ? startAtDate
                : startOfWeek(today);

            const validEndAt =
              endAtDate instanceof Date && !isNaN(endAtDate.getTime())
                ? endAtDate
                : endOfWeek(today);

            // Fill in any missing required fields with defaults
            return {
              id: feature.id,
              name: feature.name,
              startAt: validStartAt,
              endAt: validEndAt,
              status: feature.status,
              group: feature.group,
              product: feature.product || { id: "1", name: "Default Product" },
              owner: feature.owner || { id: "1", name: "Default Owner" },
              initiative: feature.initiative || {
                id: "1",
                name: "Default Initiative",
              },
              release: feature.release || { id: "1", name: "Default Release" },
            } as GanttFeature;
          });

          setFeatures(processedFeatures as GanttFeature[]);
        } catch (error) {
          console.error("Error processing feature dates:", error);
        }
      }

      // Process markers (need date conversion)
      if (ganttData.markers && ganttData.markers.length > 0) {
        try {
          const processedMarkers = ganttData.markers.map((marker) => {
            // Ensure we're working with valid dates
            const markerDate =
              typeof marker.date === "string"
                ? parseISO(marker.date)
                : marker.date;

            // Validate date - if invalid, create fallback
            const validDate =
              markerDate instanceof Date && !isNaN(markerDate.getTime())
                ? markerDate
                : today;

            // Ensure className is always defined
            return {
              id: marker.id,
              date: validDate,
              label: marker.label,
              className: marker.className || "bg-blue-100 text-blue-900",
            } as GanttMarker;
          });

          setMarkers(processedMarkers as GanttMarker[]);
        } catch (error) {
          console.error("Error processing marker dates:", error);
        }
      }
    }
  }, [ganttData]);

  const customGanttData = {
    statuses,
    features,
    markers,
  };

  return (
    <div className="weekly-gantt">
      <GanttDemo ganttData={customGanttData} />
      <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
        <p className="text-blue-800 text-sm">
          <span className="font-semibold">Note:</span> This Gantt chart is
          displaying features aligned to weekly boundaries, making it easier to
          plan in weekly sprints.
        </p>
      </div>
    </div>
  );
}
