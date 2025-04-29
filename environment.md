# Environment Variables for Vercel Deployment

This project requires the following environment variables to be configured in your Vercel project settings.

## Required Environment Variables

### Supabase Configuration
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### API Keys
```
ANTHROPIC_API_KEY=your_anthropic_key
OPENAI_API_KEY=your_openai_key
```

### Sentry Configuration (for error monitoring)
```
SENTRY_DSN=your_sentry_dsn
SENTRY_ORG=your_sentry_org
SENTRY_PROJECT=your_sentry_project
```

### Next.js Configuration
```
NEXT_PUBLIC_VERCEL_URL=${VERCEL_URL}
NEXT_PUBLIC_VERCEL_ENV=${VERCEL_ENV}
```

## Adding Environment Variables to Vercel

1. Go to your Vercel dashboard
2. Select your project
3. Go to the "Settings" tab
4. Navigate to the "Environment Variables" section
5. Add each variable with its corresponding value
6. Select the environments where each variable should be available (Production, Preview, Development)
7. Click "Save" to apply your changes

## Local Development

For local development, you can create a `.env.local` file with these variables. This file should not be committed to version control.

Copy the `.env.example` file to `.env.local` and fill in your specific values.

```bash
cp .env.example .env.local
# Edit .env.local with your values
```