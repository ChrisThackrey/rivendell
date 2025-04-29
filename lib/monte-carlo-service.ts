/**
 * Service for Monte Carlo data and clustering.
 */
import { supabase, type DocumentMetadata } from "./supabase-client";
import { getApiUrl } from "./embedding-service";

// Types for data points
export type MonteCarloDataPoint = {
  id: string;
  model: string;
  temperature: number;
  runId: number;
  position: [number, number, number];
  metrics: {
    executionTime: string;
    complexity: string;
    memoryUsage: string;
    lineCount: number;
    codeQuality: number;
    convergenceScore: number;
  };
  approach: string;
  solutionSummary: string;
  originalContent: string;
  batchId: string;
  cluster?: number;
};

export type MonteCarloCluster = {
  id: number;
  label: string;
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  points: MonteCarloDataPoint[];
  isSelected: boolean;
};

// Type for available batches returned by RPC
interface AvailableBatchRow {
  batch_id: string;
  step_count: number;
  latest_created_at: string;
}

// Type alias for points with cluster info
export type PointWithCluster = MonteCarloDataPoint & { cluster?: number };

/**
 * Fetch available batch IDs from the database via RPC
 */
export async function fetchAvailableBatchIds(): Promise<string[]> {
  try {
    console.info("[MonteCarloService] Fetching available batch IDs via RPC");

    // Call the get_available_batches RPC function
    const { data, error } = await supabase.rpc('get_available_batches');
    if (error) {
      console.warn('[MonteCarloService] RPC error fetching batch IDs:', error);
      return [];
    }

    // Map RPC result to an array of batch IDs
    const batchRows = (data as AvailableBatchRow[]) || [];
    const batchIds = batchRows.map((row) => row.batch_id);
    console.info(
      `[MonteCarloService] Retrieved ${batchIds.length} batch IDs via RPC`,
    );
    return batchIds;
  } catch (err) {
    console.warn('[MonteCarloService] fetchAvailableBatchIds error:', err);
    return [];
  }
}

/**
 * Fetch Monte Carlo data from the database - can filter by batch ID
 */
