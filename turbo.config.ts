/**
 * Turbopack configuration for Next.js 15
 * See: https://nextjs.org/docs/app/api-reference/next-config-js/turbopack
 */
const turboConfig = {
  // Configure module resolution for better performance
  resolveExtensions: ['.js', '.jsx', '.ts', '.tsx', '.json', '.css'],
  
  // Define module resolution aliases for improved build times
  resolveAlias: {
    // Map common imports to specific paths for faster resolution
    '@components': './components',
    '@lib': './lib',
    '@app': './app',
    '@public': './public',
  }
};

export default turboConfig;