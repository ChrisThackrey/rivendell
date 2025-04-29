"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// CSS styles for connection points
const connectionPointStyles = `
  .debug-connections .connection-point {
    display: block !important;
    opacity: 0.7 !important;
  }
  
  .connection-point {
    position: absolute;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    transform: translate(-50%, -50%);
    z-index: 100;
    opacity: 0;
    pointer-events: none;
  }
  
  .connection-point-top {
    background-color: blue;
    top: 0;
  }
  
  .connection-point-bottom {
    background-color: red;
    bottom: 0;
  }
  
  .path-endpoint {
    position: relative;
  }
`;

// Helper function to ensure connection points exist on elements
const ensureConnectionPoints = (element: HTMLElement | null, classPrefix: string) => {
  if (!element) return null;
  
  // Make sure the element has position relative for absolute positioning to work
  if (window.getComputedStyle(element).position === 'static') {
    element.style.position = 'relative';
  }
  
  // Check if we already have connection points
  let topPoint = element.querySelector(`.${classPrefix}-connection-point-top`);
  let bottomPoint = element.querySelector(`.${classPrefix}-connection-point-bottom`);
  
  // Create top connection point if needed
  if (!topPoint) {
    topPoint = document.createElement('div');
    topPoint.className = `connection-point connection-point-top ${classPrefix}-connection-point-top`;
    (topPoint as HTMLElement).style.left = '50%';
    (topPoint as HTMLElement).style.top = '0';
    element.appendChild(topPoint);
  }
  
  // Create bottom connection point if needed
  if (!bottomPoint) {
    bottomPoint = document.createElement('div');
    bottomPoint.className = `connection-point connection-point-bottom ${classPrefix}-connection-point-bottom`;
    (bottomPoint as HTMLElement).style.left = '50%';
    (bottomPoint as HTMLElement).style.bottom = '0';
    element.appendChild(bottomPoint);
  }
  
  return {
    top: topPoint as HTMLElement,
    bottom: bottomPoint as HTMLElement
  };
};

// Add style tag to document head
const injectStyles = () => {
  if (!document.getElementById('connection-point-styles')) {
    const styleTag = document.createElement('style');
    styleTag.id = 'connection-point-styles';
    styleTag.textContent = connectionPointStyles;
    document.head.appendChild(styleTag);
  }
};

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