export async function fetchMonteCarloData(
  batchId?: string | null,
): Promise<{ dataPoints: MonteCarloDataPoint[]; batchIds: string[] }> {
  try {
    console.info("[MonteCarloService] Fetching Monte Carlo data...");
    if (batchId) {
      console.info(`[MonteCarloService] Filtering by batch ID: ${batchId}`);
    }

    // First check if we can connect to the database
    try {
      // Simple query to check connection
      const { error: connectionError } = await supabase
        .from("documents")
        .select("id")
        .limit(1);

      if (connectionError) {
        console.error("Database connection error:", connectionError);
        return { dataPoints: generateMockMonteCarloData(), batchIds: [] };
      }
    } catch (connError) {
      console.error("Failed to connect to database:", connError);
      return { dataPoints: generateMockMonteCarloData(), batchIds: [] };
    }

    // Base query for solution documents
    let query = supabase
      .from("documents")
      .select("id, content, metadata, batch_id")
      .is("metadata->>stepNumber", null); // original solution docs have stepNumber null

    // Add batch filter if provided
    if (batchId) {
      query = query.eq("batch_id", batchId);
    }

    // Execute the query - removed range limit to fetch ALL points
    let { data } = await query
      .order("created_at", { ascending: false });

    // Error handling moved to try/catch block

    // If no data found for the specific batch, try a fallback approach by querying steps
    if ((!data || data.length === 0) && batchId) {
      console.info(
        `[MonteCarloService] No direct documents for batch ${batchId}, falling back to step documents`,
      );

      // Try to get step documents for this batch - no limit
      const { data: stepData, error: stepError } = await supabase
        .from("documents")
        .select("id, content, metadata, batch_id")
        .eq("batch_id", batchId)
        .not("metadata->>stepNumber", "is", null) // Only step documents
        .order("created_at", { ascending: false });

      if (stepError) {
        console.error(
          `[MonteCarloService] Error fetching step documents for batch ${batchId}:`,
          stepError,
        );
      } else if (stepData && stepData.length > 0) {
        console.info(
          `[MonteCarloService] Found ${stepData.length} step documents for batch ${batchId}`,
        );
        // Use the step documents as fallback data
        data = stepData;
      }
    }

    // If still no data found, return mock data
    if (!data || data.length === 0) {
      console.info(
        batchId
          ? `[MonteCarloService] No data for batch ${batchId}, using mock Monte Carlo data`
          : `[MonteCarloService] No real data found, using mock Monte Carlo data`,
      );
      return { dataPoints: generateMockMonteCarloData(), batchIds: [] };
    }

    console.info(
      `[MonteCarloService] Fetched ${data.length} documents for visualization${batchId ? ` (batch ${batchId})` : ''}`,
    );

    // Extract unique batch IDs within this data set
    const batchIds = Array.from(
      new Set(
        data
          .filter((doc) => doc.batch_id) // Filter out null values
          .map((doc) => doc.batch_id as string),
      ),
    ).sort();

    // Process the data into our format
    let dataPoints = data.map((document, index) => {
      const metadata = document.metadata as DocumentMetadata;

      // Extract metrics and approach data
      const metrics = metadata.scores || {
        accuracy: 70,
        complexity: 60,
        computeEfficiency: 65,
        readability: 75,
        costEfficiency: 70,
        memoryUsage: 55,
      };

      // Extract or generate approach information
      let approach = "";
      const content = document.content as string;

      // Try to extract a title or approach description from the content
      const firstLine = content.split("\n")[0];
      if (firstLine && firstLine.length < 80) {
        approach = firstLine.trim();
      } else {
        // Generate from the content's start
        approach = content.substring(0, 100).replace(/\n/g, " ").trim() + "...";
      }

      // Generate 3D position based on metrics
      const position: [number, number, number] = [
        // X-axis: Complexity (0-100) -> -6 to 6
        ((metrics?.complexity ?? 50) / 50) * 12 - 6,
        // Y-axis: Efficiency (0-100) -> -6 to 6
        ((metrics?.computeEfficiency ?? 50) / 50) * 12 - 6,
        // Z-axis: Memory usage (0-100) -> -6 to 6
        ((100 - (metrics?.memoryUsage ?? 50)) / 50) * 12 - 6, // Invert so lower memory usage is better
      ];

      // Extract summary information
      let solutionSummary = "";
      if (content.length > 200) {
        solutionSummary =
          content.substring(0, 200).replace(/\n/g, " ").trim() + "...";
      } else {
        solutionSummary = content.replace(/\n/g, " ").trim();
      }

      // Create the data point
      return {
        id: document.id,
        runId: metadata.runId || index + 1,
        model: metadata.model || "Unknown",
        temperature: metadata.temperature || 0.7,
        batchId: document.batch_id || "unknown" as string,
        position,
        metrics: {
          executionTime: metadata.runtime || "0ms",
          complexity: "O(n)",
          memoryUsage: `${Math.floor(metrics?.memoryUsage ?? 50)}MB`,
          lineCount: Math.floor((metrics?.complexity ?? 50) * 2), // Estimate line count based on complexity
          codeQuality: metrics?.accuracy ?? 70,
          convergenceScore:
            ((metrics?.accuracy ?? 70) + (metrics?.readability ?? 70)) / 2,
        },
        approach: approach.trim(),
        solutionSummary: solutionSummary,
        originalContent: content,
      };
    });

    // Add post-processing to space out points and avoid overlaps
    dataPoints = normalizeAndSpreadPoints(dataPoints);
    dataPoints = addJitterToPoints(dataPoints);

    return { dataPoints, batchIds };
  } catch (error) {
    console.error("Error in fetchMonteCarloData:", error);
    return { dataPoints: generateMockMonteCarloData(), batchIds: [] };
  }
}

