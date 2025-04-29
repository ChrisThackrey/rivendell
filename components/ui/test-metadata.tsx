"use client";

import React, { useState } from 'react';
import { CodeBlockCode } from '@/components/ui/code-block';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

export function TestMetadata() {
  const [code, setCode] = useState("console.log('Hello world');");
  const [language, setLanguage] = useState("javascript");
  const [showMetadata, setShowMetadata] = useState(true);
  const [metadata, setMetadata] = useState({
    model: "gpt-4o",
    runId: "123",
    stepInfo: { runId: "123", stepNumber: 2 },
    cacheKey: "step_123_2",
    fetchSource: "API step search",
    description: "Sample code for testing metadata display"
  });
  
  const [showChangesHighlight, setShowChangesHighlight] = useState(false);
  const [changesHighlight, setChangesHighlight] = useState({
    isNewFile: false,
    linesAdded: 5,
    linesRemoved: 2,
    linesChanged: 3,
    changePercentage: 25,
    summary: "Modified file"
  });

  const handleMetadataChange = (field: string, value: any) => {
    setMetadata(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleStepInfoChange = (field: string, value: any) => {
    setMetadata(prev => ({
      ...prev,
      stepInfo: {
        ...prev.stepInfo,
        [field]: value
      }
    }));
  };

  const handleChangesHighlightChange = (field: string, value: any) => {
    setChangesHighlight(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Code Block Metadata Test</CardTitle>
          <CardDescription>
            Configure the code and metadata to test how it appears in the CodeBlock component
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="code" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="code">Code</TabsTrigger>
              <TabsTrigger value="metadata">Metadata</TabsTrigger>
              <TabsTrigger value="changes">Changes Highlight</TabsTrigger>
              <TabsTrigger value="display">Display Options</TabsTrigger>
            </TabsList>
            
            <TabsContent value="code" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="language">Language</Label>
                <Select 
                  value={language} 
                  onValueChange={setLanguage}
                >
                  <SelectTrigger id="language">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="javascript">JavaScript</SelectItem>
                    <SelectItem value="typescript">TypeScript</SelectItem>
                    <SelectItem value="tsx">TSX</SelectItem>
                    <SelectItem value="jsx">JSX</SelectItem>
                    <SelectItem value="html">HTML</SelectItem>
                    <SelectItem value="css">CSS</SelectItem>
                    <SelectItem value="python">Python</SelectItem>
                    <SelectItem value="go">Go</SelectItem>
                    <SelectItem value="java">Java</SelectItem>
                    <SelectItem value="rust">Rust</SelectItem>
                    <SelectItem value="sql">SQL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="code">Code</Label>
                <Textarea
                  id="code"
                  className="h-48 font-mono"
                  placeholder="Enter code here..."
                  value={code}
                  onChange={e => setCode(e.target.value)}
                />
              </div>
            </TabsContent>
            
            <TabsContent value="metadata" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="model">Model</Label>
                  <Input
                    id="model"
                    value={metadata.model as string}
                    onChange={e => handleMetadataChange('model', e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="runId">Run ID</Label>
                  <Input
                    id="runId"
                    value={metadata.runId as string}
                    onChange={e => handleMetadataChange('runId', e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="stepNumberId">Step Number</Label>
                  <Input
                    id="stepNumberId"
                    type="number"
                    value={metadata.stepInfo.stepNumber as number}
                    onChange={e => handleStepInfoChange('stepNumber', parseInt(e.target.value) || 0)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="stepRunId">Step Run ID</Label>
                  <Input
                    id="stepRunId"
                    value={metadata.stepInfo.runId as string}
                    onChange={e => handleStepInfoChange('runId', e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="cacheKey">Cache Key</Label>
                  <Input
                    id="cacheKey"
                    value={metadata.cacheKey as string}
                    onChange={e => handleMetadataChange('cacheKey', e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="fetchSource">Fetch Source</Label>
                  <Input
                    id="fetchSource"
                    value={metadata.fetchSource as string}
                    onChange={e => handleMetadataChange('fetchSource', e.target.value)}
                  />
                </div>
                
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={metadata.description as string}
                    onChange={e => handleMetadataChange('description', e.target.value)}
                  />
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="changes" className="space-y-4">
              <div className="flex items-center space-x-2 mb-4">
                <Switch
                  id="show-changes"
                  checked={showChangesHighlight}
                  onCheckedChange={setShowChangesHighlight}
                />
                <Label htmlFor="show-changes">Show Changes Highlight</Label>
              </div>
              
              {showChangesHighlight && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="isNewFile">Is New File</Label>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="isNewFile"
                        checked={changesHighlight.isNewFile}
                        onCheckedChange={value => handleChangesHighlightChange('isNewFile', value)}
                      />
                      <span className="text-sm text-muted-foreground">
                        {changesHighlight.isNewFile ? "Yes" : "No"}
                      </span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="changePercentage">Change Percentage</Label>
                    <Input
                      id="changePercentage"
                      type="number"
                      min="0"
                      max="100"
                      value={changesHighlight.changePercentage}
                      onChange={e => handleChangesHighlightChange('changePercentage', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="linesAdded">Lines Added</Label>
                    <Input
                      id="linesAdded"
                      type="number"
                      min="0"
                      value={changesHighlight.linesAdded}
                      onChange={e => handleChangesHighlightChange('linesAdded', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="linesRemoved">Lines Removed</Label>
                    <Input
                      id="linesRemoved"
                      type="number"
                      min="0"
                      value={changesHighlight.linesRemoved}
                      onChange={e => handleChangesHighlightChange('linesRemoved', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="linesChanged">Lines Changed</Label>
                    <Input
                      id="linesChanged"
                      type="number"
                      min="0"
                      value={changesHighlight.linesChanged}
                      onChange={e => handleChangesHighlightChange('linesChanged', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="summary">Summary</Label>
                    <Input
                      id="summary"
                      value={changesHighlight.summary}
                      onChange={e => handleChangesHighlightChange('summary', e.target.value)}
                    />
                  </div>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="display" className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="show-metadata"
                  checked={showMetadata}
                  onCheckedChange={setShowMetadata}
                />
                <Label htmlFor="show-metadata">Show Metadata</Label>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>
            This is how your code block will appear with the current settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CodeBlockCode
            code={code}
            language={language}
            showMetadata={showMetadata}
            metadata={showMetadata ? metadata : undefined}
            changesHighlight={showChangesHighlight ? changesHighlight : undefined}
          />
        </CardContent>
      </Card>
    </div>
  );
} 