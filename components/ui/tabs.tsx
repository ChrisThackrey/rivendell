"use client";

import * as React from "react";

interface TabsProps {
  defaultValue?: string;
  value?: string;
  children: React.ReactNode;
  className?: string;
  onValueChange?: (value: string) => void;
}

interface TabsListProps {
  children: React.ReactNode;
  className?: string;
}

interface TabsTriggerProps {
  value: string;
  children: React.ReactNode;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
}

interface TabsContentProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

const TabsContext = React.createContext<{
  value: string;
  onValueChange: (value: string) => void;
} | null>(null);

function Tabs({
  defaultValue,
  value,
  children,
  className = "",
  onValueChange,
}: TabsProps) {
  // If value is provided (controlled mode), use it directly
  // Otherwise, maintain internal state with defaultValue
  const [internalValue, setInternalValue] = React.useState(defaultValue || "");

  // Use value if provided, otherwise use internal state
  const actualValue = value !== undefined ? value : internalValue;

  // Create handler that will call onValueChange if provided, and update internal state otherwise
  const handleValueChange = React.useCallback(
    (newValue: string) => {
      if (onValueChange) {
        onValueChange(newValue);
      }

      // Only update internal state if we're in uncontrolled mode
      if (value === undefined) {
        setInternalValue(newValue);
      }
    },
    [onValueChange, value],
  );

  return (
    <TabsContext.Provider
      value={{ value: actualValue, onValueChange: handleValueChange }}
    >
      <div className={`w-full ${className}`}>{children}</div>
    </TabsContext.Provider>
  );
}

function TabsList({ children, className = "" }: TabsListProps) {
  return (
    <div
      role="tablist"
      className={`inline-flex h-10 items-center justify-center rounded-md bg-gray-100 p-1 ${className}`}
    >
      {children}
    </div>
  );
}

function TabsTrigger({
  value,
  children,
  className = "",
  onClick,
}: TabsTriggerProps) {
  const context = React.useContext(TabsContext);

  if (!context) {
    throw new Error("TabsTrigger must be used within a Tabs component");
  }

  const isActive = context.value === value;

  return (
    <button
      role="tab"
      aria-selected={isActive}
      data-state={isActive ? "active" : "inactive"}
      onClick={(e) => {
        e.preventDefault();
        context.onValueChange(value);
        if (onClick) {
          onClick(e);
        }
      }}
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-white transition-all
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
        disabled:pointer-events-none disabled:opacity-50
        ${
          isActive
            ? "bg-white text-gray-900 shadow-sm"
            : "text-gray-500 hover:text-gray-900"
        }
        ${className}`}
    >
      {children}
    </button>
  );
}

function TabsContent({ value, children, className = "" }: TabsContentProps) {
  const context = React.useContext(TabsContext);

  if (!context) {
    throw new Error("TabsContent must be used within a Tabs component");
  }

  const isSelected = context.value === value;

  if (!isSelected) return null;

  return (
    <div
      role="tabpanel"
      data-state={isSelected ? "active" : "inactive"}
      className={className}
    >
      {children}
    </div>
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
