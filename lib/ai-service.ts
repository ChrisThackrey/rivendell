/**
 * Service for handling AI API calls
 */

import { type CodeFile } from '@/lib/supabase-client';

// Define structured solution step
export type SolutionStep = {
  title: string;
  description: string;
  metrics: {
    executionTime: string;
    complexity: string;
    memoryUsage: string;
    lineCount: number;
    codeQuality: number;
  };
  codeFiles?: CodeFile[]; // Add codeFiles to SolutionStep
};

// Define structured solution
export type StructuredSolution = {
  steps: SolutionStep[];
  finalSolution: {
    title: string;
    description: string;
    metrics: {
      executionTime: string;
      complexity: string;
      memoryUsage: string;
      lineCount: number;
    }
    codeFiles?: CodeFile[]; // Add codeFiles to finalSolution
  };
  rawContent: string;
  reasoningProcess?: string; // For solutions with reasoning
  batchId?: string; // For correlating steps
};

// Define response type
export type AIResponse = {
  title: string;
  description: string;
  fullContent: string;
  metrics: {
    executionTime: string;
    complexity: string;
    memoryUsage: string;
    lineCount: number;
    codeQuality: number;
  };
  model: string;
  structuredSolution?: StructuredSolution;
  hasReasoning?: boolean;
  batchId?: string; // For correlating steps
  codeFiles?: CodeFile[]; // Add codeFiles to AIResponse
};

// Map model names to their provider
export const modelProviders = {
  // OpenAI models
  'gpt-4o': 'openai',
  'gpt-4o-mini': 'openai',
  'gpt-3.5-turbo': 'openai',
  'gpt-3.5': 'openai',
  'o3': 'openai',
  'o3-mini': 'openai',
  'o1': 'openai',
  
  // Anthropic models
  'claude-3-5-sonnet': 'anthropic',
  'claude-3-5-sonnet-20240620': 'anthropic',
  'claude-3-sonnet-20240229': 'anthropic',
  'claude-3-opus-20240229': 'anthropic',
  'claude-3-haiku-20240307': 'anthropic',
  'claude-3-sonnet': 'anthropic',
  'claude-3-opus': 'anthropic',
  'claude-3-haiku': 'anthropic',
  'Claude-Sonnet-5': 'anthropic',
  'Claude-Sonnet-7': 'anthropic',
};

// Map display names to actual API model names
export const modelMapping = {
  'GPT-4o': 'gpt-4o',
  'GPT-4o-mini': 'gpt-4o-mini',
  'GPT-3.5': 'gpt-3.5-turbo',
  'Claude-Sonnet-7': 'Claude-Sonnet-7', // Keep the display name for provider detection
  'Claude-Sonnet-5': 'Claude-Sonnet-5', // Keep the display name for provider detection
  'o3': 'gpt-4o',            // Map to OpenAI equivalent
  'o3-mini': 'gpt-4o-mini',  // Map to OpenAI equivalent
  'o1': 'gpt-4o',            // Changed from gpt-4 to gpt-4o
};

