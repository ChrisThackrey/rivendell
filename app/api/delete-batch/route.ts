import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase-client";

// API route to cascade delete a batch along with its steps, codefiles, and documents
export async function POST(request: Request) {
  try {
    const { batchId } = await request.json();
    if (!batchId) {
      return NextResponse.json({ error: "batchId is required" }, { status: 400 });
    }

    // Delete steps by batch_id
    let { error } = await supabase.from("steps").delete().eq("batch_id", batchId);
    if (error) {
      console.error("Error deleting steps for batch", batchId, error);
      throw error;
    }

    // Delete codefiles by batch_id
    ({ error } = await supabase.from("codefiles").delete().eq("batch_id", batchId));
    if (error) {
      console.error("Error deleting codefiles for batch", batchId, error);
      throw error;
    }

    // Delete documents by batch_id (this will drop entries and their associated data)
    ({ error } = await supabase.from("documents").delete().eq("batch_id", batchId));
    if (error) {
      console.error("Error deleting documents for batch", batchId, error);
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Failed to delete batch:", err);
    return NextResponse.json({ error: err.message || "Unknown error" }, { status: 500 });
  }
} 