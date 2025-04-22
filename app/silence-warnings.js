// This script silences specific browser console warnings
// Execute in client side components

export function silenceWarnings() {
  if (typeof window !== 'undefined') {
    // Store the original console.warn
    const originalWarn = console.warn;
    
    // Override console.warn to filter out specific warnings
    console.warn = function(...args) {
      // Filter out unreachable code warnings from node_modules
      if (args[0] && typeof args[0] === 'string' && 
          (args[0].includes('unreachable code after return statement') || 
           args[0].includes('node_modules'))) {
        return; // Suppress the warning
      }
      
      // Pass through other warnings
      originalWarn.apply(console, args);
    };
  }
}