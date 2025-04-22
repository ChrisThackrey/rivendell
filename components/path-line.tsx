"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";

type PathLineProps = {
  fromId: string;
  toId: string;
  type: "accepted" | "secondary" | "rejected";
  delay?: number;
  isHighlighted?: boolean;
  color?: string;
  onHover?: (fromId: string, toId: string, isHovering: boolean) => void;
  translateYOverride?: number;
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
  const maxRetries = 10; // Maximum number of retries

  // Helper function to ensure connection points exist
  const ensureConnectionPoints = () => {
    if (typeof window === "undefined" || typeof document === "undefined")
      return false;

    const fromElement = document.getElementById(fromId);
    const toElement = document.getElementById(toId);

    if (!fromElement || !toElement) {
      // Elements are missing, but don't warn if we're still within retry attempts
      if (retryAttemptsRef.current < maxRetries) {
        console.log(
          `Elements not found yet, will retry: fromId=${fromId}, toId=${toId} (attempt ${retryAttemptsRef.current + 1}/${maxRetries})`,
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

    // If all connection points exist, we're good
    if (fromTopPoint && fromBottomPoint && toTopPoint && toBottomPoint) {
      console.log(`Connection points already exist for ${fromId} -> ${toId}`);

      // If connection points exist but markers don't, create the markers
      if (
        !fromTopMarker ||
        !fromBottomMarker ||
        !toTopMarker ||
        !toBottomMarker
      ) {
        console.log(`Adding missing visual markers for ${fromId} -> ${toId}`);

        // Only create markers if they don't exist
        if (!fromTopMarker && fromElement) {
          const marker = document.createElement("div");
          marker.id = `${fromId}-top-marker`;
          marker.className = "endpoint-marker endpoint-marker-top";
          marker.setAttribute("data-marker-id", `${fromId}-top-marker`);
          fromElement.appendChild(marker);
        }

        if (!fromBottomMarker && fromElement) {
          const marker = document.createElement("div");
          marker.id = `${fromId}-bottom-marker`;
          marker.className = "endpoint-marker endpoint-marker-bottom";
          marker.setAttribute("data-marker-id", `${fromId}-bottom-marker`);
          fromElement.appendChild(marker);
        }

        if (!toTopMarker && toElement) {
          const marker = document.createElement("div");
          marker.id = `${toId}-top-marker`;
          marker.className = "endpoint-marker endpoint-marker-top";
          marker.setAttribute("data-marker-id", `${toId}-top-marker`);
          toElement.appendChild(marker);
        }

        if (!toBottomMarker && toElement) {
          const marker = document.createElement("div");
          marker.id = `${toId}-bottom-marker`;
          marker.className = "endpoint-marker endpoint-marker-bottom";
          marker.setAttribute("data-marker-id", `${toId}-bottom-marker`);
          toElement.appendChild(marker);
        }
      }

      return true;
    }

    console.log(`Creating missing connection points for ${fromId} -> ${toId}`);

    // Create missing connection points (invisible for calculations)
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

    // Also create the visual markers
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

    // Verify all points were created successfully
    const allPointsExist =
      document.getElementById(`${fromId}-top`) &&
      document.getElementById(`${fromId}-bottom`) &&
      document.getElementById(`${toId}-top`) &&
      document.getElementById(`${toId}-bottom`);

    if (!allPointsExist) {
      console.warn(
        `Failed to create all connection points for ${fromId} -> ${toId}`,
      );
    }

    return allPointsExist;
  };

  // Calculate path between elements with scroll position consideration
  const calculatePath = () => {
    if (typeof window === "undefined" || typeof document === "undefined")
      return "";

    // Debug logging to help troubleshoot connection issues
    console.log(
      `Calculating path from ${fromId} (RED bottom point) to ${toId} (BLUE top point)`,
    );

    // First ensure connection points exist
    ensureConnectionPoints();

    // Find the source and target card elements
    const fromElement = document.getElementById(fromId);
    const toElement = document.getElementById(toId);

    if (!fromElement || !toElement) {
      console.warn(
        `Source or target element not found: fromId=${fromId}, toId=${toId}`,
      );
      return "";
    }

    // Find the explicit connection points (bottom of from element, top of to element)
    const fromConnectionPoint = document.getElementById(`${fromId}-bottom`); // BOTTOM of fromElement (red point)
    const toConnectionPoint = document.getElementById(`${toId}-top`); // TOP of toElement (blue point)

    if (!fromConnectionPoint || !toConnectionPoint) {
      console.warn(
        `Connection points not found: fromBottom=${!!fromConnectionPoint}, toTop=${!!toConnectionPoint}`,
      );

      // Fallback to the old approach of calculating positions based on the element bounds
      // Get positions and dimensions relative to document
      const fromRect = fromElement.getBoundingClientRect();
      const toRect = toElement.getBoundingClientRect();

      // Get the bounding rect of a common parent container
      // Find the nearest common scrollable container
      const pathwayContainer =
        document.querySelector(".pathway-container") || document.body;
      const containerRect = pathwayContainer.getBoundingClientRect();

      // Calculate absolute positions relative to container
      // For from card: use the exact BOTTOM center
      const fromX = fromRect.left - containerRect.left + fromRect.width / 2;
      const fromY = fromRect.bottom - containerRect.top;

      // For to card: use the exact TOP center
      const toX = toRect.left - containerRect.left + toRect.width / 2;
      const toY = toRect.top - containerRect.top;

      // No adjustments needed anymore
      return calculatePathFromPoints(fromX, fromY, toX, toY);
    }

    // Get the explicit connection points' positions
    const fromRect = fromConnectionPoint.getBoundingClientRect();
    const toRect = toConnectionPoint.getBoundingClientRect();

    // Get the container bounds
    const pathwayContainer =
      document.querySelector(".pathway-container") || document.body;
    const containerRect = pathwayContainer.getBoundingClientRect();

    // Calculate positions relative to the container - use the center of the connection points
    const fromX = fromRect.left - containerRect.left + fromRect.width / 2;
    const fromY = fromRect.top - containerRect.top + fromRect.height / 2;
    const toX = toRect.left - containerRect.left + toRect.width / 2;
    const toY = toRect.top - containerRect.top + toRect.height / 2;

    console.log(`Path from (${fromX}, ${fromY}) to (${toX}, ${toY})`);

    return calculatePathFromPoints(fromX, fromY, toX, toY);
  };

  // Helper function to calculate the path between two points
  const calculatePathFromPoints = (
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
  ) => {
    // Calculate the vertical distance between points to determine path style
    const verticalDistance = Math.abs(toY - fromY);
    const horizontalDistance = Math.abs(toX - fromX);
    
    // Corner radius for smooth curves - adjust based on distances
    const cornerRadius = Math.min(20, verticalDistance / 4, horizontalDistance / 4);

    // Calculate midpoint for the curve - adjusting for better appearance
    const midY = fromY + (toY - fromY) / 2;

    // Calculate SVG container position and dimensions with extra padding
    const minX = Math.min(fromX, toX) - 100; // More padding on sides
    const minY = Math.min(fromY, toY) - 50;
    const maxX = Math.max(fromX, toX) + 100; // More padding on sides
    const maxY = Math.max(fromY, toY) + 50;

    const svgWidth = maxX - minX + 200;  // Increased width
    const svgHeight = maxY - minY + 100; // Increased height

    // Update SVG container position with extra space
    setSvgPosition({
      left: minX - 100,
      top: minY - 50,
      width: svgWidth,
      height: svgHeight,
    });

    // Create path data relative to the SVG container
    const relFromX = fromX - (minX - 100);
    const relFromY = fromY - (minY - 50);
    const relToX = toX - (minX - 100);
    const relToY = toY - (minY - 50);
    const relMidY = midY - (minY - 50);

    // Start path at the from point
    let pathData = `M ${relFromX} ${relFromY}`;

    // Enhanced path drawing logic:
    // 1. For closely aligned points vertically, use a straight line
    // 2. For points aligned horizontally, use a simple curve
    // 3. For most cases, use a nice S-curve with proper corners

    // If the cards are roughly aligned vertically and close
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
      pathData += ` L ${relFromX} ${relMidY - cornerRadius}`;

      // First corner
      if (relFromX < relToX) {
        // Going right
        pathData += ` Q ${relFromX} ${relMidY} ${relFromX + cornerRadius} ${relMidY}`;
        // Horizontal segment
        pathData += ` L ${relToX - cornerRadius} ${relMidY}`;
        // Second corner
        pathData += ` Q ${relToX} ${relMidY} ${relToX} ${relMidY + cornerRadius}`;
      } else {
        // Going left
        pathData += ` Q ${relFromX} ${relMidY} ${relFromX - cornerRadius} ${relMidY}`;
        // Horizontal segment
        pathData += ` L ${relToX + cornerRadius} ${relMidY}`;
        // Second corner
        pathData += ` Q ${relToX} ${relMidY} ${relToX} ${relMidY + cornerRadius}`;
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
          
          if (retryAttemptsRef.current <= maxRetries) {
            console.log(`Retry attempt ${retryAttemptsRef.current}/${maxRetries} for path ${fromId} -> ${toId}`);
            
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
            console.warn(`Max retries (${maxRetries}) exceeded for ${fromId} -> ${toId}`);
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
  if (elementsMissing && retryAttemptsRef.current >= maxRetries) return null;
  
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
    <motion.div
      className="path-line"
      style={{
        position: "absolute",
        left: svgPosition.left,
        top: svgPosition.top,
        width: svgPosition.width,
        height: svgPosition.height,
        pointerEvents: "none",
        zIndex: 0,
      }}
      initial={{ opacity: 0, translateY: 0 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ delay, duration: 0.5 }}
    >
      <svg
        width={svgPosition.width}
        height={svgPosition.height}
        style={{ 
          overflow: "visible",
          position: "absolute",
          top: 0,
          left: 0
        }}
        data-from-id={fromId}
        data-to-id={toId}
        className="path-line-svg"
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
    </motion.div>
  );
}