// Function to generate structured solution from AI models
export async function generateText(
  prompt: string,
  modelName: string,
  temperature: number,
  techStack: string = "",
  runId: number = 1,
  forceEnableReasoning?: boolean,
  batchId?: string  // Added batchId parameter for step correlation
): Promise<AIResponse> {
  try {
    // Find the actual model name to use for the API
    const apiModelName = modelMapping[modelName as keyof typeof modelMapping] || modelName;
    
    console.log(`Original model name: ${modelName}, Mapped to: ${apiModelName}, runId: ${runId}`);
    
    // For API calls, we'll use a simplified logic to determine the model name
    let modelNameForAPI = apiModelName;
    
    // For Claude models, we use a specific approach
    if (modelName.includes('Claude') || modelName.includes('claude') || 
        modelName === 'o1' || modelName === 'o3-mini') {
      // Keep the original display name for model provider detection
      modelNameForAPI = modelName;
    }
    
    // Determine if reasoning should be enabled (for OpenAI models)
    const supportsReasoning = 
      modelName === 'GPT-4o' || 
      modelName === 'GPT-4o-mini' || 
      modelNameForAPI === 'gpt-4o' || 
      modelNameForAPI === 'gpt-4o-mini' ||
      modelName === 'o1' || 
      modelName === 'o3' || 
      modelName === 'o3-mini';
    
    // Enable reasoning based on force flag, or fallback to temperature-based heuristic
    const enableReasoning = forceEnableReasoning === true ? true : (supportsReasoning && temperature >= 0.5);
    
    // Make API call to the structured solution endpoint
    console.log(`Making API call to /api/structured-solution with model: ${modelNameForAPI}, runId: ${runId}, enableReasoning: ${enableReasoning}`);
    
    const response = await fetch('/api/structured-solution', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        model: modelNameForAPI,
        temperature,
        techStack,
        runId,
        enableReasoning,
        batchId   // Pass batchId to API for step correlation
      }),
    });

    if (!response.ok) {
      try {
        // Clone the response before trying to parse it as JSON
        const responseClone = response.clone();
        
        // Try to parse the error as JSON first
        const errorData = await response.json().catch(() => null);
        if (errorData && errorData.error) {
          console.error(`Structured solution API call failed with status ${response.status}:`, errorData.error);
          
          // Create a simple solution with the error message
          const errorSolution: AIResponse = {
            title: "API Error",
            description: `There was a problem with the ${modelName} API: ${errorData.error}`,
            fullContent: JSON.stringify({error: errorData.error}),
            metrics: {
              executionTime: "0ms",
              complexity: "O(1)",
              memoryUsage: "0MB",
              lineCount: 0,
              codeQuality: 5
            },
            model: modelName,
            structuredSolution: {
              steps: Array(6).fill({
                title: "API Error",
                description: `There was a problem with the ${modelName} API: ${errorData.error}`,
                metrics: {
                  executionTime: "0ms",
                  complexity: "O(1)",
                  memoryUsage: "0MB",
                  lineCount: 0,
                  codeQuality: 5
                }
              }),
              finalSolution: {
                title: "Error Solution",
                description: `Failed to get a response from the model API. Please try again or select a different model.`,
                metrics: {
                  executionTime: "0ms",
                  complexity: "O(1)",
                  memoryUsage: "0MB",
                  lineCount: 0
                }
              },
              rawContent: JSON.stringify({error: errorData.error})
            }
          };
          
          return errorSolution;
        }
        
        // Handle case where error message isn't structured as expected
        const errorText = await responseClone.text().catch(() => 'No error details available');
        console.error(`Structured solution API call failed with status ${response.status}:`, errorText);
        
        // Create a simple solution with a generic error message
        const genericErrorSolution: AIResponse = {
          title: "API Error",
          description: `There was a problem with the ${modelName} API (status ${response.status})`,
          fullContent: JSON.stringify({error: errorText}),
          metrics: {
            executionTime: "0ms",
            complexity: "O(1)",
            memoryUsage: "0MB",
            lineCount: 0,
            codeQuality: 5
          },
          model: modelName,
          structuredSolution: {
            steps: Array(6).fill({
              title: "API Error",
              description: `There was a problem with the ${modelName} API. Status: ${response.status}`,
              metrics: {
                executionTime: "0ms",
                complexity: "O(1)",
                memoryUsage: "0MB",
                lineCount: 0,
                codeQuality: 5
              }
            }),
            finalSolution: {
              title: "Error Solution",
              description: `Failed to get a response from the model API. Please try again or select a different model.`,
              metrics: {
                executionTime: "0ms",
                complexity: "O(1)",
                memoryUsage: "0MB",
                lineCount: 0
              }
            },
            rawContent: JSON.stringify({error: errorText})
          }
        };
        
        return genericErrorSolution;
      } catch (textError) {
        console.error('Failed to get error text:', textError);
        
        // Fallback error solution when we can't even get error details
        const fallbackErrorSolution: AIResponse = {
          title: "API Error",
          description: `There was a problem with the ${modelName} API`,
          fullContent: JSON.stringify({error: "Unknown error"}),
          metrics: {
            executionTime: "0ms",
            complexity: "O(1)",
            memoryUsage: "0MB",
            lineCount: 0,
            codeQuality: 5
          },
          model: modelName,
          structuredSolution: {
            steps: Array(6).fill({
              title: "API Error",
              description: `There was a problem with the ${modelName} API. Unknown error.`,
              metrics: {
                executionTime: "0ms",
                complexity: "O(1)",
                memoryUsage: "0MB",
                lineCount: 0,
                codeQuality: 5
              }
            }),
            finalSolution: {
              title: "Error Solution",
              description: `Failed to get a response from the model API. Please try again or select a different model.`,
              metrics: {
                executionTime: "0ms",
                complexity: "O(1)",
                memoryUsage: "0MB",
                lineCount: 0
              }
            },
            rawContent: JSON.stringify({error: "Unknown error"})
          }
        };
        
        return fallbackErrorSolution;
      }
    }

    try {
      // Use response.clone() to avoid "body already consumed" errors if there was any previous attempt to read the body
      const responseClone = response.clone();
      const structuredSolution = await responseClone.json();
      
      // Return the first step as the main response (we'll process all steps in the pathway visualizer)
      const firstStep = structuredSolution.steps[0];
      // const finalStep = structuredSolution.finalSolution; // Not needed here
      
      // Determine if reasoning was used (check if reasoningProcess exists)
      const hasReasoning = !!structuredSolution.reasoningProcess;
      
      // Return a response matching the existing format, but with additional data
      return {
        title: firstStep.title,
        description: firstStep.description,
        fullContent: structuredSolution.rawContent,
        metrics: firstStep.metrics,
        model: modelName,
        structuredSolution: structuredSolution, // Include the full structured solution for processing
        hasReasoning: hasReasoning,
        batchId: structuredSolution.batchId || batchId, // Use the returned batchId or the one we passed in
        codeFiles: firstStep.codeFiles
      };
    } catch (jsonError) {
      console.error('Error parsing JSON from API response:', jsonError);
      
      try {
        // Try to get the raw text for debugging
        const responseText = await response.clone().text();
        console.error('Raw API response text:', responseText.substring(0, 200));
      } catch (textError) {
        console.error('Failed to get raw response text:', textError);
      }
      
      throw new Error('Failed to parse API response as JSON');
    }
    
  } catch (error) {
    console.error(`Error generating structured solution with ${modelName}:`, error);
    // Re-throw the error for the caller to handle
    throw error;
  }
}

