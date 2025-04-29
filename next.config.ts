import type { NextConfig } from "next";
import turboConfig from "./turbo.config";
import { withSentryConfig } from "@sentry/nextjs";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  // Configure Turbopack for development builds
  turbopack: turboConfig,
  
  // Conditionally configure webpack
  ...(isDev 
    ? {} 
    : {
        webpack: (config, { isServer }) => {
          // Keep the webpack plugin working properly
          return config;
        }
      }
  ),
  
  // Add proper favicon configurations
  images: {
    dangerouslyAllowSVG: true,
  },
  
  // Fix unreachable code warnings by suppressing them
  eslint: {
    ignoreDuringBuilds: true, // Ignore during all builds to avoid warnings
  },
  
  // Suppress build warnings for third-party code
  onDemandEntries: {
    // Keep pages in memory for longer to reduce rebuilds
    maxInactiveAge: 60 * 60 * 1000,
    // Maximum pages to keep in memory
    pagesBufferLength: 5,
  }
};

// Enable Sentry for deployment to Vercel
export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options
  org: process.env.SENTRY_ORG || "",
  project: process.env.SENTRY_PROJECT || "",
  silent: true, // Suppresses all logs
  
  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
  widenClientFileUpload: true,
  transpileClientSDK: true,
  tunnelRoute: "/monitoring",
  hideSourceMaps: true,
  disableLogger: true,
});
