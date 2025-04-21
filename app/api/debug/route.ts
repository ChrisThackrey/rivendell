import { NextRequest, NextResponse } from "next/server";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Requested-With",
};

/**
 * Simple debug endpoint used for port detection and CORS testing
 */
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function GET(request: NextRequest) {
  return NextResponse.json(
    {
      status: "ok",
      message: "API is working correctly",
      port: process.env.PORT || "3000",
      timestamp: new Date().toISOString(),
      isDebugEndpoint: true,
    },
    { status: 200, headers: corsHeaders },
  );
}