// Function to get temperature value from intensity setting
export function getTemperatureFromIntensity(intensity: 'low' | 'medium' | 'high'): number {
  switch (intensity) {
    case 'low': 
      return 0.3;
    case 'medium': 
      return 0.5;
    case 'high': 
      return 0.7;
    default: 
      return 0.5;
  }
}

// Add a new function to generate a solution based on a similar solution
export async function generateSolutionFromSimilar(
  prompt: string,
  similarSolution: {
    id: string;
    batchId?: string;
    prompt: string;
    solution: string;
    model: string;
    steps?: any[];
    codeFiles?: any[];
  },
  model: string,
  temperature: number,
  batchId?: string,
  codeSnippets?: Array<{
    id: string;
    filename: string;
    language: string;
    code: string;
    description?: string;
  }>
) {
  try {
    console.log(`Generating solution based on similar solution ${similarSolution.id}`);
    
    // Extract package dependencies from code files
    const packageDependencies = new Set<string>();
    const importStatements = new Set<string>();
    
    // Function to extract imports and dependencies from code
    const extractDependencies = (code: string, filename: string) => {
      // For JavaScript/TypeScript files
      if (filename.endsWith('.js') || filename.endsWith('.jsx') || 
          filename.endsWith('.ts') || filename.endsWith('.tsx')) {
        
        // Extract imports
        const importRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"]/g;
        let match;
        while ((match = importRegex.exec(code)) !== null) {
          const importPath = match[1];
          if (!importPath.startsWith('./') && !importPath.startsWith('../')) {
            // It's an external dependency
            const packageName = importPath.split('/')[0];
            if (packageName) {
              packageDependencies.add(packageName);
            }
          }
          importStatements.add(match[0]);
        }
        
        // For require statements
        const requireRegex = /(?:const|let|var)\s+(?:\w+|\{[^}]*\})\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
        while ((match = requireRegex.exec(code)) !== null) {
          const importPath = match[1];
          if (!importPath.startsWith('./') && !importPath.startsWith('../')) {
            // It's an external dependency
            const packageName = importPath.split('/')[0];
            if (packageName) {
              packageDependencies.add(packageName);
            }
          }
        }
      }
      
      // For package.json files
      if (filename === 'package.json') {
        try {
          const packageJson = JSON.parse(code);
          if (packageJson.dependencies) {
            Object.keys(packageJson.dependencies).forEach(dep => {
              packageDependencies.add(dep);
            });
          }
          if (packageJson.devDependencies) {
            Object.keys(packageJson.devDependencies).forEach(dep => {
              packageDependencies.add(dep);
            });
          }
        } catch (parseError) {
          console.error('Error parsing package.json:', parseError);
        }
      }
    };
    
    // Process all code files
    if (similarSolution.codeFiles && similarSolution.codeFiles.length > 0) {
      similarSolution.codeFiles.forEach(file => {
        if (file.code && file.filename) {
          extractDependencies(file.code, file.filename);
        }
      });
    }
    
    // Fetch other steps' code files if the solution has batch ID
    if (similarSolution.steps && similarSolution.steps.length > 0) {
      similarSolution.steps.forEach(step => {
        if (step.codeFiles && Array.isArray(step.codeFiles)) {
          step.codeFiles.forEach((file: any) => {
            if (file.code && file.filename) {
              extractDependencies(file.code, file.filename);
            }
          });
        }
      });
    }
    
    // Create a modified prompt that includes reference to the similar solution
    const dependenciesList = Array.from(packageDependencies).join(', ');
    
    // Prepare a code samples section with 1-2 key code snippets
    let codeSamples = '';
    if (similarSolution.codeFiles && similarSolution.codeFiles.length > 0) {
      // Pick 1-2 representative files to include as samples
      const sampleFiles = similarSolution.codeFiles
        .filter(file => 
          file.filename && 
          file.code && 
          !file.filename.includes('node_modules') &&
          file.code.length < 1000
        )
        .slice(0, 2);
      
      if (sampleFiles.length > 0) {
        codeSamples = '\nHere are some code samples from the similar solution for reference:\n\n';
        sampleFiles.forEach(file => {
          codeSamples += `\`\`\`${file.language || 'javascript'} - ${file.filename}\n${file.code}\n\`\`\`\n\n`;
        });
      }
    }
    
    // Add user-provided code snippets
    if (codeSnippets && codeSnippets.length > 0) {
      console.log(`Including ${codeSnippets.length} user-provided code snippets in the prompt context`);
      
      // Add section for user-provided snippets
      codeSamples += '\nAdditionally, please incorporate these specific code snippets from my previous projects:\n\n';
      
      codeSnippets.forEach((snippet, index) => {
        codeSamples += `Snippet ${index + 1} - ${snippet.filename}${snippet.description ? ` (${snippet.description})` : ''}:\n`;
        codeSamples += `\`\`\`${snippet.language}\n${snippet.code}\n\`\`\`\n\n`;
      });
      
      codeSamples += "These snippets should be prioritized and adapted to work within the solution.\n";
    }
    
    const contextPrompt = `
I need you to create a new solution for the following request:
"${prompt}"

I found a similar existing solution for:
"${similarSolution.prompt}"

Please use the existing solution as a starting point, but adapt it to meet my specific requirements.
The similar solution had these key elements:
${similarSolution.steps?.length ? `- ${similarSolution.steps.length} steps including: ${similarSolution.steps.map(s => s.title).join(', ')}` : ''}
${similarSolution.codeFiles?.length ? `- Code files: ${similarSolution.codeFiles.map(f => f.filename).join(', ')}` : ''}
${dependenciesList ? `- Dependencies used: ${dependenciesList}` : ''}

${codeSamples}

Maintain a similar structure but adapt the code and explanation to address my specific request.
The original solution was created with ${similarSolution.model}, please improve upon it.
`;
    
    console.log('Using context from similar solution to generate new solution');
    console.log(`Found ${packageDependencies.size} dependencies to include in the context`);
    if (codeSnippets?.length) {
      console.log(`Added ${codeSnippets.length} user-provided code snippets to the context`);
    }
    
    // Call the structured solution API with the enhanced prompt
    const response = await fetch('/api/structured-solution', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: contextPrompt,
        model,
        temperature,
        batchId,
        // Include the reference to the source solution
        metadata: {
          referenceSolutionId: similarSolution.id,
          referenceBatchId: similarSolution.batchId,
          referenceModel: similarSolution.model,
          referenceDependencies: Array.from(packageDependencies),
          snippetsIncluded: codeSnippets?.length || 0,
          snippetIds: codeSnippets?.map(s => s.id) || []
        }
      }),
    });
    
    if (!response.ok) {
      console.error('Error generating solution from similar:', await response.text());
      throw new Error('Failed to generate solution from similar solution');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error in generateSolutionFromSimilar:', error);
    throw error;
  }
}