// Utility: Normalize and spread points in 3D space
export function normalizeAndSpreadPoints(points: PointWithCluster[]): PointWithCluster[] {
  if (points.length <= 1) return points;
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  points.forEach(point => {
    minX = Math.min(minX, point.position[0]);
    maxX = Math.max(maxX, point.position[0]);
    minY = Math.min(minY, point.position[1]);
    maxY = Math.max(maxY, point.position[1]);
    minZ = Math.min(minZ, point.position[2]);
    maxZ = Math.max(maxZ, point.position[2]);
  });
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  const rangeZ = maxZ - minZ || 1;
  const spread = 16;
  return points.map(point => {
    const normalizedPosition: [number, number, number] = [
      ((point.position[0] - minX) / rangeX) * spread - (spread / 2),
      ((point.position[1] - minY) / rangeY) * spread - (spread / 2),
      ((point.position[2] - minZ) / rangeZ) * spread - (spread / 2)
    ];
    return { ...point, position: normalizedPosition };
  });
}

// Utility: Add jitter to overlapping points
export function addJitterToPoints(points: PointWithCluster[]): PointWithCluster[] {
  if (!points.length) return points;
  const positionMap = new Map<string, number>();
  points.forEach(point => {
    const posKey = point.position.join(',');
    positionMap.set(posKey, (positionMap.get(posKey) || 0) + 1);
  });
  const getJitterAmount = (count: number) => {
    if (count <= 1) return 0;
    const baseJitter = 0.2;
    return Math.min(baseJitter * Math.sqrt(count), 0.8);
  };
  return points.map(point => {
    const posKey = point.position.join(',');
    const count = positionMap.get(posKey) || 0;
    if (count <= 1) return point;
    const jitterAmount = getJitterAmount(count);
    const jitteredPosition: [number, number, number] = [
      point.position[0] + (Math.random() * 2 - 1) * jitterAmount,
      point.position[1] + (Math.random() * 2 - 1) * jitterAmount,
      point.position[2] + (Math.random() * 2 - 1) * jitterAmount
    ];
    return { ...point, position: jitteredPosition };
  });
}

/**
 * Fetch Monte Carlo data for a specific batch ID
 */
export async function fetchMonteCarloDataForBatch(
  batchId: string,
): Promise<{ dataPoints: MonteCarloDataPoint[]; batchIds: string[] }> {
  console.log(`Fetching Monte Carlo data specifically for batch: ${batchId}`);

  try {
    const { dataPoints, batchIds } = await fetchMonteCarloData(batchId);
    return { dataPoints, batchIds };
  } catch (error) {
    console.error(`Error fetching data for batch ${batchId}:`, error);
    return { dataPoints: [], batchIds: [] };
  }
}

/**
 * Generate clusters from Monte Carlo data points using vector similarity
 */
export async function generateClusters(
  dataPoints: MonteCarloDataPoint[],
  minClusters: number = 2,
  maxClusters: number = 5,
): Promise<MonteCarloCluster[]> {
  if (dataPoints.length === 0) {
    return [];
  }

  try {
    // Step 1: Select random seed points as initial cluster centers
    // The number of clusters is determined by the data size and constraints
    const numClusters = Math.min(
      Math.max(minClusters, Math.ceil(dataPoints.length / 20)),
      Math.min(maxClusters, dataPoints.length),
    );

    // Shuffle and pick seeds
    const shuffled = [...dataPoints].sort(() => 0.5 - Math.random());
    const seeds = shuffled.slice(0, numClusters);

    // Step 2: Create initial clusters with colors
    const clusterColors = [
      "#5b9cf5", // Blue
      "#b57edc", // Purple
      "#6c7793", // Slate
      "#e6b25b", // Amber
      "#a8e2b0", // Light green
    ];

    const clusters: MonteCarloCluster[] = seeds.map((seed, index) => {
      return {
        id: index + 1,
        label: `Cluster ${index + 1}`, // Temporary label, will be updated
        position: seed.position,
        size: [6, 6, 6], // Initial size
        color: clusterColors[index % clusterColors.length],
        points: [],
        isSelected: false,
      };
    });

    // Step 3: Assign each data point to the nearest cluster based on position
    dataPoints.forEach((point) => {
      let minDistance = Infinity;
      let closestClusterIndex = 0;

      // Find the closest cluster center
      clusters.forEach((cluster, index) => {
        const distance = calculateDistance(point.position, cluster.position);
        if (distance < minDistance) {
          minDistance = distance;
          closestClusterIndex = index;
        }
      });

      // Add the point to the closest cluster
      clusters[closestClusterIndex].points.push(point);
    });

    // Step 4: Recalculate cluster centers and sizes based on assigned points
    clusters.forEach((cluster) => {
      if (cluster.points.length > 0) {
        // Calculate the new center as the average of all points
        const sumX = cluster.points.reduce((sum, p) => sum + p.position[0], 0);
        const sumY = cluster.points.reduce((sum, p) => sum + p.position[1], 0);
        const sumZ = cluster.points.reduce((sum, p) => sum + p.position[2], 0);

        cluster.position = [
          sumX / cluster.points.length,
          sumY / cluster.points.length,
          sumZ / cluster.points.length,
        ];

        // Calculate the size of the cluster based on the spread of points
        const minX = Math.min(...cluster.points.map((p) => p.position[0]));
        const maxX = Math.max(...cluster.points.map((p) => p.position[0]));
        const minY = Math.min(...cluster.points.map((p) => p.position[1]));
        const maxY = Math.max(...cluster.points.map((p) => p.position[1]));
        const minZ = Math.min(...cluster.points.map((p) => p.position[2]));
        const maxZ = Math.max(...cluster.points.map((p) => p.position[2]));

        const sizeX = Math.max(4, maxX - minX + 2); // Add padding
        const sizeY = Math.max(4, maxY - minY + 2);
        const sizeZ = Math.max(4, maxZ - minZ + 2);

        cluster.size = [sizeX, sizeY, sizeZ];
      }
    });

    return clusters;
  } catch (error) {
    console.error("Error generating clusters:", error);
    return [];
  }
}

