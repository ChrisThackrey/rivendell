"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { TechOption } from "./tech-stack-modal";

type TechStackCardProps = {
  id: string;
  selectedOptions: TechOption[];
  delay?: number;
};

export default function TechStackCard({
  id,
  selectedOptions,
  delay = 0,
}: TechStackCardProps) {
  // Group options by category
  const groupedOptions: Record<string, TechOption[]> = {};

  selectedOptions.forEach((option) => {
    if (!groupedOptions[option.category]) {
      groupedOptions[option.category] = [];
    }
    groupedOptions[option.category].push(option);
  });

  return (
    <motion.div
      id={id}
      className="relative w-full"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay }}
    >
      <Card className="w-full max-w-2xl mx-auto border-l-4 border-blue-500">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            Selected Tech Stack
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(groupedOptions).map(([category, options]) => (
            <div key={category} className="space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground">
                {category}
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {options.map((option) => (
                  <Badge
                    key={option.id}
                    variant="outline"
                    className={
                      option.language === "TypeScript"
                        ? "bg-blue-50 text-blue-700 border-blue-200"
                        : option.language === "Python"
                          ? "bg-green-50 text-green-700 border-green-200"
                          : "bg-gray-50 text-gray-700 border-gray-200"
                    }
                  >
                    {option.name}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </motion.div>
  );
}
