"use client";

import { useState } from "react";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Switch } from "../../components/ui/switch";
import { Label } from "../../components/ui/label";
import { Input } from "../../components/ui/input";
import {
  Loader2,
  AlertCircle,
  Code,
  FileCode,
  Search,
  RefreshCw,
} from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs";

export default function CodeFixerPage() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [sampleType, setSampleType] = useState("job-analyzer");
  const [limit, setLimit] = useState(20);
  const [isDryRun, setIsDryRun] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // JSON Parsing fix state
  const [isFixingParsing, setIsFixingParsing] = useState(false);
  const [parsingResults, setParsingResults] = useState<any>(null);
  const [parsingLimit, setParsingLimit] = useState(10);
  const [parsingDryRun, setParsingDryRun] = useState(true);

  // List documents without code state
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [documentsWithoutCode, setDocumentsWithoutCode] = useState<any>(null);
  const [documentsLimit, setDocumentsLimit] = useState(20);
  const [skipPlaceholders, setSkipPlaceholders] = useState(true);
  const [batchId, setBatchId] = useState("");

  const handleAddSampleCode = async () => {
    setIsProcessing(true);
    setResults(null);
    setError(null);

    try {
      const response = await fetch("/api/batch-add-sample-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          limit,
          sampleType,
          dryRun: isDryRun,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to add sample code");
      }

      setResults(data);
    } catch (err: any) {
      console.error("Error adding sample code:", err);
      setError(err.message || "An error occurred");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFixJsonParsing = async () => {
    setIsFixingParsing(true);
    setParsingResults(null);
    setError(null);

    try {
      const response = await fetch("/api/fix-json-parsing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          limit: parsingLimit,
          dryRun: parsingDryRun,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fix JSON parsing errors");
      }

      setParsingResults(data);
    } catch (err: any) {
      console.error("Error fixing JSON parsing:", err);
      setError(err.message || "An error occurred");
    } finally {
      setIsFixingParsing(false);
    }
  };

  const handleListDocumentsWithoutCode = async () => {
    setIsLoadingDocuments(true);
    setDocumentsWithoutCode(null);
    setError(null);

    try {
      const response = await fetch("/api/list-documents-without-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          limit: documentsLimit,
          skipPlaceholders,
          batchId: batchId || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to list documents without code");
      }

      setDocumentsWithoutCode(data);
    } catch (err: any) {
      console.error("Error listing documents without code:", err);
      setError(err.message || "An error occurred");
    } finally {
      setIsLoadingDocuments(false);
    }
  };

  const handleFixDocumentWithoutCode = async (documentId: string) => {
    try {
      const response = await fetch("/api/fix-codefiles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          documentId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fix document");
      }

      // Update the document in the list to show it's been fixed
      if (documentsWithoutCode && documentsWithoutCode.documents) {
        const updatedDocuments = documentsWithoutCode.documents.map(
          (doc: any) => {
            if (doc.id === documentId) {
              return {
                ...doc,
                fixed: true,
                fixResult: data,
              };
            }
            return doc;
          },
        );

        setDocumentsWithoutCode({
          ...documentsWithoutCode,
          documents: updatedDocuments,
        });
      }

      return data;
    } catch (err: any) {
      console.error(`Error fixing document ${documentId}:`, err);
      throw err;
    }
  };

  // Add a new function to validate code files
  const handleValidateCodeFiles = async (documentId: string) => {
    try {
      setIsLoadingDocuments(true);
      setResults(`Validating code files for document ${documentId}...`);

      const response = await fetch("/api/validate-codefiles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          documentId,
          reprocessExisting: false, // Only process missing or invalid code files
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setResults(JSON.stringify(data, null, 2));
      } else {
        const error = await response.text();
        setResults(`Error validating code files: ${error}`);
      }
    } catch (error) {
      setResults(
        `Error: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setIsLoadingDocuments(false);
    }
  };

  // Add a new function to validate all documents without code
  const handleValidateAllDocuments = async () => {
    try {
      if (
        !documentsWithoutCode ||
        !documentsWithoutCode.documents ||
        documentsWithoutCode.documents.length === 0
      ) {
        setResults("No documents to validate.");
        return;
      }

      setIsLoadingDocuments(true);
      setResults(
        `Validating code files for ${documentsWithoutCode.documents.length} documents...`,
      );

      const results = [];
      let successCount = 0;
      let failureCount = 0;

      // Process documents in batches of 5 to avoid overwhelming the server
      for (let i = 0; i < documentsWithoutCode.documents.length; i += 5) {
        const batch = documentsWithoutCode.documents.slice(i, i + 5);

        const batchResults = await Promise.all(
          batch.map(
            async (doc: {
              id: string;
              contentSample: string;
              createdAt: string;
            }) => {
              try {
                const response = await fetch("/api/validate-codefiles", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    documentId: doc.id,
                    reprocessExisting: false,
                  }),
                });

                if (response.ok) {
                  const data = await response.json();
                  successCount++;
                  return {
                    documentId: doc.id,
                    status: "success",
                    result: data,
                  };
                } else {
                  const error = await response.text();
                  failureCount++;
                  return {
                    documentId: doc.id,
                    status: "error",
                    error,
                  };
                }
              } catch (error) {
                failureCount++;
                return {
                  documentId: doc.id,
                  status: "error",
                  error: error instanceof Error ? error.message : String(error),
                };
              }
            },
          ),
        );

        results.push(...batchResults);

        // Update results as we go
        setResults(`Processing documents ${i + 1} to ${Math.min(i + 5, documentsWithoutCode.documents.length)} of ${documentsWithoutCode.documents.length}...
Success: ${successCount}, Failures: ${failureCount}
${JSON.stringify(results, null, 2)}`);

        // Brief pause between batches
        if (i + 5 < documentsWithoutCode.documents.length) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      // Refresh the list after processing
      handleListDocumentsWithoutCode();

      setResults(`Finished processing ${documentsWithoutCode.documents.length} documents.
Success: ${successCount}, Failures: ${failureCount}
${JSON.stringify(results, null, 2)}`);
    } catch (error) {
      setResults(
        `Error validating all documents: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setIsLoadingDocuments(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Code Fixer Tool</h1>

      <Tabs defaultValue="add-sample">
        <TabsList className="mb-6">
          <TabsTrigger value="add-sample">Add Sample Code</TabsTrigger>
          <TabsTrigger value="fix-parsing">Fix JSON Parsing</TabsTrigger>
          <TabsTrigger value="list-documents">Find Missing Code</TabsTrigger>
        </TabsList>

        <TabsContent value="add-sample">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Add Sample Code to Documents</CardTitle>
              <CardDescription>
                This tool will find documents that need code files and add
                sample code to them.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-4">
                <Label htmlFor="sample-type" className="w-32">
                  Sample Type:
                </Label>
                <Select value={sampleType} onValueChange={setSampleType}>
                  <SelectTrigger id="sample-type" className="w-full">
                    <SelectValue placeholder="Select sample type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="job-analyzer">Job Analyzer</SelectItem>
                    <SelectItem value="text-classifier">
                      Text Classifier
                    </SelectItem>
                    <SelectItem value="api-wrapper">API Wrapper</SelectItem>
                    <SelectItem value="data-processor">
                      Data Processor
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-4">
                <Label htmlFor="limit" className="w-32">
                  Document Limit:
                </Label>
                <Input
                  id="limit"
                  type="number"
                  min={1}
                  max={100}
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                />
              </div>

              <div className="flex items-center space-x-4">
                <Label htmlFor="dry-run" className="w-32">
                  Dry Run:
                </Label>
                <div className="flex items-center">
                  <Switch
                    id="dry-run"
                    checked={isDryRun}
                    onCheckedChange={setIsDryRun}
                  />
                  <span className="ml-2 text-sm text-gray-600">
                    {isDryRun
                      ? "Preview only, no changes will be made"
                      : "Will make actual changes to documents"}
                  </span>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                onClick={handleAddSampleCode}
                disabled={isProcessing}
                className="w-full"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : isDryRun ? (
                  "Preview Documents"
                ) : (
                  "Add Sample Code"
                )}
              </Button>
            </CardFooter>
          </Card>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
              <strong>Error: </strong> {error}
            </div>
          )}

          {results && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {results.dryRun ? "Preview Results" : "Processing Results"}
                </CardTitle>
                {!results.dryRun && (
                  <CardDescription>
                    Successfully processed {results.successCount} of{" "}
                    {results.totalProcessed} documents
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                {results.dryRun ? (
                  <>
                    <h3 className="font-medium mb-2">
                      Documents that will be processed:
                    </h3>
                    {results.documentsToProcess?.length > 0 ? (
                      <ul className="list-disc pl-5 space-y-2">
                        {results.documentsToProcess.map(
                          (doc: any, i: number) => (
                            <li key={i} className="text-sm">
                              <div className="font-medium">ID: {doc.id}</div>
                              <div>Content: {doc.contentSample}</div>
                              <div>
                                Has metadata: {doc.hasMetadata ? "Yes" : "No"}
                              </div>
                              {doc.hasMetadata && (
                                <div>
                                  Metadata keys: {doc.metadataKeys.join(", ")}
                                </div>
                              )}
                            </li>
                          ),
                        )}
                      </ul>
                    ) : (
                      <p>No documents found that need code files.</p>
                    )}
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="bg-gray-100 p-3 rounded">
                        <span className="block text-sm text-gray-500">
                          Total Documents
                        </span>
                        <span className="text-2xl font-bold">
                          {results.totalProcessed}
                        </span>
                      </div>
                      <div className="bg-gray-100 p-3 rounded">
                        <span className="block text-sm text-gray-500">
                          Success Rate
                        </span>
                        <span className="text-2xl font-bold">
                          {(
                            (results.successCount / results.totalProcessed) *
                            100
                          ).toFixed(1)}
                          %
                        </span>
                      </div>
                    </div>

                    <h3 className="font-medium mb-2">Results by Document:</h3>
                    {results.results?.length > 0 ? (
                      <ul className="list-disc pl-5 space-y-2">
                        {results.results.map((result: any, i: number) => (
                          <li
                            key={i}
                            className={`text-sm ${result.status === "success" ? "text-green-700" : "text-red-700"}`}
                          >
                            <div className="font-medium">
                              ID: {result.documentId}
                            </div>
                            {result.status === "success" ? (
                              <div>Added {result.filesAdded} code files</div>
                            ) : (
                              <div>Error: {JSON.stringify(result.error)}</div>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>No results to display.</p>
                    )}
                  </>
                )}
              </CardContent>
              {results.dryRun && results.documentsToProcess?.length > 0 && (
                <CardFooter>
                  <Button
                    onClick={() => {
                      setIsDryRun(false);
                      setTimeout(handleAddSampleCode, 100);
                    }}
                    className="w-full"
                  >
                    Proceed with Adding Code Files to{" "}
                    {results.documentsToProcess.length} Documents
                  </Button>
                </CardFooter>
              )}
            </Card>
          )}
        </TabsContent>

        <TabsContent value="fix-parsing">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Fix JSON Parsing Errors</CardTitle>
              <CardDescription>
                This tool finds documents with JSON parsing errors that resulted
                in placeholder code files.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-amber-50 border-l-4 border-amber-400 p-4 mb-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <AlertCircle className="h-5 w-5 text-amber-400" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-amber-700">
                      This tool identifies documents where JSON parsing failed,
                      resulting in placeholder code files with content like:
                      <br />
                      <code className="bg-amber-100 px-1 py-0.5 rounded text-xs">
                        {`// Generated Step 5`}
                        <br />
                        {`// Automatically generated step due to JSON parsing error.`}
                      </code>
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <Label htmlFor="parsing-limit" className="w-32">
                  Document Limit:
                </Label>
                <Input
                  id="parsing-limit"
                  type="number"
                  min={1}
                  max={50}
                  value={parsingLimit}
                  onChange={(e) => setParsingLimit(Number(e.target.value))}
                />
              </div>

              <div className="flex items-center space-x-4">
                <Label htmlFor="parsing-dry-run" className="w-32">
                  Dry Run:
                </Label>
                <div className="flex items-center">
                  <Switch
                    id="parsing-dry-run"
                    checked={parsingDryRun}
                    onCheckedChange={setParsingDryRun}
                  />
                  <span className="ml-2 text-sm text-gray-600">
                    {parsingDryRun
                      ? "Preview only, no changes will be made"
                      : "Will remove placeholder files and try to fix documents"}
                  </span>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                onClick={handleFixJsonParsing}
                disabled={isFixingParsing}
                className="w-full"
              >
                {isFixingParsing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : parsingDryRun ? (
                  "Find Documents with Parsing Errors"
                ) : (
                  "Fix JSON Parsing Errors"
                )}
              </Button>
            </CardFooter>
          </Card>

          {parsingResults && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {parsingResults.dryRun
                    ? "Documents with Parsing Errors"
                    : "Parsing Error Fix Results"}
                </CardTitle>
                {!parsingResults.dryRun && (
                  <CardDescription>
                    Fixed {parsingResults.successCount} of{" "}
                    {parsingResults.documentsWithErrors} documents with parsing
                    errors
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                {parsingResults.dryRun ? (
                  <>
                    <h3 className="font-medium mb-2">
                      Documents with parsing errors:
                    </h3>
                    {parsingResults.documentsWithErrors > 0 ? (
                      <ul className="list-disc pl-5 space-y-2">
                        {parsingResults.documents.map((doc: any, i: number) => (
                          <li key={i} className="text-sm">
                            <div className="font-medium">ID: {doc.id}</div>
                            <div>Error type: {doc.errorType}</div>
                            <div>
                              Created at:{" "}
                              {new Date(doc.created_at).toLocaleString()}
                            </div>
                            <div>Content sample: {doc.contentSample}</div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>No documents found with JSON parsing errors.</p>
                    )}
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="bg-gray-100 p-3 rounded">
                        <span className="block text-sm text-gray-500">
                          Documents with Errors
                        </span>
                        <span className="text-2xl font-bold">
                          {parsingResults.documentsWithErrors}
                        </span>
                      </div>
                      <div className="bg-gray-100 p-3 rounded">
                        <span className="block text-sm text-gray-500">
                          Fix Success Rate
                        </span>
                        <span className="text-2xl font-bold">
                          {parsingResults.documentsWithErrors
                            ? (
                                (parsingResults.successCount /
                                  parsingResults.documentsWithErrors) *
                                100
                              ).toFixed(1)
                            : 0}
                          %
                        </span>
                      </div>
                    </div>

                    <h3 className="font-medium mb-2">Fix Results:</h3>
                    {parsingResults.results?.length > 0 ? (
                      <ul className="list-disc pl-5 space-y-2">
                        {parsingResults.results.map(
                          (result: any, i: number) => (
                            <li
                              key={i}
                              className={`text-sm ${result.fixed ? "text-green-700" : "text-red-700"}`}
                            >
                              <div className="font-medium">
                                ID: {result.documentId}
                              </div>
                              {result.fixed ? (
                                <div>
                                  <div>
                                    Removed {result.placeholdersRemoved}{" "}
                                    placeholders
                                  </div>
                                  <div>
                                    Added {result.filesAdded} new code files
                                  </div>
                                </div>
                              ) : (
                                <div>Error: {result.error}</div>
                              )}
                            </li>
                          ),
                        )}
                      </ul>
                    ) : (
                      <p>No results to display.</p>
                    )}
                  </>
                )}
              </CardContent>
              {parsingResults.dryRun &&
                parsingResults.documentsWithErrors > 0 && (
                  <CardFooter>
                    <Button
                      onClick={() => {
                        setParsingDryRun(false);
                        setTimeout(handleFixJsonParsing, 100);
                      }}
                      className="w-full"
                    >
                      Fix JSON Parsing in {parsingResults.documentsWithErrors}{" "}
                      Documents
                    </Button>
                  </CardFooter>
                )}
            </Card>
          )}
        </TabsContent>

        <TabsContent value="list-documents">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Find Documents Missing Code Files</CardTitle>
              <CardDescription>
                This tool lists documents that don&apos;t have any code files
                and allows you to fix them.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-4">
                <Label htmlFor="documents-limit" className="w-32">
                  Result Limit:
                </Label>
                <Input
                  id="documents-limit"
                  type="number"
                  min={1}
                  max={100}
                  value={documentsLimit}
                  onChange={(e) => setDocumentsLimit(Number(e.target.value))}
                />
              </div>

              <div className="flex items-center space-x-4">
                <Label htmlFor="batch-id" className="w-32">
                  Batch ID:
                </Label>
                <Input
                  id="batch-id"
                  type="text"
                  placeholder="Optional batch ID filter"
                  value={batchId}
                  onChange={(e) => setBatchId(e.target.value)}
                />
              </div>

              <div className="flex items-center space-x-4">
                <Label htmlFor="skip-placeholders" className="w-32">
                  Skip Placeholders:
                </Label>
                <div className="flex items-center">
                  <Switch
                    id="skip-placeholders"
                    checked={skipPlaceholders}
                    onCheckedChange={setSkipPlaceholders}
                  />
                  <span className="ml-2 text-sm text-gray-600">
                    {skipPlaceholders
                      ? "Exclude placeholder documents"
                      : "Include placeholder documents"}
                  </span>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                onClick={handleListDocumentsWithoutCode}
                disabled={isLoadingDocuments}
                className="w-full"
              >
                {isLoadingDocuments ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Find Documents Without Code
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
              <strong>Error: </strong> {error}
            </div>
          )}

          {documentsWithoutCode && (
            <Card>
              <CardHeader>
                <CardTitle>Documents Without Code Files</CardTitle>
                <CardDescription>
                  Found {documentsWithoutCode.totalDocuments} documents without
                  code files
                </CardDescription>
              </CardHeader>
              <CardContent>
                {documentsWithoutCode.totalDocuments > 0 ? (
                  <div className="space-y-4">
                    {documentsWithoutCode.documents.map(
                      (doc: any, i: number) => (
                        <Card
                          key={i}
                          className={`border ${doc.fixed ? "border-green-300 bg-green-50" : "border-gray-200"}`}
                        >
                          <CardHeader className="py-3">
                            <div className="flex justify-between items-center">
                              <CardTitle className="text-sm font-medium">
                                {doc.isPlaceholder ? (
                                  <span className="flex items-center">
                                    <AlertCircle className="h-4 w-4 mr-1 text-amber-500" />
                                    Placeholder Document
                                  </span>
                                ) : (
                                  <span className="flex items-center">
                                    <FileCode className="h-4 w-4 mr-1 text-blue-500" />
                                    Document
                                  </span>
                                )}
                              </CardTitle>
                              {doc.fixed ? (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  Fixed
                                </span>
                              ) : (
                                <div className="flex space-x-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={async () => {
                                      try {
                                        await handleFixDocumentWithoutCode(
                                          doc.id,
                                        );
                                      } catch (error) {
                                        setError((error as Error).message);
                                      }
                                    }}
                                    className="h-7 px-2"
                                  >
                                    <Code className="h-3 w-3 mr-1" />
                                    Fix
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      handleValidateCodeFiles(doc.id)
                                    }
                                    disabled={isLoadingDocuments}
                                  >
                                    Validate
                                  </Button>
                                </div>
                              )}
                            </div>
                          </CardHeader>
                          <CardContent className="py-2 text-xs space-y-1">
                            <div>
                              <span className="font-semibold">ID:</span>{" "}
                              {doc.id}
                            </div>
                            <div>
                              <span className="font-semibold">Created:</span>{" "}
                              {new Date(doc.createdAt).toLocaleString()}
                            </div>
                            {doc.batchId && (
                              <div>
                                <span className="font-semibold">Batch:</span>{" "}
                                {doc.batchId}
                              </div>
                            )}
                            <div>
                              <span className="font-semibold">Content:</span>{" "}
                              {doc.contentSample}
                            </div>
                            {doc.metadataKeys.length > 0 && (
                              <div>
                                <span className="font-semibold">Metadata:</span>{" "}
                                {doc.metadataKeys.join(", ")}
                              </div>
                            )}

                            {doc.fixed && doc.fixResult && (
                              <div className="mt-2 pt-2 border-t border-gray-200">
                                <div className="font-semibold text-green-700">
                                  Fix Result:
                                </div>
                                <div className="pl-2">
                                  <div>
                                    Added{" "}
                                    {doc.fixResult.totalCodeFiles ||
                                      doc.fixResult.codeFilesCount ||
                                      0}{" "}
                                    code files
                                  </div>
                                  {doc.fixResult.generatedSampleCode && (
                                    <div>
                                      Generated sample code for placeholder
                                      document
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ),
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-6 text-center">
                    <FileCode className="h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium">
                      No documents found without code files
                    </h3>
                    <p className="text-sm text-gray-500 mt-2 max-w-md">
                      All documents in the database have code files attached, or
                      no documents matched your filter criteria.
                    </p>
                  </div>
                )}
              </CardContent>
              {documentsWithoutCode.totalDocuments > 0 && (
                <CardFooter className="flex justify-between">
                  <Button
                    variant="outline"
                    onClick={handleListDocumentsWithoutCode}
                    className="flex items-center"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleValidateAllDocuments}
                      disabled={
                        isLoadingDocuments ||
                        documentsWithoutCode.documents.every(
                          (doc: any) => doc.fixed,
                        )
                      }
                      variant="secondary"
                    >
                      {isLoadingDocuments ? (
                        <>
                          <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                          Processing...
                        </>
                      ) : (
                        <>Validate All</>
                      )}
                    </Button>
                    <Button
                      onClick={async () => {
                        // Fix all documents in parallel
                        setIsLoadingDocuments(true);
                        try {
                          await Promise.all(
                            documentsWithoutCode.documents
                              .filter((doc: any) => !doc.fixed)
                              .map((doc: any) =>
                                handleFixDocumentWithoutCode(doc.id),
                              ),
                          );
                        } catch (err) {
                          setError("Error fixing multiple documents");
                        } finally {
                          setIsLoadingDocuments(false);
                        }
                      }}
                      disabled={
                        isLoadingDocuments ||
                        documentsWithoutCode.documents.every(
                          (doc: any) => doc.fixed,
                        )
                      }
                    >
                      Fix All Documents
                    </Button>
                  </div>
                </CardFooter>
              )}
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Display results from validation */}
      {results && typeof results === "string" && (
        <div className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Operation Results</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-gray-100 p-4 rounded text-xs overflow-auto max-h-[400px]">
                {results}
              </pre>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
