"use client";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  GanttCreateMarkerTrigger,
  GanttFeatureItem,
  GanttFeatureList,
  GanttFeatureListGroup,
  GanttHeader,
  GanttMarker,
  GanttProvider,
  GanttSidebar,
  GanttSidebarGroup,
  GanttSidebarItem,
  GanttTimeline,
  GanttToday,
} from "@/components/ui/gantt";
import { EyeIcon, LinkIcon, TrashIcon } from "lucide-react";
import { useState, useEffect } from "react";

import {
  addMonths,
  endOfMonth,
  startOfMonth,
  subDays,
  subMonths,
  parseISO,
} from "date-fns";

// Default data
const today = new Date();

const defaultStatuses = [
  { id: "1", name: "Planned", color: "#6B7280" },
  { id: "2", name: "In Progress", color: "#F59E0B" },
  { id: "3", name: "Done", color: "#10B981" },
];

const defaultFeatures = [
  {
    id: "1",
    name: "AI Scene Analysis",
    startAt: startOfMonth(subMonths(today, 6)),
    endAt: subDays(endOfMonth(today), 5),
    status: defaultStatuses[0],
    group: { id: "1", name: "Core AI Features" },
    product: { id: "1", name: "Video Editor Pro" },
    owner: {
      id: "1",
      image: "https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=1",
      name: "Alice Johnson",
    },
    initiative: { id: "1", name: "AI Integration" },
    release: { id: "1", name: "v1.0" },
  },
  {
    id: "2",
    name: "Collaborative Editing",
    startAt: startOfMonth(subMonths(today, 5)),
    endAt: subDays(endOfMonth(today), 5),
    status: defaultStatuses[1],
    group: { id: "2", name: "Collaboration Tools" },
    product: { id: "1", name: "Video Editor Pro" },
    owner: {
      id: "2",
      image: "https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=2",
      name: "Bob Smith",
    },
    initiative: { id: "2", name: "Real-time Collaboration" },
    release: { id: "1", name: "v1.0" },
  },
  {
    id: "3",
    name: "AI-Powered Color Grading",
    startAt: startOfMonth(subMonths(today, 4)),
    endAt: subDays(endOfMonth(today), 5),
    status: defaultStatuses[2],
    group: { id: "1", name: "Core AI Features" },
    product: { id: "1", name: "Video Editor Pro" },
    owner: {
      id: "3",
      image: "https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=3",
      name: "Charlie Brown",
    },
    initiative: { id: "1", name: "AI Integration" },
    release: { id: "2", name: "v1.1" },
  },
  // Only showing a few example features for brevity
];

const defaultMarkers = [
  {
    id: "1",
    date: startOfMonth(subMonths(today, 3)),
    label: "Project Kickoff",
    className: "bg-blue-100 text-blue-900",
  },
  {
    id: "2",
    date: subMonths(endOfMonth(today), 2),
    label: "Phase 1 Completion",
    className: "bg-green-100 text-green-900",
  },
  {
    id: "3",
    date: startOfMonth(addMonths(today, 3)),
    label: "Beta Release",
    className: "bg-purple-100 text-purple-900",
  },
  {
    id: "4",
    date: endOfMonth(addMonths(today, 6)),
    label: "Version 1.0 Launch",
    className: "bg-red-100 text-red-900",
  },
];

export type GanttDemoProps = {
  ganttData?: {
    statuses?: Array<{
      id: string;
      name: string;
      color: string;
    }>;
    features?: Array<{
      id: string;
      name: string;
      startAt: string | Date;
      endAt: string | Date;
      status: {
        id: string;
        name: string;
        color: string;
      };
      group: {
        id: string;
        name: string;
      };
      product?: {
        id: string;
        name: string;
      };
      owner?: {
        id: string;
        image?: string;
        name: string;
      };
      initiative?: {
        id: string;
        name: string;
      };
      release?: {
        id: string;
        name: string;
      };
    }>;
    markers?: Array<{
      id: string;
      date: string | Date;
      label: string;
      className?: string;
    }>;
  };
};

// Define clearer interfaces for the component state
interface GanttFeatureType {
  id: string;
  name: string;
  startAt: Date;
  endAt: Date;
  status: { id: string; name: string; color: string };
  group: { id: string; name: string };
  product?: { id: string; name: string };
  owner?: { id: string; image?: string; name: string };
  initiative?: { id: string; name: string };
  release?: { id: string; name: string };
}

interface GanttMarkerType {
  id: string;
  date: Date;
  label: string;
  className?: string;
}

