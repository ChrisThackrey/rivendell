import * as Sentry from '@sentry/nextjs';

export function register() {
  // Initialize Sentry for client-side
  Sentry.init({
    dsn: "https://0df6d9a0489a506b87ccc42291b02857@o4509116054437888.ingest.us.sentry.io/4509116059549696",
    
    // Define how likely traces are sampled
    tracesSampleRate: 1,
    
    // Setting this option to true will print useful information to the console while you're setting up Sentry
    debug: false,
    
    // Optional: Configure error replays (if needed)
    // replaysSessionSampleRate: 0.1,
    // replaysOnErrorSampleRate: 1.0,
  });
}