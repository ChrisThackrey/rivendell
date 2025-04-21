/**
 * Utility for handling port detection and CORS issues in development
 */

/**
 * Get the correct API base URL by detecting the current runtime environment
 * This function handles the port mismatch issue between client and server in development
 */
export function getApiBaseUrl(path: string = ""): string {
  // Default to relative URL for production or server-side
  if (typeof window === "undefined") {
    return path;
  }

  const currentUrl = window.location;
  const isLocalhost =
    currentUrl.hostname === "localhost" || currentUrl.hostname === "127.0.0.1";

  // If we're not on localhost, just use the relative path
  if (!isLocalhost) {
    return path;
  }

  // For localhost, we need to handle port detection
  // First, try to get the port from localStorage if previously detected
  const storedPort = localStorage.getItem("api_port");

  // If we have a stored port and it's a reasonable number, use it
  if (storedPort && /^\d{4,5}$/.test(storedPort)) {
    return `${currentUrl.protocol}//${currentUrl.hostname}:${storedPort}${path}`;
  }

  // If we're on port 3000, but the API might be on another port (common in development)
  // Ports 3000-3006 are commonly used by Next.js
  const possibleApiPorts = ["3004", "3001", "3002", "3003", "3005", "3006"];

  // If current port is in our list, use it first, otherwise try other ports
  const allPorts = currentUrl.port
    ? [
        currentUrl.port,
        ...possibleApiPorts.filter((p) => p !== currentUrl.port),
      ]
    : possibleApiPorts;

  // Return first option for immediate use
  return `${currentUrl.protocol}//${currentUrl.hostname}:${allPorts[0]}${path}`;
}

/**
 * Function to detect working API port and save it
 * This will try different ports in sequence until one works
 */
export async function detectWorkingApiPort(): Promise<string | null> {
  if (typeof window === "undefined") {
    return null;
  }

  const currentUrl = window.location;
  const isLocalhost =
    currentUrl.hostname === "localhost" || currentUrl.hostname === "127.0.0.1";

  // Only run detection on localhost
  if (!isLocalhost) {
    return null;
  }

  // Possible ports to try
  const possibleApiPorts = [
    "3004",
    "3001",
    "3002",
    "3003",
    "3005",
    "3006",
    "3000",
  ];

  // If current port is in our list, try it first, otherwise try all ports
  const allPorts = currentUrl.port
    ? [
        currentUrl.port,
        ...possibleApiPorts.filter((p) => p !== currentUrl.port),
      ]
    : possibleApiPorts;

  // Try each port sequentially
  for (const port of allPorts) {
    try {
      // Make a test request to the debug endpoint which should be lighter
      const url = `${currentUrl.protocol}//${currentUrl.hostname}:${port}/api/debug`;
      const response = await fetch(url, {
        method: "OPTIONS",
        mode: "cors",
        cache: "no-cache",
      });

      if (response.status === 204) {
        // Found working port, store it
        localStorage.setItem("api_port", port);
        console.log(`API port detection successful: ${port}`);
        return port;
      }
    } catch (_error) {
      console.log(`Port ${port} not working or CORS error`);
    }
  }

  console.error("Could not detect a working API port");
  return null;
}

/**
 * Create standard CORS headers for all API responses
 */
export function getCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Requested-With",
  };
}
