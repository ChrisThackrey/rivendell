/**
 * A utility to provide mock responses when API keys aren't available
 */

// Types for AI responses
type MockMetrics = {
  executionTime: string;
  complexity: string;
  memoryUsage: string;
  lineCount: number;
  codeQuality: number;
};

type MockResponse = {
  title: string;
  description: string;
  fullContent: string;
  metrics: MockMetrics;
  model: string;
};

/**
 * Generate a mock response when API keys aren't available
 * This allows local development without real API keys
 */
export function generateMockResponse(prompt: string, model: string): MockResponse {
  // Generate random metrics
  const metrics: MockMetrics = {
    executionTime: `${(Math.random() * 1.5 + 0.2).toFixed(2)}s`,
    complexity: Math.random() > 0.7 ? "O(n²)" : "O(n log n)",
    memoryUsage: `${Math.floor(Math.random() * 100 + 40)}MB`,
    lineCount: Math.floor(Math.random() * 100 + 50),
    codeQuality: Math.floor(Math.random() * 30 + 70),
  };

  // Check whether it's for OpenAI or Anthropic
  const isOpenAI = model.toLowerCase().includes('gpt');
  
  // Create mock content based on provider with cognitive reasoning approach
  let content = '';
  if (isOpenAI) {
    content = `First Principles Decomposition\n\n`;
    content += `My thinking process begins with breaking down the problem "${prompt}" into its fundamental components. This cognitive approach allows me to identify the core building blocks of the solution.\n\n`;
    content += `Step 1: I'm analyzing the essential requirements by questioning assumptions and identifying the true objectives.\n\n`;
    content += `Step 2: For each component, I'm examining interdependencies and potential integration challenges.\n\n`;
    content += `Step 3: My reasoning suggests that a modular architecture with clearly defined interfaces will maximize flexibility.\n\n`;
    content += `Step 4: I've identified several potential implementation paths but am prioritizing the approach that balances maintainability with performance.\n\n`;
    content += `This first-principles approach ensures we're solving the right problem in the right way, rather than applying predetermined patterns that might not fit the unique requirements.`;
  } else {
    content = `Mental Model Mapping\n\n`;
    content += `I'm addressing "${prompt}" by constructing a comprehensive mental model of the solution space. This cognitive framework helps me visualize the interactions between different components.\n\n`;
    content += `Step 1: I'm creating a conceptual map of the problem domain, identifying key entities and relationships.\n\n`;
    content += `Step 2: My reasoning process involves analyzing potential user journeys to ensure the solution addresses all interaction patterns.\n\n`;
    content += `Step 3: I'm evaluating different architectural approaches against my mental model to identify strengths and weaknesses of each.\n\n`;
    content += `Step 4: By iteratively refining this mental model, I'm converging on a solution that balances technical elegance with practical implementation concerns.\n\n`;
    content += `This cognitive approach helps ensure that our solution has a solid conceptual foundation before diving into implementation details.`;
  }

  // Process the content to extract a title and description
  // Look for a specific title format (AI will be instructed to provide a clear title)
  const titleMatch = content.match(/^(.+?)(?:\n|$)/);
  const title = titleMatch ? titleMatch[1].substring(0, 50).trim() : 'Cognitive Approach';
  
  // Get a substantial description that shows the thinking process
  // Extract more content for the description to show reasoning (up to 500 chars)
  const descriptionText = content.replace(title, '').trim();
  const description = descriptionText.substring(0, 500).trim();

  return {
    title,
    description,
    fullContent: content,
    metrics,
    model,
  };
}

/**
 * Check if we can use the real API or need to fall back to mocks
 */
export function shouldUseMockResponse(provider: 'openai' | 'anthropic'): boolean {
  if (provider === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY;
    return !apiKey || apiKey === 'your_openai_api_key_here';
  } else {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    return !apiKey || apiKey === 'your_anthropic_api_key_here';
  }
}
