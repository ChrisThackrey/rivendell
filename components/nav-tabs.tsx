"use client";

import { Box, HomeIcon, PanelsTopLeft } from "lucide-react";
import { TabsComponent, type TabItem } from "./navigation-tabs";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function NavTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState("overview");

  // Set active tab based on current path
  useEffect(() => {
    if (pathname === "/") {
      setActiveTab("overview");
    } else if (pathname.startsWith("/gantt")) {
      setActiveTab("projects");
    } else if (pathname.startsWith("/monte-carlo")) {
      setActiveTab("clusters");
    }
  }, [pathname]);

  // Handle tab changes
  const handleTabChange = (value: string) => {
    // Navigate based on tab value
    if (value === "overview") {
      router.push("/");
    } else if (value === "projects") {
      router.push("/gantt");
    } else if (value === "clusters") {
      router.push("/monte-carlo");
    }
  };

  const tabs: TabItem[] = [
    {
      value: "overview",
      label: "Overview",
      icon: HomeIcon,
      content: <div></div>,
    },
    {
      value: "projects",
      label: "Projects",
      icon: PanelsTopLeft,
      content: <div></div>,
    },
    {
      value: "clusters",
      label: "Clusters",
      icon: Box,
      content: <div></div>,
    },
  ];

  return (
    <div className="fixed top-4 left-4 z-50 min-w-fit">
      <TabsComponent
        tabs={tabs}
        className="w-auto"
        defaultValue={activeTab}
        onValueChange={handleTabChange}
      />
    </div>
  );
}