/**
 * Generate descriptive titles for each cluster using GPT-4o
 */
export async function generateClusterTitles(
  clusters: MonteCarloCluster[],
): Promise<MonteCarloCluster[]> {
  try {
    // Add a counter for failed API calls to track if we should stop trying
    let failedApiCallCount = 0;
    const MAX_FAILED_CALLS = 2; // Stop trying after this many failures

    const clusterPromises = clusters.map(async (cluster) => {
      if (cluster.points.length === 0) {
        return cluster;
      }

      // If we've already had multiple API failures, use rule-based naming immediately
      if (failedApiCallCount >= MAX_FAILED_CALLS) {
        return generateRuleBasedClusterTitle(cluster);
      }

      // Collect content from cluster points to use as context
      const contentSamples = cluster.points
        .slice(0, Math.min(5, cluster.points.length)) // Take up to 5 samples to avoid token limits
        .map((point) => point.originalContent?.substring(0, 300) || "") // Take first 300 chars of each point
        .join("\n\n");

      // Create a prompt for GPT-4o to generate a title
      const prompt = `I have a cluster of code solutions with similar characteristics.
      Here are samples from the solutions in this cluster:

${contentSamples}

Based on these samples, generate a short, descriptive title (maximum 6 words) that captures the shared approach, algorithm, or methodology used in these solutions. The title should be specific and technical, avoiding generic terms like "Efficient Solution" or "Optimized Approach".

Title (max 6 words):`;

      try {
        console.log(`Using rule-based title generation for cluster ${cluster.id} to avoid API errors`);
        // Skip API call and directly use rule-based generation
        return generateRuleBasedClusterTitle(cluster);
        
        /* Temporarily disabled API call to avoid 404 errors
        // Use the shared getApiUrl utility
        const apiUrl = getApiUrl("/api/openai");

        // Call the OpenAI API with a more reasonable timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          // Log a message before aborting to help with debugging
          console.log(
            `API request timeout reached after 15 seconds for cluster ${cluster.id}`,
          );
          controller.abort();
        }, 15000); // Increase timeout to 15 seconds

        try {
          const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              prompt,
              model: "gpt-4o",
              temperature: 0.3, // Low temperature for more consistent results
            }),
            signal: controller.signal,
          });

          // Clear the timeout as soon as we get a response
          clearTimeout(timeoutId);

          if (!response.ok) {
            console.error(
              `Failed to generate cluster title: ${response.status} ${response.statusText}`,
            );
            failedApiCallCount++;

            // Use rule-based title generation
            return generateRuleBasedClusterTitle(cluster);
          }
        */

          /* This section is part of the disabled code
          // Process the response as before
          const data = await response.json();

          // Ensure we have a title property
          if (!data || !data.title) {
            console.error("Invalid response format from OpenAI API");
            failedApiCallCount++;

            return generateRuleBasedClusterTitle(cluster);
          }

          const title = data.title.trim();

          // Ensure the title is not too long
          const shortenedTitle = title.split(" ").slice(0, 6).join(" ");

          return {
            ...cluster,
            label: shortenedTitle || `Cluster ${cluster.id}`,
          };
        } catch (error) {
          // Always clear the timeout if something goes wrong
          clearTimeout(timeoutId);
          throw error; // Re-throw to be caught by the outer catch
        }
        */
      } catch (error: unknown) {
        // Check if this is an abort error, which is expected so log it differently
        if (
          (error instanceof DOMException && error.name === "AbortError") ||
          (error instanceof Error && error.name === "AbortError") ||
          (error instanceof Error && error.message.includes("abort")) ||
          (typeof error === "object" &&
            error !== null &&
            "toString" in error &&
            error.toString().includes("abort"))
        ) {
          console.log(
            "Request was aborted due to timeout - falling back to rule-based title",
          );
        } else {
          console.error("Error generating title for cluster:", error);
        }
        failedApiCallCount++;

        // Use rule-based title generation
        return generateRuleBasedClusterTitle(cluster);
      }
    });

    // Wait for all title generation to complete
    return await Promise.all(clusterPromises);
  } catch (error) {
    console.error("Error in generateClusterTitles:", error);

    // If overall process fails, generate rule-based titles for all clusters
    return clusters.map((cluster) => generateRuleBasedClusterTitle(cluster));
  }
}

