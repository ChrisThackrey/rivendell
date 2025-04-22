import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-client";

export async function GET() {
  try {
    console.log("Testing match_documents function...");
    
    // Create a test embedding (1536 dimensions, normalized)
    const testEmbedding = Array.from(
      { length: 1536 },
      () => Math.random() * 2 - 1
    );
    
    // Normalize the embedding
    const norm = Math.sqrt(
      testEmbedding.reduce((sum, val) => sum + val * val, 0)
    );
    const normalizedEmbedding = testEmbedding.map((val) => val / norm);
    
    // Test various match thresholds
    const thresholds = [0.1, 0.3, 0.5, 0.7, 0.9];
    const results = [];
    
    for (const threshold of thresholds) {
      console.log(`Testing with threshold: ${threshold}`);
      
      const { data, error } = await supabase.rpc("match_documents", {
        query_embedding: normalizedEmbedding,
        match_threshold: threshold,
        match_count: 10
      });
      
      if (error) {
        console.error(`Error with threshold ${threshold}:`, error);
        results.push({
          threshold,
          error: error.message,
          success: false
        });
      } else {
        console.log(`Results with threshold ${threshold}:`, data?.length || 0);
        results.push({
          threshold,
          matches: data?.length || 0,
          success: true
        });
      }
    }
    
    // Test direct database query to see if documents exist
    const { data: documentCount, error: countError } = await supabase
      .from("documents")
      .select("id");
    
    return NextResponse.json({
      status: "success",
      message: "Match documents test complete",
      results,
      documentCount: documentCount?.length || 0,
      hasDocuments: (documentCount?.length || 0) > 0,
      countError: countError?.message
    });
  } catch (error) {
    console.error("Match test error:", error);
    return NextResponse.json({
      status: "error", 
      message: "Failed to test match_documents",
      error
    }, { status: 500 });
  }
}