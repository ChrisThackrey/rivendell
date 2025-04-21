"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  saveTechStackConfig,
  getTechStackConfigs,
  TechStackConfig,
  deleteTechStackConfig,
} from "@/lib/tech-stack-service";

export type TechOption = {
  id: string;
  name: string;
  category: "Frontend" | "Backend" | "DevOps" | "Deployment";
  language: "TypeScript" | "Python" | "Both";
};

type TechStackModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (selectedOptions: TechOption[]) => void;
};

const techOptions: TechOption[] = [
  // TypeScript Frontend
  { id: "react", name: "React", category: "Frontend", language: "TypeScript" },
  { id: "next", name: "Next.js", category: "Frontend", language: "TypeScript" },
  { id: "vue", name: "Vue.js", category: "Frontend", language: "TypeScript" },
  {
    id: "angular",
    name: "Angular",
    category: "Frontend",
    language: "TypeScript",
  },
  {
    id: "svelte",
    name: "Svelte",
    category: "Frontend",
    language: "TypeScript",
  },
  {
    id: "tailwind",
    name: "Tailwind CSS",
    category: "Frontend",
    language: "Both",
  },

  // TypeScript Backend
  { id: "node", name: "Node.js", category: "Backend", language: "TypeScript" },
  {
    id: "express",
    name: "Express",
    category: "Backend",
    language: "TypeScript",
  },
  { id: "nest", name: "NestJS", category: "Backend", language: "TypeScript" },
  { id: "prisma", name: "Prisma", category: "Backend", language: "TypeScript" },
  {
    id: "graphql-ts",
    name: "GraphQL",
    category: "Backend",
    language: "TypeScript",
  },

  // Python Backend
  { id: "django", name: "Django", category: "Backend", language: "Python" },
  { id: "flask", name: "Flask", category: "Backend", language: "Python" },
  { id: "fastapi", name: "FastAPI", category: "Backend", language: "Python" },
  {
    id: "sqlalchemy",
    name: "SQLAlchemy",
    category: "Backend",
    language: "Python",
  },
  {
    id: "graphql-py",
    name: "GraphQL",
    category: "Backend",
    language: "Python",
  },

  // DevOps (Both)
  { id: "docker", name: "Docker", category: "DevOps", language: "Both" },
  {
    id: "kubernetes",
    name: "Kubernetes",
    category: "DevOps",
    language: "Both",
  },
  {
    id: "github-actions",
    name: "GitHub Actions",
    category: "DevOps",
    language: "Both",
  },
  { id: "jenkins", name: "Jenkins", category: "DevOps", language: "Both" },
  { id: "terraform", name: "Terraform", category: "DevOps", language: "Both" },

  // Deployment (Both)
  { id: "vercel", name: "Vercel", category: "Deployment", language: "Both" },
  { id: "netlify", name: "Netlify", category: "Deployment", language: "Both" },
  { id: "aws", name: "AWS", category: "Deployment", language: "Both" },
  { id: "gcp", name: "Google Cloud", category: "Deployment", language: "Both" },
  { id: "azure", name: "Azure", category: "Deployment", language: "Both" },
  { id: "heroku", name: "Heroku", category: "Deployment", language: "Both" },
];

