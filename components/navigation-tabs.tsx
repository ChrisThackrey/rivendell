"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface TabItem {
  value: string;
  label: string;
  icon: LucideIcon;
  content: ReactNode;
}

interface TabsProps {
  tabs: TabItem[];
  defaultValue?: string;
  className?: string;
  onValueChange?: (value: string) => void;
}

export function TabsComponent({
  tabs,
  defaultValue = tabs[0]?.value,
  className,
  onValueChange,
}: TabsProps) {
  return (
    <Tabs
      defaultValue={defaultValue}
      className={className}
      onValueChange={onValueChange}
    >
      <div className="min-w-fit bg-white shadow-md rounded-md">
        <TabsList className="h-auto bg-white p-0 flex w-full">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="flex-1 relative rounded-none border border-border py-2 px-4 whitespace-nowrap after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 first:rounded-tl-md first:rounded-bl-md last:rounded-tr-md last:rounded-br-md data-[state=active]:bg-white data-[state=active]:text-purple-600 data-[state=active]:after:bg-purple-600 hover:text-purple-600 transition-colors"
              >
                <Icon
                  className="mr-1.5 opacity-60"
                  size={16}
                  strokeWidth={2}
                  aria-hidden="true"
                />
                {tab.label}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </div>

      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value}>
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
