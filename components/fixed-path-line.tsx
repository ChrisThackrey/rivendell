"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type PathLineProps = {
  fromId: string;
  toId: string;
  type: "accepted" | "secondary" | "rejected";
  delay?: number;
  isHighlighted?: boolean;
  color?: string;
  onHover?: (fromId: string, toId: string, isHovering: boolean) => void;
  translateYOverride?: number;
  className?: string;
  strokeColor?: string;
  width?: string;
  maxRetries?: number;
  showManipulationControls?: boolean;
};

export default function FixedPathLine({
  fromId,
  toId,
  type,
  delay = 0,
  isHighlighted = false,
  color,
  onHover,
  translateYOverride,
  className = "",
  strokeColor = "stroke-gray-500",
  width = "1.5",
  maxRetries = 5,
  showManipulationControls = false,
}: PathLineProps) {
  const [path, setPath] = useState<string>("");
  const [svgPosition, setSvgPosition] = useState({
    left: 0,
    top: 0,
    width: 500,
    height: 500,
  });
  const [elementsMissing, setElementsMissing] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  
  const pathRef = useRef("");
  const animationFrameRef = useRef<number | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const observersRef = useRef<MutationObserver[]>([]);
  const retryAttemptsRef = useRef(0);
  const maxRetriesRef = useRef(maxRetries);
  const debugModeRef = useRef(false);
  const calculatePathRef = useRef<() => string>(() => "");
  const initialRenderRef = useRef(true);
  
  // Toggle debug mode
  const toggleDebugMode = () => {
    setDebugMode(!debugMode);
    debugModeRef.current = !debugMode;
    
    // Toggle debug class on body
    if (!debugMode) {
      document.body.classList.add('debug-connections');
    } else {
      document.body.classList.remove('debug-connections');
    }
  };

  // Add required CSS styles
  useEffect(() => {
    if (typeof document === "undefined") return;
    
    const styleId = 'connection-point-styles';
    if (!document.getElementById(styleId)) {
      const styleEl = document.createElement('style');
      styleEl.id = styleId;
      styleEl.textContent = `
        .connection-point-top, .connection-point-bottom {
          position: absolute;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          z-index: 5;
          pointer-events: none;
          opacity: 0; /* Invisible by default */
        }
        .connection-point-top {
          top: 0;
          left: 50%;
          transform: translate(-50%, -50%);
          background-color: blue; /* For debugging */
        }
        .connection-point-bottom {
          bottom: 0;
          left: 50%;
          transform: translate(-50%, 50%);
          background-color: red; /* For debugging */
        }
        .endpoint-marker {
          position: absolute;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          z-index: 6;
          pointer-events: none;
          opacity: 0; /* Invisible by default */
        }
        .endpoint-marker-top {
          top: 0;
          left: 50%;
          transform: translate(-50%, -50%);
          background-color: rgba(0, 0, 255, 0.5); /* For debugging */
        }
        .endpoint-marker-bottom {
          bottom: 0;
          left: 50%;
          transform: translate(-50%, 50%);
          background-color: rgba(255, 0, 0, 0.5); /* For debugging */
        }
        
        /* Show the points in dev environment */
        .debug-connections .connection-point-top,
        .debug-connections .connection-point-bottom,
        .debug-connections .endpoint-marker {
          opacity: 0.5;
        }
      `;
      document.head.appendChild(styleEl);
    }
    
    return () => {
      document.body.classList.remove('debug-connections');
    };
  }, []);

  // Helper function to ensure connection points exist
  const ensureConnectionPoints = () => {
    if (typeof window === "undefined" || typeof document === "undefined")
      return false;

    const fromElement = document.getElementById(fromId);
    const toElement = document.getElementById(toId);

    if (!fromElement || !toElement) {
      if (retryAttemptsRef.current < maxRetriesRef.current) {
        console.log(`Elements not found yet, will retry: fromId=${fromId}, toId=${toId}`);
        setElementsMissing(true);
        return false;
      }
      
      console.warn(`Cannot create connection points - missing elements: fromId=${fromId}, toId=${toId}`);
      setElementsMissing(true);
      return false;
    }

    // Elements found - reset missing flag
    setElementsMissing(false);

    // Ensure elements have relative positioning
    if (window.getComputedStyle(fromElement).position === 'static') {
      fromElement.style.position = 'relative';
    }
    if (window.getComputedStyle(toElement).position === 'static') {
      toElement.style.position = 'relative';
    }

    // Check if connection points already exist
    const fromBottomPoint = document.getElementById(`${fromId}-bottom`);
    const toTopPoint = document.getElementById(`${toId}-top`);

    // Create bottom point for FROM element if needed
    if (!fromBottomPoint) {
      const bottomPoint = document.createElement("div");
      bottomPoint.id = `${fromId}-bottom`;
      bottomPoint.className = "connection-point-bottom";
      bottomPoint.setAttribute("data-connection-id", `${fromId}-bottom`);
      fromElement.appendChild(bottomPoint);
      console.log(`Created bottom connection point for ${fromId}`);
    }

    // Create top point for TO element if needed
    if (!toTopPoint) {
      const topPoint = document.createElement("div");
      topPoint.id = `${toId}-top`;
      topPoint.className = "connection-point-top";
      topPoint.setAttribute("data-connection-id", `${toId}-top`);
      toElement.appendChild(topPoint);
      console.log(`Created top connection point for ${toId}`);
    }

    return !!document.getElementById(`${fromId}-bottom`) && !!document.getElementById(`${toId}-top`);
  };

  // Calculate path between elements
  const calculatePath = () => {
    if (typeof window === "undefined" || typeof document === "undefined")
      return "";

    // First ensure connection points exist
    ensureConnectionPoints();

    // Find elements
    const fromElement = document.getElementById(fromId);
    const toElement = document.getElementById(toId);

    if (!fromElement || !toElement) {
      console.warn(`Source or target element not found: fromId=${fromId}, toId=${toId}`);
      return "";
    }

    // Get the container for calculating relative positions
    const pathwayContainer = document.querySelector(".pathway-container") || document.body;
    const containerRect = pathwayContainer.getBoundingClientRect();

    // Get element boundaries
    const fromRect = fromElement.getBoundingClientRect();
    const toRect = toElement.getBoundingClientRect();

    // Use precise bottom center of FROM element and top center of TO element
    const fromX = fromRect.left - containerRect.left + fromRect.width / 2;
    const fromY = fromRect.bottom - containerRect.top;
    const toX = toRect.left - containerRect.left + toRect.width / 2;
    const toY = toRect.top - containerRect.top;

    return calculatePathFromPoints(fromX, fromY, toX, toY);
  };

  // Assign calculatePath to calculatePathRef for external access
  calculatePathRef.current = calculatePath;

  // Helper function to calculate the path between two points
  const calculatePathFromPoints = (
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
  ) => {
    // Calculate distances to determine path style
    const verticalDistance = Math.abs(toY - fromY);
    const horizontalDistance = Math.abs(toX - fromX);
    
    // Corner radius for smooth curves
    const cornerRadius = Math.min(20, verticalDistance / 4, horizontalDistance / 4);

    // Calculate midpoint Y coordinate
    const midY = fromY + (toY - fromY) / 2;

    // IMPORTANT FIX: Use much larger SVG container with extra padding to prevent clipping
    const padding = 300; // Much larger padding all around
    
    // Calculate the min/max points with generous padding
    const minX = Math.min(fromX, toX) - padding;
    const minY = Math.min(fromY, toY) - padding;
    const maxX = Math.max(fromX, toX) + padding;
    const maxY = Math.max(fromY, toY) + padding;

    // Create an SVG that is much larger than needed to ensure path is fully visible
    const svgWidth = maxX - minX + (padding * 2);
    const svgHeight = maxY - minY + (padding * 2);

    // Update SVG container position
    setSvgPosition({
      left: minX - padding,
      top: minY - padding,
      width: svgWidth,
      height: svgHeight,
    });

    // Calculate relative coordinates inside the SVG
    const relFromX = fromX - (minX - padding);
    const relFromY = fromY - (minY - padding);
    const relToX = toX - (minX - padding);
    const relToY = toY - (minY - padding);
    const relMidY = midY - (minY - padding);

    // Start path data definition
    let pathData = `M ${relFromX} ${relFromY}`;

    // Path drawing logic based on alignment
    if (Math.abs(relFromX - relToX) < 30 && verticalDistance < 150) {
      // Case 1: Points nearly aligned vertically - simple straight line
      pathData += ` L ${relToX} ${relToY}`;
    } 
    else if (verticalDistance < 50) {
      // Case 2: Small vertical distance - simple curve
      pathData += ` C ${relFromX} ${relFromY + verticalDistance/2}, ${relToX} ${relToY - verticalDistance/2}, ${relToX} ${relToY}`;
    }
    else {
      // Case 3: Default case - pipe-like path with rounded corners
      // Vertical segment down to midpoint
      pathData += ` L ${relFromX} ${relMidY - cornerRadius}`;

      // First corner and horizontal segment
      if (relFromX < relToX) {
        // Going right
        pathData += ` Q ${relFromX} ${relMidY} ${relFromX + cornerRadius} ${relMidY}`;
        pathData += ` L ${relToX - cornerRadius} ${relMidY}`;
        pathData += ` Q ${relToX} ${relMidY} ${relToX} ${relMidY + cornerRadius}`;
      } else {
        // Going left
        pathData += ` Q ${relFromX} ${relMidY} ${relFromX - cornerRadius} ${relMidY}`;
        pathData += ` L ${relToX + cornerRadius} ${relMidY}`;
        pathData += ` Q ${relToX} ${relMidY} ${relToX} ${relMidY + cornerRadius}`;
      }

      // Final vertical segment to target
      pathData += ` L ${relToX} ${relToY}`;
    }

    // Only update path state if it's changed
    if (pathRef.current !== pathData) {
      console.log(`Path updated: ${pathData.substring(0, 30)}...`);
      console.log(`SVG dimensions: ${svgWidth}x${svgHeight}, position: (${minX-padding}, ${minY-padding})`);
      
      pathRef.current = pathData;
      setPath(pathData);
    }

    return pathData;
  };

  // Force recalculation with debouncing
  const forceRecalculation = () => {
    if (typeof window === "undefined") return;

    // Clear existing timers
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    // Set a debounce to avoid too frequent updates
    debounceTimerRef.current = setTimeout(() => {
      animationFrameRef.current = requestAnimationFrame(() => {
        calculatePath();
        animationFrameRef.current = null;
      });
    }, 50);
  };

  // Main effect for setup and cleanup
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Clean up function
    const cleanup = () => {
      observersRef.current.forEach(observer => observer.disconnect());
      observersRef.current = [];
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
      window.removeEventListener("resize", forceRecalculation);
    };

    // Cleanup connection points (useful for unmounting)
    const cleanupConnectionPoints = () => {
      if (typeof document === "undefined") return;
      
      const selectors = [
        `#${fromId}-bottom`,
        `#${toId}-top`
      ];
      
      selectors.forEach(selector => {
        const element = document.querySelector(selector);
        if (element && element.parentNode) {
          element.parentNode.removeChild(element);
        }
      });
    };

    // Setup connection with retry functionality
    const setupConnection = () => {
      retryAttemptsRef.current = 0;
      
      const attemptSetup = () => {
        if (ensureConnectionPoints()) {
          // Success - calculate path
          calculatePath();
          
          // Force a second calculation after layout settles
          setTimeout(forceRecalculation, 500);
        } else {
          // Failed - retry with backoff
          retryAttemptsRef.current++;
          
          if (retryAttemptsRef.current <= maxRetriesRef.current) {
            const retryDelay = Math.min(100 * Math.pow(1.5, retryAttemptsRef.current), 2000);
            
            setTimeout(() => {
              attemptSetup();
            }, retryDelay);
          }
        }
      };
      
      setTimeout(() => {
        attemptSetup();
      }, delay * 1000); // Respect any animation delay
    };

    // Initial setup after delay
    setupConnection();
    
    // Set up DOM observation for relevant elements
    const fromElement = document.getElementById(fromId);
    const toElement = document.getElementById(toId);
    
    if (fromElement && toElement) {
      // Function to create and attach observer
      const createObserver = (element: Element) => {
        const observer = new MutationObserver(() => {
          if (!animationFrameRef.current) {
            animationFrameRef.current = requestAnimationFrame(() => {
              calculatePath();
              animationFrameRef.current = null;
            });
          }
        });
        
        observer.observe(element, {
          attributes: true,
          childList: false,
          subtree: false,
          attributeFilter: ["style", "class"]
        });
        
        observersRef.current.push(observer);
      };
      
      // Observe both from and to elements
      createObserver(fromElement);
      createObserver(toElement);
      
      // Add global handlers
      window.addEventListener("resize", forceRecalculation, { passive: true });
      
      // Fix: If we're in an initial render, schedule extra recalculations
      if (initialRenderRef.current) {
        initialRenderRef.current = false;
        
        // Multiple recalculations after the animation completes
        setTimeout(() => forceRecalculation(), (delay * 1000) + 800);
        setTimeout(() => forceRecalculation(), (delay * 1000) + 1200);
        setTimeout(() => forceRecalculation(), (delay * 1000) + 2000);
      }
    }
    
    // Cleanup on unmount
    return () => {
      cleanup();
      cleanupConnectionPoints();
    };
  }, [fromId, toId, delay]);

  // Skip rendering if elements are missing after all retries
  if (elementsMissing && retryAttemptsRef.current >= maxRetriesRef.current) return null;
  
  // Skip rendering if path is not calculated yet
  if (!path) return null;

  // Determine stroke based on type
  let stroke = color || "#93C5FD"; // Default blue for "secondary"
  let strokeWidth = 2;

  if (type === "accepted" && !color) {
    stroke = "#4ADE80"; // Green for "accepted"
  } else if (type === "rejected" && !color) {
    stroke = "#94A3B8"; // Gray for "rejected"
  }

  // Increase width and change color when highlighted
  if (isHighlighted) {
    stroke = "#D946EF"; // Highlighted in fuchsia
    strokeWidth = 3;
  }

  return (
    <>
      {/* SVG container for the path */}
      <div
        className={cn("absolute pointer-events-none", className)}
        style={{
          left: svgPosition.left + "px",
          top: svgPosition.top + "px",
          width: svgPosition.width + "px",
          height: svgPosition.height + "px",
          overflow: "visible", // Important - allows paths to render outside SVG boundaries
        }}
        data-component="path-line-container"
      >
        <svg
          className="w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
          style={{
            strokeLinecap: "round",
            strokeLinejoin: "round",
            fill: "none",
            overflow: "visible", // Important - allows paths to render outside SVG boundaries
          }}
        >
          <motion.path
            d={path}
            fill="none"
            strokeWidth={strokeWidth}
            stroke={stroke}
            strokeOpacity={isHighlighted ? 0.9 : 0.7}
            strokeDasharray={type === "rejected" ? "5,5" : "none"}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ 
              duration: 0.8, 
              delay: delay + 0.2,
              onComplete: () => {
                // Fix: Recalculate path after animation completes
                setTimeout(forceRecalculation, 100);
              }
            }}
            onMouseEnter={() => onHover && onHover(fromId, toId, true)}
            onMouseLeave={() => onHover && onHover(fromId, toId, false)}
            style={{ pointerEvents: "stroke" }}
            data-from-id={fromId}
            data-to-id={toId}
            data-path-type={type}
          />
        </svg>
      </div>
      
      {/* Debug controls */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 right-4 z-50 bg-gray-800 text-white p-2 rounded-md shadow-md">
          <button 
            onClick={toggleDebugMode} 
            className="px-3 py-1 text-xs rounded bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            {debugMode ? 'Hide Connection Points' : 'Show Connection Points'}
          </button>
        </div>
      )}
      
      {/* Control buttons for development/debugging */}
      {showManipulationControls && (
        <div className="fixed top-4 right-4 z-50 bg-gray-800 text-white p-2 rounded-md shadow-md">
          <button 
            onClick={() => {
              retryAttemptsRef.current = 0;
              if (calculatePathRef.current) calculatePathRef.current();
            }} 
            className="px-3 py-1 text-xs rounded bg-green-600 hover:bg-green-700 transition-colors mr-2"
          >
            Reset Connection
          </button>
          <button
            onClick={() => calculatePathRef.current && calculatePathRef.current()} 
            className="px-3 py-1 text-xs rounded bg-yellow-600 hover:bg-yellow-700 transition-colors"
          >
            Recalculate Path
          </button>
        </div>
      )}
    </>
  );
}