import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-client";
import { isPgVectorInstalled } from "@/lib/embedding-service";

/**
 * API route to check database health and verify that vector extensions are properly installed
 */
export async function GET() {
  try {
    console.log("Checking database health and extensions...");
    
    // First check if we can connect to the database
    const { data: documentTest, error: docError } = await supabase
      .from("documents")
      .select("id")
      .limit(1);
    
    if (docError && docError.code !== "PGRST116") {
      // PGRST116 just means the table doesn't exist, which is expected
      console.error("Basic query error:", docError);
      return NextResponse.json({
        status: "error",
        message: "Failed to query documents table: " + docError.message,
        error: docError
      }, { status: 500 });
    }
    
    // Get document count
    const { count: documentCount, error: countError } = await supabase
      .from("documents")
      .select("id", { count: "exact", head: true });
      
    if (countError && countError.code !== "PGRST116") {
      console.error("Document count error:", countError);
    }
    
    // Check if pgvector extension is installed
    const vectorInstalled = await isPgVectorInstalled();
    
    // Try to check available extensions
    let extensionsList: { extname: string }[] = [];
    try {
      const { data: extensions, error: extError } = await supabase.rpc('list_extensions');
      
      if (extError) {
        console.error("Error fetching extensions:", extError);
      } else if (extensions) {
        extensionsList = extensions;
      }
    } catch (extError) {
      console.error("Error checking extensions:", extError);
    }
    
    // Test vector search capability
    let vectorSearchResult;
    try {
      // Only test if the extension appears to be installed
      if (vectorInstalled) {
        console.log("Testing vector search capability...");
        
        const testEmbedding = Array.from({ length: 1536 }, () => Math.random() * 2 - 1);
        
        // Normalize embedding
        const magnitude = Math.sqrt(testEmbedding.reduce((sum, val) => sum + val * val, 0));
        const normalizedEmbedding = testEmbedding.map(val => val / magnitude);
        
        // Test with different thresholds
        const thresholds = [0.1, 0.3, 0.5, 0.7, 0.9];
        const results = [];
        
        for (const threshold of thresholds) {
          try {
            const { data, error } = await supabase.rpc("match_documents", {
              query_embedding: normalizedEmbedding as unknown as string,
              match_threshold: threshold,
              match_count: 5
            });
            
            results.push({
              threshold,
              success: !error,
              matches: data?.length || 0,
              error: error ? error.message : undefined
            });
          } catch (matchError: any) {
            results.push({
              threshold,
              success: false,
              error: matchError?.message || 'Unknown error'
            });
          }
        }
        
        vectorSearchResult = results;
      }
    } catch (vectorError: any) {
      console.error("Error testing vector search:", vectorError);
      vectorSearchResult = {
        status: "error",
        message: "Failed to test vector search: " + (vectorError?.message || 'Unknown error')
      };
    }
    
    // Return comprehensive diagnostic information
    return NextResponse.json({
      status: vectorInstalled ? "success" : "warning",
      message: vectorInstalled 
        ? "Database connected, vector extension installed" 
        : "Database connected, but vector extension is missing - manual installation required",
      databaseConnected: true,
      documentCount: documentCount || 0,
      vectorExtensionInstalled: vectorInstalled,
      extensions: extensionsList,
      vectorSearchResults: vectorSearchResult,
      timestamp: new Date().toISOString(),
      note: !vectorInstalled ? "Please contact your database administrator to install the pgvector extension" : undefined
    });
  } catch (error) {
    console.error("Database check error:", error);
    return NextResponse.json({
      status: "error", 
      message: "Failed to check database",
      error
    }, { status: 500 });
  }
}

/**
 * API route to test vector search for an embedding
 */
export async function POST(request: Request) {
  try {
    // Parse the request to specify threshold and count
    const { threshold = 0.5, count = 5 } = await request.json();
    
    console.log(`Testing vector search with threshold ${threshold} and count ${count}`);
    
    // Create a random test embedding
    const testEmbedding = Array.from({ length: 1536 }, () => Math.random() * 2 - 1);
    
    // Normalize embedding
    const magnitude = Math.sqrt(testEmbedding.reduce((sum, val) => sum + val * val, 0));
    const normalizedEmbedding = testEmbedding.map(val => val / magnitude);
    
    // Get document count
    const { count: documentCount, error: countError } = await supabase
      .from("documents")
      .select("id", { count: "exact", head: true });
      
    if (countError && countError.code !== "PGRST116") {
      console.error("Document count error:", countError);
    }
    
    // Try the vector search function  
    const { data, error } = await supabase.rpc("match_documents", {
      query_embedding: normalizedEmbedding as unknown as string,
      match_threshold: threshold,
      match_count: count
    });
    
    if (error) {
      console.error("Vector search error:", error);
      return NextResponse.json({
        status: "error",
        message: "Vector search failed: " + error.message,
        documentCount: documentCount || 0,
        error
      }, { status: 500 });
    }
    
    // Return search results
    return NextResponse.json({
      status: "success",
      message: `Found ${data?.length || 0} similar documents`,
      documentCount: documentCount || 0,
      results: data,
      params: { threshold, count }
    });
  } catch (error) {
    console.error("Vector search test error:", error);
    return NextResponse.json({
      status: "error", 
      message: "Failed to test vector search",
      error
    }, { status: 500 });
  }
}