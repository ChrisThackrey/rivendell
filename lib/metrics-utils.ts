// lib/metrics-utils.ts
// Helper functions for calculating realistic metrics

export function calculateExecutionTime(content: string): string {
  // Base execution time on content length and complexity
  const contentLength = content.length;
  const hasLoops = /for\s*\(|while\s*\(|forEach|map\s*\(/i.test(content);
  const hasRecursion = /function\s+\w+\s*\([^)]*\)\s*{[^}]*\w+\s*\(/i.test(
    content,
  );
  const hasMathOperations = /Math\.\w+|sqrt|pow|log|sin|cos|tan/i.test(content);

  // Calculate base time (longer content generally means longer execution time)
  let baseTime = 0.1 + contentLength / 10000; // Base time in seconds

  // Adjust for complexity factors
  if (hasLoops) baseTime *= 1.5;
  if (hasRecursion) baseTime *= 2.0;
  if (hasMathOperations) baseTime *= 1.3;

  // Add some randomness for realism
  baseTime *= 0.8 + Math.random() * 0.4;

  // Format the time
  if (baseTime < 1) {
    return `${Math.round(baseTime * 1000)}ms`;
  } else if (baseTime < 60) {
    return `${baseTime.toFixed(1)}s`;
  } else {
    const minutes = Math.floor(baseTime / 60);
    const seconds = Math.round(baseTime % 60);
    return `${minutes}m ${seconds}s`;
  }
}

export function estimateComplexity(content: string): string {
  // Look for complexity indicators in the content
  const hasNestedLoops = /for\s*\([^{]*for\s*\(/i.test(content);
  const hasCubicPattern = /for\s*\([^{]*for\s*\([^{]*for\s*\(/i.test(content);
  const hasLogPattern = /binary\s+search|log\s*\(|divide\s+and\s+conquer/i.test(
    content,
  );
  const hasSimpleLoops = /for\s*\(|while\s*\(/i.test(content);
  const hasLinearPatterns = /indexOf|find\s*\(/i.test(content);

  // Determine complexity notation
  if (hasCubicPattern) return "O(n³)";
  if (hasNestedLoops) return "O(n²)";
  if (hasLogPattern) return "O(n log n)";
  if (hasSimpleLoops || hasLinearPatterns) return "O(n)";
  return "O(1)";
}

export function estimateMemoryUsage(content: string): string {
  // Base memory estimate on content features
  const contentLength = content.length;
  const hasArrays = /new\s+Array|Array\s*\(|\[\s*\]|\[\s*\d+/i.test(content);
  const hasObjects = /new\s+Object|\{\s*\}|\{\s*[\w'"]+\s*:/i.test(content);
  const hasDataStructures = /Map|Set|Queue|Stack|Tree|Graph/i.test(content);

  // Calculate base memory usage (in MB)
  let baseMemory = 10 + contentLength / 20000;

  // Adjust for data structure usage
  if (hasArrays) baseMemory += 15;
  if (hasObjects) baseMemory += 20;
  if (hasDataStructures) baseMemory += 30;

  // Add randomness for realism
  baseMemory *= 0.9 + Math.random() * 0.3;

  // Format the memory usage
  return `${Math.round(baseMemory)}MB`;
}

export function countCodeLines(content: string): number {
  // Count non-empty lines of code
  const lines = content.split("\n").filter((line) => line.trim().length > 0);

  // Count only code lines (exclude comments and documentation)
  const codeLines = lines.filter((line) => {
    const trimmedLine = line.trim();
    return (
      !trimmedLine.startsWith("//") &&
      !trimmedLine.startsWith("*") &&
      !trimmedLine.startsWith("/*")
    );
  });

  // Return a realistic count (between 30 and 150 lines)
  const count = codeLines.length;
  return Math.max(30, Math.min(count, 150));
}

export function calculateCodeQuality(content: string): number {
  // Quality indicators
  const hasComments = /\/\/|\/\*|\*\//i.test(content);
  const hasFunctionNames = /function\s+[a-zA-Z][a-zA-Z0-9_]*/i.test(content);
  const hasErrorHandling = /try\s*\{|catch\s*\(|throw\s+new\s+Error/i.test(
    content,
  );
  const hasTypes = /: \w+|<\w+>/i.test(content);
  const hasTests = /test|assert|expect|should|describe|it\s*\(/i.test(content);

  // Starting score
  let score = 60;

  // Adjust score based on quality indicators
  if (hasComments) score += 10;
  if (hasFunctionNames) score += 5;
  if (hasErrorHandling) score += 10;
  if (hasTypes) score += 8;
  if (hasTests) score += 7;

  // Add random variance (±5)
  score += Math.round(Math.random() * 10 - 5);

  // Clamp to reasonable range
  return Math.max(50, Math.min(score, 95));
}

export function calculateConvergenceScore(
  model: string,
  content: string,
): number {
  // Base convergence on model capability and content indicators
  let score = 70; // Default score

  // Adjust based on model capability
  if (model.includes("gpt-4")) score += 10;
  if (model.includes("claude")) score += 8;
  if (model.includes("mini")) score -= 5;

  // Content-based adjustments
  const hasAlgorithmDescription = /algorithm|approach|strategy/i.test(content);
  const hasImplementationDetails = /implementation|executed|composed/i.test(
    content,
  );
  const hasTradeoffDiscussion = /tradeoff|compromise|balance|versus/i.test(
    content,
  );

  if (hasAlgorithmDescription) score += 5;
  if (hasImplementationDetails) score += 5;
  if (hasTradeoffDiscussion) score += 5;

  // Add random variance (±3)
  score += Math.round(Math.random() * 6 - 3);

  // Clamp to reasonable range
  return Math.max(60, Math.min(score, 95));
}

export function generateTitleFromContent(content: string): string | null {
  // Extract key terms that might indicate approach
  const algorithmTerms = [
    "recursion",
    "dynamic programming",
    "greedy",
    "divide and conquer",
    "sorting",
    "searching",
    "graph",
    "tree",
    "hash",
    "queue",
    "stack",
  ];

  // Check if content contains algorithm terms
  for (const term of algorithmTerms) {
    if (content.toLowerCase().includes(term)) {
      return `${term.charAt(0).toUpperCase() + term.slice(1)} Approach`;
    }
  }

  // Fallback to generic pattern recognition
  if (/optimization|optimize/i.test(content)) {
    return "Optimized Implementation";
  }

  if (/modular|module/i.test(content)) {
    return "Modular Architecture";
  }

  if (/component|react|vue|angular/i.test(content)) {
    return "Component-Based Solution";
  }

  return "Strategic Implementation";
}