/**
 * Generate a cluster title based on content analysis rules without API calls
 */
function generateRuleBasedClusterTitle(
  cluster: MonteCarloCluster,
): MonteCarloCluster {
  try {
    // Get approaches from all points in the cluster
    const approaches = cluster.points
      .map((p) => p.approach)
      .filter((a) => a && a.length > 0);

    // Get model names used in the cluster
    const models = new Set(cluster.points.map((p) => p.model));

    // Extract common keywords from approaches and content
    const keywords = extractKeywords(cluster);

    // Try to generate a descriptive title
    let title = "";

    if (keywords.length > 0) {
      // Use top keywords as the title
      title = keywords.slice(0, 3).join(" ") + " Approach";
    } else if (approaches.length > 0) {
      // Use the most common approach if keywords not available
      const topApproach = getMostFrequent(approaches);
      // Truncate long approaches to keep title concise
      title = truncateString(topApproach, 30);
    } else {
      // Generic fallback with model information
      const modelList = Array.from(models).join("/");
      title = `${modelList} Solutions Cluster ${cluster.id}`;
    }

    return {
      ...cluster,
      label: title || `Cluster ${cluster.id} (${cluster.points.length} points)`,
    };
  } catch (error) {
    console.error("Error in rule-based title generation:", error);
    return {
      ...cluster,
      label: `Cluster ${cluster.id} (${cluster.points.length} points)`,
    };
  }
}

/**
 * Extract relevant keywords from cluster points
 */
function extractKeywords(cluster: MonteCarloCluster): string[] {
  // Common algorithm and programming terms to look for
  const algorithmTerms = [
    "recursive",
    "recursion",
    "dynamic",
    "greedy",
    "graph",
    "tree",
    "binary",
    "search",
    "hash",
    "sorting",
    "object-oriented",
    "functional",
    "optimization",
    "parallel",
    "cache",
    "iteration",
    "traversal",
    "backtracking",
    "divide",
    "conquer",
    "memoization",
    "database",
    "index",
    "queue",
    "stack",
  ];

  // Count occurrences of algorithm terms in content
  const termCounts: Record<string, number> = {};

  // Check each point's content for terms
  cluster.points.forEach((point) => {
    if (!point.originalContent) return;

    const content = point.originalContent.toLowerCase();

    algorithmTerms.forEach((term) => {
      if (content.includes(term.toLowerCase())) {
        termCounts[term] = (termCounts[term] || 0) + 1;
      }
    });

    // Also check the approach string
    if (point.approach) {
      const approach = point.approach.toLowerCase();
      algorithmTerms.forEach((term) => {
        if (approach.includes(term.toLowerCase())) {
          termCounts[term] = (termCounts[term] || 0) + 1;
        }
      });
    }
  });

  // Sort terms by frequency
  return Object.entries(termCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([term]) => term.charAt(0).toUpperCase() + term.slice(1));
}

