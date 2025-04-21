import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "../../../lib/supabase-client";
import { storeCodeFileWithEmbedding } from "../../../lib/codefile-service";
import { captureException } from "../../../lib/error-reporting";
import {
  ensureDocumentExists,
  updateDocumentCodeFiles,
} from "../../../lib/document-service";

// Schema for validating the request
const CreateSampleCodeSchema = z.object({
  documentId: z.string().min(1),
  stepId: z.string().optional(),
  sampleType: z
    .enum(["job-analyzer", "text-classifier", "api-wrapper", "data-processor"])
    .default("job-analyzer"),
});

// Generate sample code based on document ID and type
function generateSampleCode(
  documentId: string,
  sampleType: string,
): Array<{ filename: string; language: string; code: string }> {
  // Get a consistent hash-based number from the document ID for predictable "randomness"
  const hashCode = Array.from(documentId).reduce(
    (hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0,
    0,
  );
  const absHash = Math.abs(hashCode);

  switch (sampleType) {
    case "job-analyzer":
      return [
        {
          filename: "JobAnalyzer.tsx",
          language: "typescript",
          code: `import { useState } from 'react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

// Types for our component
interface Keyword {
  text: string;
  relevance: number;
}

export default function JobAnalyzer() {
  const [jobDescription, setJobDescription] = useState('');
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Function to analyze the job description
  const analyzeJobDescription = async () => {
    if (!jobDescription.trim()) return;

    setIsAnalyzing(true);

    try {
      // In a real app, this would call an API
      const response = await fetch('/api/analyze-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: jobDescription })
      });

      if (!response.ok) throw new Error('Failed to analyze job description');

      const data = await response.json();
      setKeywords(data.keywords);
    } catch (error) {
      console.error('Error analyzing job description:', error);
      // In production, you would want to show an error message to the user
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>Job Description Analyzer</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Paste Job Description
              </label>
              <Textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the job description here..."
                className="min-h-[200px]"
              />
            </div>

            <Button
              onClick={analyzeJobDescription}
              disabled={isAnalyzing || !jobDescription.trim()}
              className="w-full"
            >
              {isAnalyzing ? 'Analyzing...' : 'Extract Keywords'}
            </Button>

            {keywords.length > 0 && (
              <div className="mt-6">
                <h3 className="font-medium text-lg mb-2">Relevant Keywords</h3>
                <div className="flex flex-wrap gap-2">
                  {keywords.map((keyword, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                      style={{ opacity: 0.5 + keyword.relevance * 0.5 }}
                    >
                      {keyword.text}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}`,
        },
        {
          filename: "analyze-job.ts",
          language: "typescript",
          code: `import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Schema for validating request
const RequestSchema = z.object({
  text: z.string().min(1)
});

// Simple keyword extraction function
function extractKeywords(text: string) {
  // In a real implementation, you would use NLP techniques,
  // but for this example we'll use a simple approach

  // Common technical skills to look for
  const techSkills = [
    'javascript', 'typescript', 'react', 'node', 'express', 'next.js',
    'css', 'html', 'tailwind', 'aws', 'docker', 'kubernetes', 'python',
    'java', 'c#', 'sql', 'nosql', 'mongodb', 'postgresql', 'graphql',
    'rest', 'api', 'microservices', 'ci/cd', 'git', 'agile', 'scrum'
  ];

  // Common soft skills to look for
  const softSkills = [
    'communication', 'teamwork', 'problem-solving', 'leadership',
    'time management', 'adaptability', 'creativity', 'critical thinking',
    'collaboration', 'attention to detail', 'organization', 'flexibility'
  ];

  const textLower = text.toLowerCase();
  const keywords = [];

  // Check for tech skills
  for (const skill of techSkills) {
    if (textLower.includes(skill.toLowerCase())) {
      // Calculate a simple relevance score based on frequency and position
      const count = (textLower.match(new RegExp(skill.toLowerCase(), 'g')) || []).length;
      const position = textLower.indexOf(skill.toLowerCase()) / textLower.length;
      const relevance = Math.min(0.5 + (count * 0.1) + (1 - position) * 0.4, 1);

      keywords.push({
        text: skill,
        relevance: parseFloat(relevance.toFixed(2))
      });
    }
  }

  // Check for soft skills
  for (const skill of softSkills) {
    if (textLower.includes(skill.toLowerCase())) {
      const count = (textLower.match(new RegExp(skill.toLowerCase(), 'g')) || []).length;
      const position = textLower.indexOf(skill.toLowerCase()) / textLower.length;
      const relevance = Math.min(0.4 + (count * 0.1) + (1 - position) * 0.3, 0.9); // Lower priority than tech skills

      keywords.push({
        text: skill,
        relevance: parseFloat(relevance.toFixed(2))
      });
    }
  }

  // Sort by relevance
  return keywords.sort((a, b) => b.relevance - a.relevance);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text } = RequestSchema.parse(body);

    const keywords = extractKeywords(text);

    return NextResponse.json({
      keywords,
      count: keywords.length
    });
  } catch (error) {
    console.error('Error analyzing job description:', error);
    return NextResponse.json(
      { error: 'Failed to analyze job description' },
      { status: 400 }
    );
  }
}`,
        },
      ];

    case "text-classifier":
      return [
        {
          filename: "TextClassifier.ts",
          language: "typescript",
          code: `import * as fs from 'fs';
import * as path from 'path';

/**
 * Simple text classifier using TF-IDF and cosine similarity
 */
export class TextClassifier {
  private categories: Map<string, string[]> = new Map();
  private documents: string[] = [];
  private categoryNames: string[] = [];
  private vocabulary: Set<string> = new Set();
  private tfidf: Map<string, number[]> = new Map();

  /**
   * Add a training document to a category
   */
  public addDocument(text: string, category: string): void {
    // Normalize and tokenize the text
    const tokens = this.tokenize(text);

    // Add tokens to vocabulary
    tokens.forEach(token => this.vocabulary.add(token));

    // Add document to our collection
    this.documents.push(text);

    // Add to category
    if (!this.categories.has(category)) {
      this.categories.set(category, []);
      this.categoryNames.push(category);
    }

    this.categories.get(category)!.push(text);
  }

  /**
   * Load training data from files in a directory structure
   * Each subdirectory is a category, containing text files
   */
  public loadFromDirectory(directoryPath: string): void {
    const categories = fs.readdirSync(directoryPath);

    for (const category of categories) {
      const categoryPath = path.join(directoryPath, category);

      // Skip if not a directory
      if (!fs.statSync(categoryPath).isDirectory()) continue;

      const files = fs.readdirSync(categoryPath);

      for (const file of files) {
        const filePath = path.join(categoryPath, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        this.addDocument(content, category);
      }
    }

    console.log(\`Loaded \${this.documents.length} documents across \${this.categories.size} categories\`);
  }

  /**
   * Train the classifier model
   */
  public train(): void {
    // We'll use TF-IDF (Term Frequency-Inverse Document Frequency)
    // to create feature vectors for each document
    const totalDocs = this.documents.length;

    // Calculate document frequency for each term
    const df = new Map<string, number>();

    for (const doc of this.documents) {
      const tokens = new Set(this.tokenize(doc)); // Unique tokens in this doc
      for (const token of tokens) {
        df.set(token, (df.get(token) || 0) + 1);
      }
    }

    // Calculate TF-IDF for each term in each document
    this.documents.forEach((doc, docIndex) => {
      const tokens = this.tokenize(doc);
      const termFreq = new Map<string, number>();

      // Count term frequencies in this document
      for (const token of tokens) {
        termFreq.set(token, (termFreq.get(token) || 0) + 1);
      }

      // Calculate TF-IDF for each term
      for (const token of this.vocabulary) {
        const tf = (termFreq.get(token) || 0) / tokens.length;
        const idf = Math.log(totalDocs / (df.get(token) || 1));
        const tfidfValue = tf * idf;

        if (!this.tfidf.has(token)) {
          this.tfidf.set(token, Array(totalDocs).fill(0));
        }

        this.tfidf.get(token)![docIndex] = tfidfValue;
      }
    });

    console.log('Classifier trained successfully');
  }

  /**
   * Classify a text document
   */
  public classify(text: string): { category: string, confidence: number } {
    // Get tokens from text
    const tokens = this.tokenize(text);

    // Create a vector for this document
    const vector: number[] = [];

    // Calculate cosine similarity with each category
    const similarities = this.categoryNames.map(category => {
      const categoryDocIndices: number[] = [];

      // Get document indices for this category
      this.documents.forEach((doc, index) => {
        if (this.categories.get(category)!.includes(doc)) {
          categoryDocIndices.push(index);
        }
      });

      // Calculate average similarity to documents in this category
      let totalSimilarity = 0;

      for (const docIndex of categoryDocIndices) {
        // Create vector for the comparison document
        const docVector: number[] = [];

        for (const token of this.vocabulary) {
          docVector.push(this.tfidf.get(token)![docIndex]);
        }

        // Create vector for the input text
        const textVector: number[] = [];

        for (const token of this.vocabulary) {
          const hasToken = tokens.includes(token);
          textVector.push(hasToken ? 1 : 0); // Simple presence/absence
        }

        // Calculate cosine similarity
        totalSimilarity += this.cosineSimilarity(textVector, docVector);
      }

      const avgSimilarity = categoryDocIndices.length > 0
        ? totalSimilarity / categoryDocIndices.length
        : 0;

      return { category, similarity: avgSimilarity };
    });

    // Find category with highest similarity
    similarities.sort((a, b) => b.similarity - a.similarity);
    const bestMatch = similarities[0];

    return {
      category: bestMatch.category,
      confidence: bestMatch.similarity
    };
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(vectorA: number[], vectorB: number[]): number {
    if (vectorA.length !== vectorB.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < vectorA.length; i++) {
      dotProduct += vectorA[i] * vectorB[i];
      magnitudeA += vectorA[i] * vectorA[i];
      magnitudeB += vectorB[i] * vectorB[i];
    }

    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0;
    }

    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Tokenize text into words
   */
  private tokenize(text: string): string[] {
    // Convert to lowercase, replace anything that's not alphanumeric with a space
    const normalized = text.toLowerCase().replace(/[^a-z0-9]+/g, ' ');
    // Split by whitespace
    const tokens = normalized.split(/\\s+/).filter(token => token.length > 2);

    // Filter common stop words
    return tokens.filter(token => !this.stopWords.has(token));
  }

  // Common English stop words
  private stopWords: Set<string> = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'else', 'when',
    'at', 'from', 'by', 'for', 'with', 'about', 'against', 'between',
    'into', 'through', 'during', 'before', 'after', 'above', 'below',
    'to', 'of', 'in', 'on', 'off', 'over', 'under', 'again', 'further',
    'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how',
    'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other',
    'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
    'than', 'too', 'very', 'can', 'will', 'just', 'should', 'now'
  ]);
}`,
        },
      ];

    case "api-wrapper":
      return [
        {
          filename: "ApiClient.ts",
          language: "typescript",
          code: `import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

/**
 * Error class for API errors
 */
export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Base API client class
 */
export class ApiClient {
  private client: AxiosInstance;
  private baseUrl: string;

  /**
   * Create a new API client
   * @param baseUrl The base URL for API requests
   * @param config Additional Axios configuration
   */
  constructor(baseUrl: string, config: AxiosRequestConfig = {}) {
    this.baseUrl = baseUrl;

    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 10000, // 10 seconds
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      ...config
    });

    // Add request interceptors
    this.client.interceptors.request.use(
      (config) => {
        // Add auth headers or other common request modifications here
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Add response interceptors
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          const apiError = new ApiError(
            error.response.data.message || 'API Error',
            error.response.status,
            error.response.data
          );
          return Promise.reject(apiError);
        } else if (error.request) {
          // The request was made but no response was received
          return Promise.reject(new ApiError('No response from server', 0));
        } else {
          // Something happened in setting up the request that triggered an Error
          return Promise.reject(new ApiError(error.message, 0));
        }
      }
    );
  }

  /**
   * Make a GET request
   * @param url The URL path (will be appended to baseUrl)
   * @param params Query parameters
   * @param config Additional Axios config
   */
  public async get<T>(url: string, params: object = {}, config: AxiosRequestConfig = {}): Promise<T> {
    try {
      const response: AxiosResponse<T> = await this.client.get(url, {
        params,
        ...config
      });
      return response.data;
    } catch (error) {
      this.handleError(error);
      throw error; // This line will only be reached if handleError doesn't throw
    }
  }

  /**
   * Make a POST request
   * @param url The URL path (will be appended to baseUrl)
   * @param data Request body data
   * @param config Additional Axios config
   */
  public async post<T>(url: string, data: object = {}, config: AxiosRequestConfig = {}): Promise<T> {
    try {
      const response: AxiosResponse<T> = await this.client.post(url, data, config);
      return response.data;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Make a PUT request
   * @param url The URL path (will be appended to baseUrl)
   * @param data Request body data
   * @param config Additional Axios config
   */
  public async put<T>(url: string, data: object = {}, config: AxiosRequestConfig = {}): Promise<T> {
    try {
      const response: AxiosResponse<T> = await this.client.put(url, data, config);
      return response.data;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Make a DELETE request
   * @param url The URL path (will be appended to baseUrl)
   * @param config Additional Axios config
   */
  public async delete<T>(url: string, config: AxiosRequestConfig = {}): Promise<T> {
    try {
      const response: AxiosResponse<T> = await this.client.delete(url, config);
      return response.data;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Handle API errors
   * @param error The error to handle
   */
  private handleError(error: any): never {
    // Log the error (in a real app, you might use a proper logging service)
    console.error('API Error:', error);

    // You can add custom error handling logic here
    // For example, redirect to login on 401 errors

    throw error;
  }
}`,
        },
      ];

    case "data-processor":
      return [
        {
          filename: "DataProcessor.ts",
          language: "typescript",
          code: `/**
 * Utility class for processing and transforming data
 */
export class DataProcessor {
  /**
   * Transform an array of objects by selecting specific fields
   * @param data Array of objects to transform
   * @param fields Fields to include in the transformation
   */
  public static select<T, K extends keyof T>(data: T[], fields: K[]): Pick<T, K>[] {
    return data.map(item => {
      const result = {} as Pick<T, K>;
      fields.forEach(field => {
        result[field] = item[field];
      });
      return result;
    });
  }

  /**
   * Filter an array of objects based on a condition
   * @param data Array of objects to filter
   * @param predicate Function that returns true for items to keep
   */
  public static filter<T>(data: T[], predicate: (item: T) => boolean): T[] {
    return data.filter(predicate);
  }

  /**
   * Group an array of objects by a specific key
   * @param data Array of objects to group
   * @param key The key to group by
   */
  public static groupBy<T, K extends keyof T>(data: T[], key: K): Record<string, T[]> {
    return data.reduce((result, item) => {
      const groupKey = String(item[key]);
      if (!result[groupKey]) {
        result[groupKey] = [];
      }
      result[groupKey].push(item);
      return result;
    }, {} as Record<string, T[]>);
  }

  /**
   * Calculate summary statistics for a numeric field
   * @param data Array of objects
   * @param field The numeric field to analyze
   */
  public static summarize<T>(data: T[], field: keyof T): {
    count: number;
    sum: number;
    min: number;
    max: number;
    avg: number;
    median: number;
  } {
    if (data.length === 0) {
      return {
        count: 0,
        sum: 0,
        min: 0,
        max: 0,
        avg: 0,
        median: 0
      };
    }

    // Extract values and convert to numbers
    const values = data.map(item => Number(item[field])).filter(val => !isNaN(val));

    if (values.length === 0) {
      return {
        count: 0,
        sum: 0,
        min: 0,
        max: 0,
        avg: 0,
        median: 0
      };
    }

    // Sort values for min, max, and median
    values.sort((a, b) => a - b);

    const count = values.length;
    const sum = values.reduce((acc, val) => acc + val, 0);
    const min = values[0];
    const max = values[count - 1];
    const avg = sum / count;

    // Calculate median
    let median: number;
    if (count % 2 === 0) {
      // Even number of items
      median = (values[count / 2 - 1] + values[count / 2]) / 2;
    } else {
      // Odd number of items
      median = values[Math.floor(count / 2)];
    }

    return {
      count,
      sum,
      min,
      max,
      avg,
      median
    };
  }

  /**
   * Perform a join operation between two arrays of objects
   * @param left Left array to join
   * @param right Right array to join
   * @param leftKey Key from the left array
   * @param rightKey Key from the right array
   */
  public static join<T, U, K extends keyof T, J extends keyof U>(
    left: T[],
    right: U[],
    leftKey: K,
    rightKey: J
  ): Array<T & U> {
    const result: Array<T & U> = [];

    // Create a lookup map from the right array
    const rightMap = new Map<any, U>();
    for (const rightItem of right) {
      rightMap.set(rightItem[rightKey], rightItem);
    }

    // Perform the join
    for (const leftItem of left) {
      const leftValue = leftItem[leftKey];
      const rightItem = rightMap.get(leftValue);

      if (rightItem) {
        // Join the objects
        result.push({
          ...leftItem,
          ...rightItem
        } as T & U);
      }
    }

    return result;
  }

  /**
   * Sort an array of objects by a specific key
   * @param data Array to sort
   * @param key Key to sort by
   * @param direction Sort direction ('asc' or 'desc')
   */
  public static sort<T, K extends keyof T>(
    data: T[],
    key: K,
    direction: 'asc' | 'desc' = 'asc'
  ): T[] {
    const sortFactor = direction === 'asc' ? 1 : -1;

    return [...data].sort((a, b) => {
      const valueA = a[key];
      const valueB = b[key];

      if (typeof valueA === 'string' && typeof valueB === 'string') {
        return sortFactor * valueA.localeCompare(valueB);
      }

      if (valueA < valueB) return -1 * sortFactor;
      if (valueA > valueB) return 1 * sortFactor;
      return 0;
    });
  }

  /**
   * Transform data from an array of objects to CSV
   * @param data Array of objects
   * @param headers Optional custom headers
   */
  public static toCSV<T>(data: T[], headers?: string[]): string {
    if (data.length === 0) return '';

    // Determine headers
    const keys = Object.keys(data[0] || {});
    const csvHeaders = headers || keys;

    // Create the CSV header row
    let csv = csvHeaders.join(',') + '\\n';

    // Add each row of data
    for (const item of data) {
      const row = keys.map(key => {
        const value = item[key as keyof T];

        // Handle different value types
        if (value === null || value === undefined) {
          return '';
        } else if (typeof value === 'string') {
          // Escape quotes and wrap in quotes if needed
          const needsQuotes = value.includes(',') || value.includes('"') || value.includes('\\n');
          if (needsQuotes) {
            return \`"\${value.replace(/"/g, '""')}"\`;
          }
          return value;
        } else {
          return String(value);
        }
      });

      csv += row.join(',') + '\\n';
    }

    return csv;
  }
}`,
        },
      ];
  }

  // Default to job analyzer if the type isn't recognized
  return [
    {
      filename: "sample-code.ts",
      language: "typescript",
      code: `/**
 * Sample code file for document ${documentId}
 * This is a placeholder code file automatically generated.
 */
export function processSample() {
  console.log("Processing sample for document ${documentId}");
  return {
    success: true,
    documentId: "${documentId}",
    timestamp: new Date().toISOString()
  };
}`,
    },
  ];
}

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();

    // Log the request for debugging
    console.log("create-sample-code request:", {
      ...body,
      hasDocumentId: !!body.documentId,
      hasStepId: !!body.stepId,
    });

    // Validate with schema
    const validatedData = CreateSampleCodeSchema.parse(body);

    // If stepId is provided but documentId is not, use stepId as documentId
    const documentId = validatedData.documentId || validatedData.stepId;

    if (!documentId) {
      return NextResponse.json(
        { error: "Missing document ID or step ID" },
        { status: 400 },
      );
    }

    // Ensure the document exists first
    console.log(`Ensuring document exists: ${documentId}`);
    const validDocumentId = await ensureDocumentExists(documentId);

    if (!validDocumentId) {
      return NextResponse.json(
        { error: "Failed to ensure document exists" },
        { status: 500 },
      );
    }

    console.log(
      `Using document ID: ${validDocumentId} ${validDocumentId !== documentId ? `(converted from ${documentId})` : ""}`,
    );

    // Check if this document already has code files
    const { data: existingCodeFiles } = await supabase
      .from("codefiles")
      .select("id, filename")
      .eq("document_id", validDocumentId);

    if (existingCodeFiles && existingCodeFiles.length > 0) {
      console.log(
        `Document ${validDocumentId} already has ${existingCodeFiles.length} code files, using existing files`,
      );

      // Return information about existing code files
      return NextResponse.json({
        success: true,
        documentId,
        validDocumentId,
        totalCodeFiles: existingCodeFiles.length,
        existing: true,
        results: existingCodeFiles.map((file) => ({
          filename: file.filename,
          status: "existing",
          id: file.id,
        })),
      });
    }

    // Generate sample code files based on the sample type
    const generatedFiles = generateSampleCode(
      validDocumentId,
      validatedData.sampleType,
    );

    console.log(
      `Generated ${generatedFiles.length} sample code files for ${validDocumentId}`,
    );

    // Store each code file
    const results: Array<{
      filename: string;
      language?: string;
      codeLength?: number;
      status: "success" | "error" | "existing";
      id?: string;
      message?: string;
    }> = [];

    for (const codeFile of generatedFiles) {
      try {
        console.log(`Storing code file: ${codeFile.filename}`);

        const id = await storeCodeFileWithEmbedding(
          {
            filename: codeFile.filename,
            language: codeFile.language,
            code: codeFile.code,
          },
          validDocumentId,
          null, // batch_id
          null, // runId
          null, // stepNumber
          {
            source: "create-sample-code-api",
            sampleType: validatedData.sampleType,
            originalId: documentId !== validDocumentId ? documentId : undefined,
          },
        );

        if (id) {
          console.log(
            `Successfully stored sample code file ${codeFile.filename} with ID ${id}`,
          );
          results.push({
            filename: codeFile.filename,
            language: codeFile.language,
            codeLength: codeFile.code.length,
            status: "success",
            id,
          });
        } else {
          console.error(`Failed to store code file ${codeFile.filename}`);
          results.push({
            filename: codeFile.filename,
            status: "error",
            message: "Failed to insert code file",
          });
        }
      } catch (error) {
        console.error(`Error storing code file ${codeFile.filename}:`, error);
        results.push({
          filename: codeFile.filename,
          status: "error",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // Update document metadata with all code files for redundancy
    try {
      if (results.filter((r) => r.status === "success").length > 0) {
        const validFiles = generatedFiles.filter(
          (_, index) => results[index] && results[index].status === "success",
        );

        if (validFiles.length > 0) {
          console.log(
            `Updating document ${validDocumentId} metadata with ${validFiles.length} sample code files`,
          );
          await updateDocumentCodeFiles(validDocumentId, validFiles);
        }
      }
    } catch (error) {
      console.error(
        "Error updating document metadata with sample code files:",
        error,
      );
      // Non-critical error, don't fail the request
    }

    // Return the results
    return NextResponse.json({
      success: true,
      documentId,
      validDocumentId,
      totalCodeFiles: generatedFiles.length,
      results,
    });
  } catch (error) {
    console.error("Error in create-sample-code API:", error);
    captureException(error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