// Add the basic solution generation function
export async function generateSolution(
  prompt: string,
  model: string,
  temperature: number,
  techStack?: string,
  batchId?: string,
  enableReasoning?: boolean,
  codeSnippets?: Array<{
    id: string;
    filename: string;
    language: string;
    code: string;
    description?: string;
  }>
) {
  try {
    console.log(`Generating solution with model: ${model}, temperature: ${temperature}`);
    
    // Check if we have code snippets to include in the context
    let enhancedPrompt = prompt;
    
    if (codeSnippets && codeSnippets.length > 0) {
      console.log(`Including ${codeSnippets.length} code snippets in the prompt context`);
      
      // Enhance the prompt with code snippets
      enhancedPrompt += "\n\nHere are the code snippets from my previous projects that should be incorporated:\n\n";
      
      codeSnippets.forEach((snippet, index) => {
        enhancedPrompt += `Snippet ${index + 1} - ${snippet.filename}${snippet.description ? ` (${snippet.description})` : ''}:\n`;
        enhancedPrompt += `\`\`\`${snippet.language}\n${snippet.code}\n\`\`\`\n\n`;
      });
      
      enhancedPrompt += "Please use these code snippets as building blocks in your solution. Adapt them as needed to work together and fulfill my requirements.\n";
    }
    
    const response = await fetch('/api/structured-solution', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: enhancedPrompt,
        model,
        temperature,
        techStack,
        batchId,
        enableReasoning,
        metadata: {
          originalPrompt: prompt,
          snippetsIncluded: codeSnippets?.length || 0,
          snippetIds: codeSnippets?.map(s => s.id) || []
        }
      }),
    });
    
    if (!response.ok) {
      console.error('Error generating solution:', await response.text());
      throw new Error('Failed to generate solution');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error in generateSolution:', error);
    throw error;
  }
}