export default function TechStackModal({
  isOpen,
  onClose,
  onSubmit,
}: TechStackModalProps) {
  const [selectedOptions, setSelectedOptions] = useState<TechOption[]>([]);
  const [activeTab, setActiveTab] = useState<"typescript" | "python">(
    "typescript",
  );
  const [configName, setConfigName] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [savedConfigs, setSavedConfigs] = useState<TechStackConfig[]>([]);
  const [loadingConfigs, setLoadingConfigs] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      // Fetch saved configs when modal opens
      fetchSavedConfigs();
    }
  }, [isOpen]);

  const fetchSavedConfigs = async () => {
    try {
      setLoadingConfigs(true);
      const configs = await getTechStackConfigs();
      setSavedConfigs(configs);
    } catch (error) {
      console.error("Failed to fetch saved configurations:", error);
    } finally {
      setLoadingConfigs(false);
    }
  };

  const toggleOption = (option: TechOption) => {
    if (selectedOptions.some((item) => item.id === option.id)) {
      setSelectedOptions(
        selectedOptions.filter((item) => item.id !== option.id),
      );
    } else {
      setSelectedOptions([...selectedOptions, option]);
    }
  };

  const handleSaveConfig = async () => {
    if (!configName.trim() || selectedOptions.length === 0) return;

    try {
      setIsSaving(true);
      await saveTechStackConfig({
        name: configName.trim(),
        options: selectedOptions,
      });

      // Refresh saved configs
      await fetchSavedConfigs();
      setConfigName("");
    } catch (error) {
      console.error("Failed to save configuration:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadConfig = (config: TechStackConfig) => {
    setSelectedOptions(config.options);
  };

  const handleDeleteConfig = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteTechStackConfig(id);
      // Refresh saved configs
      await fetchSavedConfigs();
    } catch (error) {
      console.error("Failed to delete configuration:", error);
    }
  };

  const handleSubmit = () => {
    onSubmit(selectedOptions);
    onClose();
  };

  const filteredOptions = (category: string, language: string) => {
    return techOptions.filter(
      (option) =>
        option.category === category &&
        (option.language === language || option.language === "Both"),
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Select Tech Stack</DialogTitle>
          <DialogDescription>
            Choose the technologies you want to use for your project.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          defaultValue="typescript"
          value={activeTab}
          onValueChange={(value) =>
            setActiveTab(value as "typescript" | "python")
          }
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="typescript">TypeScript</TabsTrigger>
            <TabsTrigger value="python">Python</TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[400px] pr-4">
            {["typescript", "python"].map((language) => (
              <TabsContent
                key={language}
                value={language}
                className="space-y-6 mt-4"
              >
                {["Frontend", "Backend", "DevOps", "Deployment"].map(
                  (category) => (
                    <div key={`${language}-${category}`}>
                      <h3 className="text-sm font-medium mb-2">{category}</h3>
                      <div className="flex flex-wrap gap-2">
                        {filteredOptions(
                          category,
                          language === "typescript" ? "TypeScript" : "Python",
                        ).map((option) => (
                          <Button
                            key={option.id}
                            variant={
                              selectedOptions.some(
                                (item) => item.id === option.id,
                              )
                                ? "default"
                                : "outline"
                            }
                            size="sm"
                            onClick={() => toggleOption(option)}
                            className={cn(
                              selectedOptions.some(
                                (item) => item.id === option.id,
                              )
                                ? "bg-primary text-primary-foreground"
                                : "bg-background",
                            )}
                          >
                            {option.name}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ),
                )}
              </TabsContent>
            ))}
          </ScrollArea>
        </Tabs>

        <div className="mt-4">
          <h3 className="text-sm font-medium mb-2">
            Selected Technologies ({selectedOptions.length})
          </h3>
          <div className="flex flex-wrap gap-1">
            {selectedOptions.map((option) => (
              <Badge
                key={option.id}
                variant="secondary"
                className="cursor-pointer"
                onClick={() => toggleOption(option)}
              >
                {option.name} ✕
              </Badge>
            ))}
            {selectedOptions.length === 0 && (
              <span className="text-sm text-muted-foreground">
                No technologies selected
              </span>
            )}
          </div>
        </div>

        <div className="mt-6 border-t pt-4">
          <div className="flex items-end gap-2 mb-4">
            <div className="flex-1">
              <Label htmlFor="config-name" className="mb-2 block">
                Configuration Name
              </Label>
              <Input
                id="config-name"
                value={configName}
                onChange={(e) => setConfigName(e.target.value)}
                placeholder="My Tech Stack"
              />
            </div>
            <Button
              onClick={handleSaveConfig}
              disabled={
                !configName.trim() || selectedOptions.length === 0 || isSaving
              }
              size="sm"
            >
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>

          <div className="mb-4">
            <Label className="mb-2 block">Saved Configurations</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  disabled={loadingConfigs || savedConfigs.length === 0}
                >
                  {loadingConfigs
                    ? "Loading..."
                    : savedConfigs.length === 0
                      ? "No saved configurations"
                      : "Load Configuration"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[300px]">
                <DropdownMenuLabel>Saved Configurations</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {savedConfigs.map((config) => (
                  <DropdownMenuItem
                    key={config.id}
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => handleLoadConfig(config)}
                  >
                    <span>
                      {config.name} ({config.options.length} items)
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={(e) =>
                        config.id && handleDeleteConfig(config.id, e)
                      }
                    >
                      ✕
                    </Button>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={selectedOptions.length === 0}
          >
            Confirm Selection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