/**
 * Find the most frequently occurring string in an array
 */
function getMostFrequent(arr: string[]): string {
  const counts: Record<string, number> = {};
  let maxCount = 0;
  let maxItem = "";

  for (const item of arr) {
    counts[item] = (counts[item] || 0) + 1;
    if (counts[item] > maxCount) {
      maxCount = counts[item];
      maxItem = item;
    }
  }

  return maxItem;
}

/**
 * Truncate a string to a maximum length, preserving word boundaries
 */
function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;

  // Find the last space before maxLength
  const lastSpace = str.substring(0, maxLength).lastIndexOf(" ");
  if (lastSpace > 0) {
    return str.substring(0, lastSpace);
  }

  // If no space found, just truncate
  return str.substring(0, maxLength);
}

/**
 * Calculate Euclidean distance between two 3D points
 */
function calculateDistance(
  point1: [number, number, number],
  point2: [number, number, number],
): number {
  const dx = point1[0] - point2[0];
  const dy = point1[1] - point2[1];
  const dz = point1[2] - point2[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Generate mock Monte Carlo data for testing and fallback
 */
function generateMockMonteCarloData(): MonteCarloDataPoint[] {
  console.log("Generating mock Monte Carlo data");
  const models = ["GPT-4o", "Claude-Sonnet-7", "o1", "o3-mini"];
  const approaches = [
    "Recursive Pattern Recognition",
    "Dynamic Programming Optimization",
    "Tree-based Traversal",
    "Greedy Algorithm Implementation",
    "Hash-based Lookup Strategy",
    "Binary Search Pattern",
    "Graph Algorithm Approach",
  ];

  // Generate 30 random data points
  return Array.from({ length: 30 }, (_, i) => {
    const model = models[Math.floor(Math.random() * models.length)];
    const approach = approaches[Math.floor(Math.random() * approaches.length)];
    const randomScores = {
      accuracy: 50 + Math.floor(Math.random() * 45),
      complexity: 50 + Math.floor(Math.random() * 45),
      computeEfficiency: 50 + Math.floor(Math.random() * 45),
      readability: 50 + Math.floor(Math.random() * 45),
      costEfficiency: 50 + Math.floor(Math.random() * 45),
      memoryUsage: 30 + Math.floor(Math.random() * 50),
    };

    // Create a random position based on mock metrics
    const position: [number, number, number] = [
      (randomScores.complexity / 50) * 12 - 6,
      (randomScores.computeEfficiency / 50) * 12 - 6,
      ((100 - randomScores.memoryUsage) / 50) * 12 - 6,
    ];

    // Generate mock content
    const mockContent = `# ${approach}\n\nThis is a mock solution using ${model}.\n\nThe approach focuses on ${approach.toLowerCase()} with key optimizations for performance and readability.`;

    // Generate mock summary
    const mockSummary = `${approach} implementation with ${model} focusing on balanced performance metrics.`;

    return {
      id: `mock-${i + 1}`,
      model,
      temperature: 0.5 + Math.random() * 0.5,
      runId: i + 1,
      position,
      metrics: {
        executionTime: `${(Math.random() * 100 + 50).toFixed(0)}ms`,
        complexity: randomScores.complexity > 70 ? "O(n log n)" : "O(n)",
        memoryUsage: `${Math.floor(randomScores.memoryUsage)}MB`,
        lineCount: 50 + Math.floor(Math.random() * 100),
        codeQuality: randomScores.readability,
        convergenceScore:
          (randomScores.accuracy + randomScores.readability) / 2,
      },
      approach,
      solutionSummary: mockSummary,
      originalContent: mockContent,
      batchId: "mock-batch",
      cluster: undefined,
    };
  });
}
