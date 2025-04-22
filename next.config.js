// Basic Next.js configuration
// Avoids Sentry and other complex configurations

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configure images for SVG support
  images: {
    dangerouslyAllowSVG: true,
  },
  
  // Fix code warnings
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Compiler options
  compiler: {
    // Enable SWC compiler features
    styledComponents: false,
    removeConsole: false,
  },
  
  // External packages configuration (moved from experimental)
  serverExternalPackages: [],
  
  // Experimental features
  experimental: {}
}

module.exports = nextConfig