// Add the ensemble solution generation function
export async function generateEnsembleSolution(
  prompt: string,
  ensembleConfig: any[], // Array of model configurations
  temperature: number,
  batchId?: string,
  codeSnippets?: Array<{
    id: string;
    filename: string;
    language: string;
    code: string;
    description?: string;
  }>
) {
  try {
    console.log(`Generating ensemble solution with ${ensembleConfig.length} models`);
    
    // Check if we have code snippets to include in the context
    let enhancedPrompt = prompt;
    
    if (codeSnippets && codeSnippets.length > 0) {
      console.log(`Including ${codeSnippets.length} code snippets in the ensemble prompt context`);
      
      // Enhance the prompt with code snippets
      enhancedPrompt += "\n\nHere are the code snippets from my previous projects that should be incorporated:\n\n";
      
      codeSnippets.forEach((snippet, index) => {
        enhancedPrompt += `Snippet ${index + 1} - ${snippet.filename}${snippet.description ? ` (${snippet.description})` : ''}:\n`;
        enhancedPrompt += `\`\`\`${snippet.language}\n${snippet.code}\n\`\`\`\n\n`;
      });
      
      enhancedPrompt += "Please use these code snippets as building blocks in your solution. Adapt them as needed to work together and fulfill my requirements.\n";
    }
    
    // Call the appropriate API for ensemble generation
    const response = await fetch('/api/ensemble-solution', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: enhancedPrompt,
        temperature,
        batchId,
        models: ensembleConfig,
        metadata: {
          originalPrompt: prompt,
          snippetsIncluded: codeSnippets?.length || 0,
          snippetIds: codeSnippets?.map(s => s.id) || []
        }
      }),
    });
    
    if (!response.ok) {
      console.error('Error generating ensemble solution:', await response.text());
      throw new Error('Failed to generate ensemble solution');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error in generateEnsembleSolution:', error);
    throw error;
  }
}