export function GanttDemo({ ganttData }: GanttDemoProps) {
  // Use dynamic data or fall back to defaults
  const [statuses, setStatuses] = useState(defaultStatuses);
  const [markers, setMarkers] = useState<GanttMarkerType[]>(defaultMarkers);
  const [features, setFeatures] = useState<GanttFeatureType[]>(defaultFeatures);

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
                : startOfMonth(subMonths(today, 1));

            const validEndAt =
              endAtDate instanceof Date && !isNaN(endAtDate.getTime())
                ? endAtDate
                : endOfMonth(today);

            return {
              ...feature,
              startAt: validStartAt,
              endAt: validEndAt,
            };
          });
          setFeatures(processedFeatures);
        } catch (error) {
          console.error("Error processing feature dates:", error);
          // Fallback to default features if there's an error
          setFeatures(defaultFeatures);
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

            return {
              ...marker,
              date: validDate,
            };
          });
          setMarkers(processedMarkers);
        } catch (error) {
          console.error("Error processing marker dates:", error);
          // Fallback to default markers if there's an error
          setMarkers(defaultMarkers);
        }
      }
    }
  }, [ganttData]);

  // Group features by their group name
  const groupedFeatures: Record<string, typeof features> = features.reduce<
    Record<string, typeof features>
  >((groups, feature) => {
    const groupName = feature.group.name;
    return {
      ...groups,
      [groupName]: [...(groups[groupName] || []), feature],
    };
  }, {});

  // Sort groups alphabetically
  const sortedGroupedFeatures = Object.fromEntries(
    Object.entries(groupedFeatures).sort(([nameA], [nameB]) =>
      nameA.localeCompare(nameB),
    ),
  );

  // Event handlers
  const handleViewFeature = (id: string) =>
    console.log(`Feature selected: ${id}`);

  const handleCopyLink = (id: string) => console.log(`Copy link: ${id}`);

  const handleRemoveFeature = (id: string) =>
    setFeatures((prev) => prev.filter((feature) => feature.id !== id));

  const handleRemoveMarker = (id: string) =>
    setMarkers((prev) => prev.filter((marker) => marker.id !== id));

  const handleCreateMarker = (date: Date) => {
    const newMarker = {
      id: `marker-${Date.now()}`,
      date,
      label: `Marker ${markers.length + 1}`,
      className: "bg-blue-100 text-blue-900",
    };
    setMarkers((prev) => [...prev, newMarker]);
  };

  const handleMoveFeature = (id: string, startAt: Date, endAt: Date | null) => {
    if (!endAt) {
      return;
    }

    setFeatures((prev) =>
      prev.map((feature) =>
        feature.id === id ? { ...feature, startAt, endAt } : feature,
      ),
    );

    console.log(`Move feature: ${id} from ${startAt} to ${endAt}`);
  };

  const handleAddFeature = (date: Date) => {
    // Generate a simple new feature when the user clicks to add
    const defaultGroup = Object.keys(groupedFeatures)[0] || "New Group";
    const defaultStatus = statuses[0];

    const newFeature = {
      id: `feature-${Date.now()}`,
      name: `New Feature`,
      startAt: date,
      endAt: addMonths(date, 1),
      status: defaultStatus,
      group: {
        id: defaultGroup,
        name: groupedFeatures[defaultGroup]?.[0]?.group?.name || defaultGroup,
      },
      product: features[0]?.product,
      owner: features[0]?.owner,
      initiative: features[0]?.initiative,
      release: features[0]?.release,
    };

    setFeatures((prev) => [...prev, newFeature]);
  };

  return (
    <GanttProvider
      onAddItem={handleAddFeature}
      range="monthly"
      zoom={100}
      className="h-[500px] border"
    >
      <GanttSidebar>
        {Object.entries(sortedGroupedFeatures).map(([group, features]) => (
          <GanttSidebarGroup key={group} name={group}>
            {features.map((feature) => (
              <GanttSidebarItem
                key={feature.id}
                feature={feature}
                onSelectItem={handleViewFeature}
              />
            ))}
          </GanttSidebarGroup>
        ))}
      </GanttSidebar>
      <GanttTimeline>
        <GanttHeader />
        <GanttFeatureList>
          {Object.entries(sortedGroupedFeatures).map(([group, features]) => (
            <GanttFeatureListGroup key={group}>
              {features.map((feature) => (
                <div className="flex" key={feature.id}>
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <button
                        type="button"
                        onClick={() => handleViewFeature(feature.id)}
                      >
                        <GanttFeatureItem
                          onMove={handleMoveFeature}
                          {...feature}
                        />
                      </button>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      <ContextMenuItem
                        className="flex items-center gap-2"
                        onClick={() => handleViewFeature(feature.id)}
                      >
                        <EyeIcon size={16} className="text-muted-foreground" />
                        View feature
                      </ContextMenuItem>
                      <ContextMenuItem
                        className="flex items-center gap-2"
                        onClick={() => handleCopyLink(feature.id)}
                      >
                        <LinkIcon size={16} className="text-muted-foreground" />
                        Copy link
                      </ContextMenuItem>
                      <ContextMenuItem
                        className="flex items-center gap-2 text-destructive"
                        onClick={() => handleRemoveFeature(feature.id)}
                      >
                        <TrashIcon size={16} />
                        Remove from roadmap
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                </div>
              ))}
            </GanttFeatureListGroup>
          ))}
        </GanttFeatureList>
        {markers.map((marker) => (
          <GanttMarker
            key={marker.id}
            {...marker}
            onRemove={handleRemoveMarker}
          />
        ))}
        <GanttToday />
        <GanttCreateMarkerTrigger onCreateMarker={handleCreateMarker} />
      </GanttTimeline>
    </GanttProvider>
  );
}
