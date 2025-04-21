import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { generateMockResponse, shouldUseMockResponse } from '../fallback';
import { z } from 'zod';
import {
  AnthropicRequestSchema,
  AnthropicResponseSchema,
  MetricsSchema
} from '@/lib/zod-schemas';
import { extractCodeFilesFromDocument, storeCodeFileWithEmbedding } from '@/lib/codefile-service';
import { type CodeFile } from '@/lib/supabase-client';
import { captureException } from '@/lib/error-reporting';
import { updateDocumentCodeFiles } from '@/lib/document-service';
import crypto from 'crypto';
import {
  calculateExecutionTime,
  estimateComplexity,
  estimateMemoryUsage,
  countCodeLines,
  calculateCodeQuality,
  calculateConvergenceScore,
  generateTitleFromContent
} from "@/lib/metrics-utils";

// Type for validated request
type ValidatedRequest = z.infer<typeof AnthropicRequestSchema>;

// Function to get Anthropic client with error checking
function getAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey || apiKey === 'your_anthropic_api_key_here') {
    throw new Error('Missing or invalid ANTHROPIC_API_KEY in environment variables');
  }
  
  return new Anthropic({ apiKey });
}

// Function to extract and store code files from a response
async function extractAndStoreCodeFiles(
  documentId: string, 
  content: string, 
  metadata: Record<string, any>
): Promise<CodeFile[]> {
  try {
    // Extract code files from response content
    const codeFiles = await extractCodeFilesFromDocument(documentId, content, metadata);
    
    if (codeFiles.length === 0) {
      console.log('No code files found in Anthropic response');
      return [];
    }
    
    console.log(`Found ${codeFiles.length} code files in Anthropic response`);
    
    // Store each code file
    const runId = metadata.runId || null;
    const stepNumber = metadata.stepNumber || null;
    const batchId = metadata.batchId || null;
    
    const storedCodeFiles: CodeFile[] = [];
    
    for (const codeFile of codeFiles) {
      try {
        // Store code file with embedding
        const id = await storeCodeFileWithEmbedding(
          codeFile,
          documentId,
          batchId,
          runId,
          stepNumber,
          metadata
        );
        
        if (id) {
          console.log(`Stored code file ${codeFile.filename} with ID ${id}`);
          storedCodeFiles.push(codeFile);
        } else {
          console.error(`Failed to store code file ${codeFile.filename}`);
        }
      } catch (error) {
        console.error(`Error storing code file ${codeFile.filename}:`, error);
        captureException(error, { 
          context: 'anthropic_codefile_storage',
          filename: codeFile.filename
        });
      }
    }
    
    return storedCodeFiles;
  } catch (error) {
    console.error('Error extracting and storing code files:', error);
    captureException(error, { context: 'anthropic_codefile_extraction' });
    return [];
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Validate request data using Zod
    const validationResult = AnthropicRequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      console.error('Invalid request data:', validationResult.error.format());
      return NextResponse.json(
        { 
          error: 'Invalid request data', 
          details: validationResult.error.format() 
        }, 
        { status: 400 }
      );
    }
    
    // Extract validated data
    const { prompt, model, temperature } = validationResult.data;
    
    // Check if we should use mock response
    if (shouldUseMockResponse('anthropic')) {
      console.log('Using mock response for Anthropic API (API key not set)');
      const mockResult = generateMockResponse(prompt, model || 'claude-3-sonnet-20240229');
      return NextResponse.json(mockResult);
    }
    
    // Continue with real API call

    // Initialize the client
    const anthropic = getAnthropicClient();
    
    // Validate the model name and use fallback if necessary
    let modelToUse = model || 'claude-3-sonnet-20240229';
    
    // Handle new model names and ensure compatibility
    if (modelToUse === 'claude-3-5-sonnet') {
      // Use the actual API model name
      modelToUse = 'claude-3-5-sonnet-20240620';
    } else if (modelToUse.includes('Claude-Sonnet-7')) {
      // Map user-friendly model name to API model name
      modelToUse = 'claude-3-5-sonnet-20240620';
    } else if (modelToUse.includes('Claude-Sonnet-5')) {
      // Map user-friendly model name to API model name
      modelToUse = 'claude-3-sonnet-20240229';
    }
    
    console.log(`Using Anthropic model: ${modelToUse}`);
    
    // Add system message to prevent placeholder code and ensure proper file structure
    const systemMessage = `You are a helpful assistant that creates meaningful code solutions for programming problems.
CRITICAL: NEVER use placeholder code like "Sample code generated for placeholder document" or "This file was auto-generated...".
If you provide code examples, always give REAL code with actual implementation details, not just comments or placeholders.
If you can't generate fully implemented code for a specific case, provide a minimal working example that demonstrates the core concept.

When creating code solutions that span multiple files:
1. Consider the overall project structure and maintain a consistent file organization
2. Use appropriate directory hierarchy (e.g., src/components/, src/utils/) that follows best practices
3. Ensure correct relative import paths between files that would work in a real project
4. Use consistent naming conventions for files and directories
5. Include necessary configuration files and project structure files for new projects
6. When modifying existing code, maintain all relevant imports and dependencies
7. Consider the specified tech stack and ensure your file structure matches common patterns for that stack
8. Build files in later steps that properly reference and build upon files from earlier steps`;

    // Get a message from Anthropic Claude
    const message = await anthropic.messages.create({
      model: modelToUse,
      max_tokens: 1024,
      temperature: temperature || 0.7,
      system: systemMessage,
      messages: [{ role: 'user', content: prompt }],
    });

    // Extract the response content
    const content = message.content[0].type === 'text' ? message.content[0].text : '';
    
    // Calculate metrics with proper structure matching MetricsSchema
    const metrics = {
      executionTime: calculateExecutionTime(content),
      complexity: estimateComplexity(content),
      memoryUsage: estimateMemoryUsage(content),
      lineCount: countCodeLines(content),
      codeQuality: calculateCodeQuality(content),
      convergenceScore: calculateConvergenceScore(modelToUse, content)
    };

    // Process the content to extract a title and description
    // Look for a specific title format (AI will be instructed to provide a clear title)
    const titleMatch = content.match(/^(.+?)(?:\n|$)/);
    const title = titleMatch ? titleMatch[1].substring(0, 50).trim() : 'Cognitive Approach';
    
    // Get a substantial description that shows the thinking process
    // Extract more content for the description to show reasoning (up to 500 chars)
    const descriptionText = content.replace(title, '').trim();
    const description = descriptionText.substring(0, 500).trim();
    
    // Generate a proper UUID for this response
    const documentId = crypto.randomUUID();

    // Create metadata for the document
    const metadata: Record<string, any> = {
      title: generateTitleFromContent(content) || "Strategic Implementation",
      executionTime: calculateExecutionTime(content),
      complexity: estimateComplexity(content),
      memoryUsage: estimateMemoryUsage(content),
      codeLines: countCodeLines(content),
      codeQuality: calculateCodeQuality(content),
      convergenceScore: calculateConvergenceScore("claude-3", content),
      model: modelToUse,
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: body.userId,
      documentId,
      projectId: body.projectId,
    };

    // Extract and store code files from the response
    console.log(`Extracting code files from Anthropic response with document ID: ${documentId}`);
    const codeFiles = await extractAndStoreCodeFiles(documentId, content, metadata);
    console.log(`Extracted and stored ${codeFiles.length} code files for Anthropic response`);
    
    // Update document metadata with code files
    if (codeFiles.length > 0) {
      console.log(`Updating document metadata with ${codeFiles.length} code files`);
      try {
        // Ensure all code files have a non-undefined language property
        const sanitizedCodeFiles = codeFiles.map(file => ({
          ...file,
          language: file.language || 'text' // Default to 'text' if language is undefined
        }));
        await updateDocumentCodeFiles(documentId, sanitizedCodeFiles);
        console.log("Successfully updated document metadata with code files");
      } catch (error) {
        console.error("Error updating document metadata with code files:", error);
      }
    }

    // Prepare the final response
    const response = {
      title,
      description,
      fullContent: content,
      metrics,
      model: modelToUse,
      codeFiles: codeFiles.length > 0 ? codeFiles : undefined
    };
    
    // Validate response data using Zod
    const responseValidation = AnthropicResponseSchema.safeParse(response);
    if (!responseValidation.success) {
      console.warn('Response data failed Zod validation:', responseValidation.error.format());
      // Try to fix the response data to match the schema
      const fixedResponse = {
        title: title || "Anthropic Response",
        description: description || "Generated content from Anthropic API",
        fullContent: content || "",
        metrics: MetricsSchema.parse(metrics), // Ensure metrics match the schema
        model: modelToUse || "claude-3-sonnet-20240229",
        codeFiles: codeFiles.length > 0 ? codeFiles : undefined
      };
      
      // Return the fixed response
      return NextResponse.json(fixedResponse);
    }

    // If validation passed, return the validated data
    return NextResponse.json(responseValidation.data);
  } catch (error) {
    console.error('Anthropic API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate response from Anthropic' },
      { status: 500 }
    );
  }
}
