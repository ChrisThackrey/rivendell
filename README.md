# Rivendell - Dev Pathway Visualizer with OpenAI and Anthropic Integration

A Next.js application that visualizes AI model solutions for development tasks using OpenAI and Anthropic APIs.

## Features

- Submit development tasks to multiple AI models in parallel
- Configure ensemble model settings with different temperatures
- Save and load ensemble configurations for reuse
- Add custom model combinations with flexible run settings
- Visualize solution pathways with interactive UI
- Compare different AI approaches to solving the same problem
- Generate final combined solutions from the best parts
- Store and retrieve code files with embedding-based similarity search
- Full test coverage for code file storage and retrieval functionality

## Setup

### Prerequisites

- Node.js (v18+)
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the root directory with your API keys:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   ANTHROPIC_API_KEY=your_anthropic_api_key_here
   ```

   **Note:** If you don't have API keys, the application will fall back to using mock responses for demonstration purposes.

### Running the Application

```bash
npm run dev
```

The application will be available at http://localhost:3000

### Testing

We use Vitest for testing code files functionality:

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage reporting
npm run test:coverage
```

The test suite verifies:
- Code is properly written, embedded, and stored in Supabase
- Code files can be retrieved via Supabase client API calls
- Code syntax is valid and parseable
- JSON accurately parses files back into original code
- Multi-chunk code files can be reconstructed properly

## Usage

1. Enter your development task in the input field
2. Configure the tech stack options
3. Select the AI models and temperature settings for the ensemble
   - Add additional models using the "Add Model" button
   - Save your ensemble configuration for future use
   - Load previously saved ensemble configurations
4. View the generated solution pathways
5. Follow the progression of solutions to the final outcome

## Technologies Used

- Next.js 15 with App Router
- React 19
- OpenAI API
- Anthropic API
- Three.js / React Three Fiber
- Tailwind CSS
- TypeScript

## API Integration

The application uses both OpenAI and Anthropic APIs to generate solutions:

- **OpenAI API**: Used for GPT models like GPT-4o, GPT-4o-mini, etc.
- **Anthropic API**: Used for Claude models like Claude-3-Sonnet, Claude-3-Opus, etc.

## Project Structure

- `app/api/`: API routes for OpenAI and Anthropic
- `app/page.tsx`: Main page component
- `components/`: React components
- `lib/`: Utility functions and services
  - `ai-service.ts`: Integration with AI models
  - `embedding-service.ts`: Embedding generation and storage
  - `ensemble-service.ts`: Ensemble configuration management
  - `tech-stack-service.ts`: Tech stack configuration management
- `supabase/`: SQL scripts for database setup

## Environment Variables

- `OPENAI_API_KEY`: Your OpenAI API key
- `ANTHROPIC_API_KEY`: Your Anthropic API key
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL (if using Supabase)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous key (if using Supabase)
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (if using Supabase)

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.