export default function PathLine({
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
  const [translateY, setTranslateY] = useState(
    translateYOverride !== undefined ? translateYOverride : -216,
  );
  const [elementsMissing, setElementsMissing] = useState(false);
  const pathRef = useRef("");
  const animationFrameRef = useRef<number | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const periodicUpdateRef = useRef<NodeJS.Timeout | null>(null);
  const observersRef = useRef<MutationObserver[]>([]);
  const linesContainerRef = useRef<HTMLDivElement>(null);
  const retryAttemptsRef = useRef(0);
  const maxRetriesRef = useRef(maxRetries);
  const debugModeRef = useRef(false);
  const calculatePathRef = useRef<() => string>(() => "");

  // Add debug mode state
  const [debugMode, setDebugMode] = useState(false);
  
  // Function to toggle debug mode
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

  // Inject CSS styles on component mount
  useEffect(() => {
    injectStyles();
    
    // Cleanup on unmount
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
      // Elements are missing, but don't warn if we're still within retry attempts
      if (retryAttemptsRef.current < maxRetriesRef.current) {
        console.log(
          `Elements not found yet, will retry: fromId=${fromId}, toId=${toId} (attempt ${retryAttemptsRef.current + 1}/${maxRetriesRef.current})`,
        );
        setElementsMissing(true);
        return false;
      }
      
      console.warn(
        `Cannot create connection points - missing elements: fromId=${fromId} (${!!fromElement}), toId=${toId} (${!!toElement})`,
      );
      setElementsMissing(true);
      return false;
    }

    // Reset the missing flag if elements are found
    setElementsMissing(false);

    // Add required CSS if not already in document
    if (!document.getElementById('connection-point-styles')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'connection-point-styles';
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

    // We still set step index for debugging purposes, but it won't affect translation
    if (!fromElement.hasAttribute("data-step-index")) {
      // Try to infer step from ID
      if (fromId.includes("step")) {
        const stepMatch = fromId.match(/step-(\d+)/);
        if (stepMatch && stepMatch[1]) {
          const stepIndex = stepMatch[1];
          console.log(
            `Setting missing data-step-index=${stepIndex} on element ${fromId} (for logging only)`,
          );
          fromElement.setAttribute("data-step-index", stepIndex);
        }
      }
    }

    // Debug log to help understand the DOM structure
    console.log(`Creating connection from ${fromId} BOTTOM to ${toId} TOP`);
    console.log(
      `From element has data-step-index: ${fromElement.getAttribute("data-step-index") || "not set"}`,
    );

    // Make sure elements have relative positioning for absolute positioning to work
    if (window.getComputedStyle(fromElement).position === 'static') {
      fromElement.style.position = 'relative';
    }
    if (window.getComputedStyle(toElement).position === 'static') {
      toElement.style.position = 'relative';
    }

    // Check if connection points already exist
    const fromTopPoint = document.getElementById(`${fromId}-top`);
    const fromBottomPoint = document.getElementById(`${fromId}-bottom`);
    const toTopPoint = document.getElementById(`${toId}-top`);
    const toBottomPoint = document.getElementById(`${toId}-bottom`);

    // Check if visual markers exist
    const fromTopMarker = document.getElementById(`${fromId}-top-marker`);
    const fromBottomMarker = document.getElementById(`${fromId}-bottom-marker`);
    const toTopMarker = document.getElementById(`${toId}-top-marker`);
    const toBottomMarker = document.getElementById(`${toId}-bottom-marker`);

    // Create missing connection points (if any)
    if (!fromTopPoint) {
      const topPoint = document.createElement("div");
      topPoint.id = `${fromId}-top`;
      topPoint.className = "connection-point-top";
      topPoint.setAttribute("data-connection-id", `${fromId}-top`);
      fromElement.appendChild(topPoint);
      console.log(`Created top connection point for ${fromId}`);
    }

    if (!fromBottomPoint) {
      const bottomPoint = document.createElement("div");
      bottomPoint.id = `${fromId}-bottom`;
      bottomPoint.className = "connection-point-bottom";
      bottomPoint.setAttribute("data-connection-id", `${fromId}-bottom`);
      fromElement.appendChild(bottomPoint);
      console.log(
        `Created bottom connection point for ${fromId} - THIS IS THE LINE START POINT`,
      );
    }

    if (!toTopPoint) {
      const topPoint = document.createElement("div");
      topPoint.id = `${toId}-top`;
      topPoint.className = "connection-point-top";
      topPoint.setAttribute("data-connection-id", `${toId}-top`);
      toElement.appendChild(topPoint);
      console.log(
        `Created top connection point for ${toId} - THIS IS THE LINE END POINT`,
      );
    }

    if (!toBottomPoint) {
      const bottomPoint = document.createElement("div");
      bottomPoint.id = `${toId}-bottom`;
      bottomPoint.className = "connection-point-bottom";
      bottomPoint.setAttribute("data-connection-id", `${toId}-bottom`);
      toElement.appendChild(bottomPoint);
      console.log(`Created bottom connection point for ${toId}`);
    }

    // Also create the visual markers if missing
    if (!fromTopMarker) {
      const marker = document.createElement("div");
      marker.id = `${fromId}-top-marker`;
      marker.className = "endpoint-marker endpoint-marker-top";
      marker.setAttribute("data-marker-id", `${fromId}-top-marker`);
      fromElement.appendChild(marker);
    }

    if (!fromBottomMarker) {
      const marker = document.createElement("div");
      marker.id = `${fromId}-bottom-marker`;
      marker.className = "endpoint-marker endpoint-marker-bottom";
      marker.setAttribute("data-marker-id", `${fromId}-bottom-marker`);
      fromElement.appendChild(marker);
    }

    if (!toTopMarker) {
      const marker = document.createElement("div");
      marker.id = `${toId}-top-marker`;
      marker.className = "endpoint-marker endpoint-marker-top";
      marker.setAttribute("data-marker-id", `${toId}-top-marker`);
      toElement.appendChild(marker);
    }

    if (!toBottomMarker) {
      const marker = document.createElement("div");
      marker.id = `${toId}-bottom-marker`;
      marker.className = "endpoint-marker endpoint-marker-bottom";
      marker.setAttribute("data-marker-id", `${toId}-bottom-marker`);
      toElement.appendChild(marker);
    }

    // Verify connection points exist and have proper dimensions
    return true;
  };

  // Calculate path between elements with scroll position consideration
  const calculatePath = () => {
    if (typeof window === "undefined" || typeof document === "undefined")
      return "";

    // First ensure connection points exist
    if (!ensureConnectionPoints()) {
      return ""; // Return empty if we can't create connection points
    }

    // Find the source and target card elements
    const fromElement = document.getElementById(fromId);
    const toElement = document.getElementById(toId);

    if (!fromElement || !toElement) {
      console.warn(
        `Source or target element not found: fromId=${fromId}, toId=${toId}`,
      );
      return "";
    }

    // Calculate positions based on the cards themselves
    const fromRect = fromElement.getBoundingClientRect();
    const toRect = toElement.getBoundingClientRect();

    // Get the bounding rect of a common parent container
    // Find the nearest common scrollable container
    const pathwayContainer =
      document.querySelector(".pathway-container") || document.body;
    const containerRect = pathwayContainer.getBoundingClientRect();

    // Calculate the center points of the cards relative to the container
    const fromCenterX = fromRect.left - containerRect.left + fromRect.width / 2;
    const toCenterX = toRect.left - containerRect.left + toRect.width / 2;

    // Calculate the connection points at the exact edges of the cards
    // FROM point: bottom center of the source card
    const fromX = fromCenterX;
    const fromY = fromRect.bottom - containerRect.top;

    // TO point: top center of the target card
    const toX = toCenterX;
    const toY = toRect.top - containerRect.top;

    console.log(`Calculated path: from (${fromX}, ${fromY}) to (${toX}, ${toY})`);

    // Calculate SVG container position and dimensions with extra padding
    // Use generous padding to ensure the path is fully visible
    const paddingX = Math.max(fromRect.width, toRect.width);
    const paddingY = Math.abs(toY - fromY) * 0.2; // 20% of the vertical distance as padding
    
    const minX = Math.min(fromX, toX) - paddingX;
    const minY = Math.min(fromY, toY) - paddingY;
    const maxX = Math.max(fromX, toX) + paddingX;
    const maxY = Math.max(fromY, toY) + paddingY;

    const svgWidth = maxX - minX + 2 * paddingX;
    const svgHeight = maxY - minY + 2 * paddingY;

    // Use fixed position instead of absolute to avoid parent container transforms
    // Apply translateY directly to this position to ensure consistent placement
    setSvgPosition({
      left: minX - paddingX,
      top: minY - paddingY + (translateYOverride !== undefined ? translateYOverride : 0),
      width: svgWidth,
      height: svgHeight,
    });

    // Create path data relative to the SVG container
    const relFromX = fromX - (minX - paddingX);
    const relFromY = fromY - (minY - paddingY);
    const relToX = toX - (minX - paddingX);
    const relToY = toY - (minY - paddingY);
    
    // Calculate midpoint for the curve
    const midY = relFromY + (relToY - relFromY) / 2;

    // Calculate the vertical distance between points to determine path style
    const verticalDistance = Math.abs(relToY - relFromY);
    const horizontalDistance = Math.abs(relToX - relFromX);
    
    // Corner radius for smooth curves
    const cornerRadius = Math.min(20, verticalDistance / 4, horizontalDistance / 4);

    // Start path at the from point
    let pathData = `M ${relFromX} ${relFromY}`;

    // Determine the appropriate path style without changing the shape
    if (Math.abs(relFromX - relToX) < 30 && verticalDistance < 150) {
      // Simple vertical path with no corners needed
      pathData += ` L ${relToX} ${relToY}`;
    } 
    // If the vertical distance is small, use a simple curve
    else if (verticalDistance < 50) {
      // Simple cubic bezier curve
      pathData += ` C ${relFromX} ${relFromY + verticalDistance/2}, ${relToX} ${relToY - verticalDistance/2}, ${relToX} ${relToY}`;
    }
    // Default case: pipe-like path with corners
    else {
      // Go down vertically to the midpoint with some buffer
      pathData += ` L ${relFromX} ${midY - cornerRadius}`;

      // First corner
      if (relFromX < relToX) {
        // Going right
        pathData += ` Q ${relFromX} ${midY} ${relFromX + cornerRadius} ${midY}`;
        // Horizontal segment
        pathData += ` L ${relToX - cornerRadius} ${midY}`;
        // Second corner
        pathData += ` Q ${relToX} ${midY} ${relToX} ${midY + cornerRadius}`;
      } else {
        // Going left
        pathData += ` Q ${relFromX} ${midY} ${relFromX - cornerRadius} ${midY}`;
        // Horizontal segment
        pathData += ` L ${relToX + cornerRadius} ${midY}`;
        // Second corner
        pathData += ` Q ${relToX} ${midY} ${relToX} ${midY + cornerRadius}`;
      }

      // Final vertical segment to the target
      pathData += ` L ${relToX} ${relToY}`;
    }

    // Only update path if it's changed to prevent unnecessary re-renders
    if (pathRef.current !== pathData) {
      pathRef.current = pathData;
      setPath(pathData);
    }

    return pathData;
  };

  // Assign calculatePath to calculatePathRef
  calculatePathRef.current = calculatePath;

  // Force recalculation with debouncing
  const forceRecalculation = () => {
    if (typeof window === "undefined" || typeof document === "undefined")
      return;

    // Clear existing timers
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    // Set a short debounce to allow DOM to stabilize
    debounceTimerRef.current = setTimeout(() => {
      animationFrameRef.current = requestAnimationFrame(() => {
        calculatePath();
        animationFrameRef.current = null;
      });
    }, 50);
  };

  // Find all scrollable parents of an element
  const findScrollableParents = (element: Element | null): Element[] => {
    const scrollableParents: Element[] = [];

    if (!element) return scrollableParents;

    let parent = element.parentElement;

    while (parent) {
      const style = window.getComputedStyle(parent);
      const overflow =
        style.getPropertyValue("overflow") +
        style.getPropertyValue("overflow-y") +
        style.getPropertyValue("overflow-x");

      if (overflow.includes("auto") || overflow.includes("scroll")) {
        scrollableParents.push(parent);
      }

      parent = parent.parentElement;
    }

    return scrollableParents;
  };

  useEffect(() => {
    // Skip DOM operations during SSR
    if (typeof window === "undefined" || typeof document === "undefined")
      return;

    // Clean up any existing observers and timers
    const cleanup = () => {
      observersRef.current.forEach((observer) => observer.disconnect());
      observersRef.current = [];

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

      if (periodicUpdateRef.current) {
        clearInterval(periodicUpdateRef.current);
        periodicUpdateRef.current = null;
      }

      window.removeEventListener("resize", forceRecalculation);
      window.removeEventListener("scroll", forceRecalculation, true);
      document.removeEventListener("pathway-scroll-end", forceRecalculation);
      document.removeEventListener("pathway-resize", forceRecalculation);
      document.removeEventListener("pathway-dom-change", forceRecalculation);
    };

    // Add a function to clean up connection points from the DOM
    const cleanupConnectionPoints = () => {
      // Clean up connection points to prevent DOM pollution
      if (typeof document !== "undefined" && typeof window !== "undefined" && typeof window.CSS !== "undefined" && typeof window.CSS.escape === "function") {
        const pointSelectors = [
          `#${window.CSS.escape(fromId)}-top`,
          `#${window.CSS.escape(fromId)}-bottom`,
          `#${window.CSS.escape(toId)}-top`,
          `#${window.CSS.escape(toId)}-bottom`,
          `#${window.CSS.escape(fromId)}-top-marker`,
          `#${window.CSS.escape(fromId)}-bottom-marker`,
          `#${window.CSS.escape(toId)}-top-marker`,
          `#${window.CSS.escape(toId)}-bottom-marker`
        ];
        pointSelectors.forEach(selector => {
          const element = document.querySelector(selector);
          if (element && element.parentNode) {
            element.parentNode.removeChild(element);
          }
        });
      }
    };

    // Initial cleanup
    cleanup();

    // Function to try creating connection points with retry logic
    const setupConnectionWithRetry = () => {
      // Reset retry counter
      retryAttemptsRef.current = 0;
      
      // Initial attempt
      if (ensureConnectionPoints()) {
        // Success - calculate path
        calculatePath();
        calculateTranslateY();
        
        // Force a second calculation after a short delay
        setTimeout(() => {
          forceRecalculation();
        }, 300);
      } else {
        // Failed - set up retry mechanism
        const attemptRetry = () => {
          retryAttemptsRef.current++;
          
          if (retryAttemptsRef.current <= maxRetriesRef.current) {
            console.log(`Retry attempt ${retryAttemptsRef.current}/${maxRetriesRef.current} for path ${fromId} -> ${toId}`);
            
            // Exponential backoff: wait longer between attempts
            const retryDelay = Math.min(100 * Math.pow(1.5, retryAttemptsRef.current), 2000);
            
            setTimeout(() => {
              if (ensureConnectionPoints()) {
                // Success!
                calculatePath();
                calculateTranslateY();
                setTimeout(forceRecalculation, 100);
              } else {
                // Still not found, try again
                attemptRetry();
              }
            }, retryDelay);
          } else {
            console.warn(`Max retries (${maxRetriesRef.current}) exceeded for ${fromId} -> ${toId}`);
          }
        };
        
        // Start retry process
        attemptRetry();
      }
    };

    // Calculate appropriate translation value based on step index
    const calculateTranslateY = () => {
      // Skip if an override is provided via props
      if (translateYOverride !== undefined) {
        console.log(
          `Using override translateY: ${translateYOverride} for ${fromId} -> ${toId}`,
        );
        setTranslateY(translateYOverride);
        return;
      }

      // Use consistent -216 translation for all steps as requested
      const yTranslation = -216;

      // Get element info for logging purposes only
      const fromElement = document.getElementById(fromId);
      const toElement = document.getElementById(toId);

      if (fromElement && toElement) {
        // Try to get step index directly from the element (for logging only)
        let fromStepIndex = fromElement.getAttribute("data-step-index");

        // If not found on the element, try to find it on parent elements
        if (!fromStepIndex) {
          // Look for a parent with a data-step-index (up to 3 levels)
          let currentEl = fromElement;
          let levels = 0;

          while (!fromStepIndex && currentEl.parentElement && levels < 3) {
            currentEl = currentEl.parentElement;
            fromStepIndex = currentEl.getAttribute("data-step-index");
            levels++;
          }
        }

        console.log(
          `Path from ${fromId} to ${toId} - step index: ${fromStepIndex || "not found"}`,
        );
        console.log(`Element classes: ${fromElement.className}`);

        // Try to infer step from ID if attribute not found (for logging only)
        if (!fromStepIndex && fromId.includes("step")) {
          // Extract step number from ID if it follows a pattern like "step-1-something"
          const stepMatch = fromId.match(/step-(\d+)/);
          if (stepMatch && stepMatch[1]) {
            fromStepIndex = stepMatch[1];
            console.log(`Inferred step index from ID: ${fromStepIndex}`);
          }
        }

        // No conditional logic for different steps - using -216 for all
      }

      console.log(
        `Setting translateY to: ${yTranslation} for ${fromId} -> ${toId}`,
      );
      setTranslateY(yTranslation);
    };

    // Start the connection setup with retry logic
    setTimeout(() => {
      setupConnectionWithRetry();
    }, delay * 1000 + 100); // Add the animation delay to our timing

    // Get the elements
    const fromElement = document.getElementById(fromId);
    const toElement = document.getElementById(toId);

    if (fromElement && toElement) {
      // Create mutation observer with improved config
      const createAndAttachObserver = (element: Element) => {
        const observer = new MutationObserver(() => {
          // Use requestAnimationFrame to ensure smooth animations
          if (!animationFrameRef.current) {
            animationFrameRef.current = requestAnimationFrame(() => {
              calculatePath();
              calculateTranslateY(); // Recalculate translation on DOM changes
              animationFrameRef.current = null;
            });
          }
        });

        observer.observe(element, {
          attributes: true,
          childList: true,
          subtree: true,
          attributeFilter: [
            "style",
            "class",
            "height",
            "width",
            "data-expanded",
            "data-resize-trigger",
            "data-animating",
          ],
        });

        // Also observe parent for changes that might affect this element
        const parent = element.parentElement;
        if (parent) {
          observer.observe(parent, {
            attributes: true,
            attributeFilter: ["style", "class"],
          });
        }

        observersRef.current.push(observer);
      };

      // Observe both elements
      createAndAttachObserver(fromElement);
      createAndAttachObserver(toElement);

      // Also attach observers to key ancestor elements that might affect layout
      const findLayoutAncestors = (element: Element) => {
        let parent = element.parentElement;

        while (parent) {
          if (
            parent.id ||
            parent.className.includes("solution-card") ||
            parent.className.includes("grid") ||
            parent.className.includes("flex")
          ) {
            createAndAttachObserver(parent);
          }
          parent = parent.parentElement;
        }
      };

      findLayoutAncestors(fromElement);
      findLayoutAncestors(toElement);

      // Find the pathway container and observe it
      const pathwayContainer = document.querySelector(".pathway-container");
      if (pathwayContainer) {
        createAndAttachObserver(pathwayContainer);

        // Listen for custom events on the pathway container
        pathwayContainer.addEventListener(
          "pathway-scroll-end",
          forceRecalculation,
        );
        pathwayContainer.addEventListener("pathway-resize", forceRecalculation);
        pathwayContainer.addEventListener(
          "pathway-dom-change",
          forceRecalculation,
        );
      }

      // Find scrollable parents and add event listeners
      const scrollableParents = [
        ...findScrollableParents(fromElement),
        ...findScrollableParents(toElement),
      ];

      // Remove duplicates
      const uniqueScrollableParents = [...new Set(scrollableParents)];

      uniqueScrollableParents.forEach((parent) => {
        parent.addEventListener("scroll", forceRecalculation, {
          passive: true,
        });
      });

      // Global event listeners
      window.addEventListener("resize", forceRecalculation, { passive: true });
      window.addEventListener("scroll", forceRecalculation, {
        passive: true,
        capture: true,
      });

      // Set up direct scroll handler on main container
      document.addEventListener(
        "scroll",
        () => {
          // Force immediate recalculation during scroll
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
          }

          animationFrameRef.current = requestAnimationFrame(() => {
            calculatePath();
            animationFrameRef.current = null;
          });
        },
        { passive: true, capture: true },
      );

      // Set up periodic check for animations/transitions that might be missed
      periodicUpdateRef.current = setInterval(() => {
        forceRecalculation();
      }, 1000); // Changed from 500ms to 1000ms to be less resource intensive

      // Return cleanup function
      return () => {
        cleanup();
        
        // Also clean up connection points on unmount
        cleanupConnectionPoints();

        // Remove scroll listeners from parents
        uniqueScrollableParents.forEach((parent) => {
          parent.removeEventListener("scroll", forceRecalculation);
        });

        document.removeEventListener("scroll", forceRecalculation);

        // Remove the custom event listener if pathway container exists
        if (pathwayContainer) {
          pathwayContainer.removeEventListener(
            "pathway-scroll-end",
            forceRecalculation,
          );
          pathwayContainer.removeEventListener(
            "pathway-resize",
            forceRecalculation,
          );
          pathwayContainer.removeEventListener(
            "pathway-dom-change",
            forceRecalculation,
          );
        }
      };
    }

    // If elements not found, just clean up
    return cleanup;
  }, [fromId, toId, translateYOverride]);

  // Effect to update translateY when the prop changes
  useEffect(() => {
    if (translateYOverride !== undefined) {
      setTranslateY(translateYOverride);
    }
  }, [translateYOverride]);

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
          overflow: "visible", // Ensure paths aren't clipped
          zIndex: 0, // Make sure it's behind the cards
          position: "fixed", // Use fixed positioning to avoid parent transforms
        }}
      >
        <svg
          className="w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
          style={{
            strokeLinecap: "round",
            strokeLinejoin: "round",
            fill: "none",
            overflow: "visible", // Ensure paths aren't clipped
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
            transition={{ duration: 0.8, delay: delay + 0.2 }}
            onMouseEnter={() => onHover && onHover(fromId, toId, true)}
            onMouseLeave={() => onHover && onHover(fromId, toId, false)}
            style={{ pointerEvents: "stroke" }}
            data-from-id={fromId}
            data-to-id={toId}
            data-path-type={type}
          />
        </svg>
      </div>
      
      {/* Debug controls - only in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 right-4 z-50 bg-gray-800 text-white p-2 rounded-md shadow-md">
          <button 
            onClick={toggleDebugMode} 
            className="px-3 py-1 text-xs rounded bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            {debugMode ? 'Hide Connection Points' : 'Show Connection Points'}
          </button>
          
          {debugMode && (
            <div className="mt-2 text-xs">
              <div className="flex items-center mb-1">
                <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
                <span>Top Connection Points</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
                <span>Bottom Connection Points</span>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Add manipulation controls for development */}
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
