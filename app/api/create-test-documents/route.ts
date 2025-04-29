import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-client";
import { generateEmbedding } from "@/lib/embedding-service";

export async function POST() {
  try {
    // Generate test documents with embeddings
    const testDocs = [
      {
        content: "This is a test document for vector search with React code.",
        metadata: {
          model: "test-model",
          runtime: "10ms",
          cost: 0.001,
          runId: 1,
          temperature: 0.7,
          stepNumber: 1,
          level: 1,
          stepTitle: "Test Document 1",
          decision: "RECOMMENDED" as const,
          type: "accepted" as const,
          codeFiles: [
            {
              filename: "test.js",
              language: "javascript",
              code: "function test() { return 'hello'; }"
            }
          ]
        }
      },
      {
        content: "Another test document with TypeScript code examples.",
        metadata: {
          model: "test-model",
          runtime: "15ms",
          cost: 0.0015,
          runId: 2,
          temperature: 0.7,
          stepNumber: 2,
          level: 1,
          stepTitle: "Test Document 2",
          decision: "VIABLE" as const,
          type: "secondary" as const,
          codeFiles: [
            {
              filename: "sample.ts",
              language: "typescript",
              code: "interface Test { name: string; }"
            }
          ]
        }
      },
      {
        content: "A third document with Python code for data analysis.",
        metadata: {
          model: "test-model",
          runtime: "20ms",
          cost: 0.002,
          runId: 3,
          temperature: 0.7,
          stepNumber: 3,
          level: 1,
          stepTitle: "Test Document 3",
          decision: "PROBLEMATIC" as const,
          type: "rejected" as const,
          codeFiles: [
            {
              filename: "analysis.py",
              language: "python",
              code: "import pandas as pd\ndef analyze(data):\n    return data.describe()"
            }
          ]
        }
      }
    ];
    
    const results = [];
    
    // Add each document with embedding
    for (const doc of testDocs) {
      console.log(`Creating test document: ${doc.metadata.stepTitle}`);
      
      // Generate a real embedding for the content
      const embedding = await generateEmbedding(doc.content);
      
      if (!embedding) {
        console.error(`Failed to generate embedding for ${doc.metadata.stepTitle}`);
        results.push({
          doc: doc.metadata.stepTitle,
          success: false,
          error: "Failed to generate embedding"
        });
        continue;
      }
      
      // Create a batch ID for grouping
      const batchId = `test_batch_${Date.now()}`;
      
      // Insert document with embedding
      const { data, error } = await supabase
        .from("documents")
        .insert({
          content: doc.content,
          embedding: embedding as unknown as string,
          metadata: doc.metadata,
          batch_id: batchId
        })
        .select("id");
      
      if (error) {
        console.error(`Error inserting document ${doc.metadata.stepTitle}:`, error);
        results.push({
          doc: doc.metadata.stepTitle,
          success: false,
          error: error.message
        });
      } else {
        console.log(`Successfully created document ${doc.metadata.stepTitle} with ID ${data[0]?.id}`);
        results.push({
          doc: doc.metadata.stepTitle,
          success: true,
          id: data[0]?.id
        });
        
        // Extract code files and add to codefiles table
        if (doc.metadata.codeFiles && doc.metadata.codeFiles.length > 0) {
          for (const codeFile of doc.metadata.codeFiles) {
            // Generate embedding for the code itself
            const codeEmbedding = await generateEmbedding(codeFile.code);
            
            // Insert code file
            const { error: codeError } = await supabase
              .from("codefiles")
              .insert({
                document_id: data[0]?.id,
                batch_id: batchId,
                run_id: doc.metadata.runId,
                step_number: doc.metadata.stepNumber,
                filename: codeFile.filename,
                language: codeFile.language || "plaintext",
                code_content: codeFile.code,
                embedding: codeEmbedding as unknown as string,
                metadata: { 
                  sourceType: "test",
                  createdAt: new Date().toISOString()
                }
              });
            
            if (codeError) {
              console.error(`Error inserting code file ${codeFile.filename}:`, codeError);
            } else {
              console.log(`Successfully added code file ${codeFile.filename}`);
            }
          }
        }
      }
    }
    
    return NextResponse.json({
      status: "success",
      message: "Test documents created",
      results
    });
  } catch (error) {
    console.error("Error creating test documents:", error);
    return NextResponse.json({
      status: "error", 
      message: "Failed to create test documents",
      error
    }, { status: 500 });
  }
}