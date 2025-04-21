"use client";

import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";

type HighlightPathLineProps = {
  fromId: string;
  toId: string;
  delay?: number;
};

export default function HighlightPathLine({
  fromId,
  toId,
  delay = 0,
}: HighlightPathLineProps) {
  const [path, setPath] = useState<string>("");
  // Dimensions state is unused in this component and can cause render loops
  const dimensionsRef = useRef({ width: 0, height: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<string>(path); // Track the current path to avoid render loops

  // Keep pathRef in sync with path
  useEffect(() => {
    pathRef.current = path;
  }, [path]);

  useEffect(() => {
    // Skip DOM operations during SSR
    if (typeof window === "undefined" || typeof document === "undefined")
      return;

    let resizeListener: (() => void) | null = null;
    let animationFrame: number | null = null;

    const calculatePath = () => {
      // Cancel any pending animation frame to prevent multiple calculations
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = null;
      }

      // Schedule the calculation in the next animation frame for better performance
      animationFrame = requestAnimationFrame(() => {
        const fromElement = document.getElementById(fromId);
        const toElement = document.getElementById(toId);

        if (!fromElement || !toElement || !svgRef.current) return;

        const fromRect = fromElement.getBoundingClientRect();
        const toRect = toElement.getBoundingClientRect();

        // Get positions relative to the SVG
        const svgRect = svgRef.current.getBoundingClientRect();

        const fromX = fromRect.left + fromRect.width / 2 - svgRect.left;
        const fromY = fromRect.bottom - svgRect.top;
        const toX = toRect.left + toRect.width / 2 - svgRect.left;
        const toY = toRect.top - svgRect.top;

        // Calculate midpoint for the vertical segment
        const midY = fromY + (toY - fromY) / 2;

        // Create a pipe-like path with rounded corners
        // Start -> down -> corner -> horizontal -> corner -> up -> End
        const cornerRadius = 20; // Radius for the curved corners

        let pathData = `M ${fromX} ${fromY}`; // Start point

        // If the cards are roughly aligned vertically
        if (Math.abs(fromX - toX) < 50) {
          // Simple vertical path with no corners needed
          pathData += ` L ${toX} ${toY}`;
        } else {
          // Go down vertically to the midpoint
          pathData += ` L ${fromX} ${midY - cornerRadius}`;

          // First corner
          if (fromX < toX) {
            // Going right
            pathData += ` Q ${fromX} ${midY} ${fromX + cornerRadius} ${midY}`;
            // Horizontal segment
            pathData += ` L ${toX - cornerRadius} ${midY}`;
            // Second corner
            pathData += ` Q ${toX} ${midY} ${toX} ${midY + cornerRadius}`;
          } else {
            // Going left
            pathData += ` Q ${fromX} ${midY} ${fromX - cornerRadius} ${midY}`;
            // Horizontal segment
            pathData += ` L ${toX + cornerRadius} ${midY}`;
            // Second corner
            pathData += ` Q ${toX} ${midY} ${toX} ${midY + cornerRadius}`;
          }

          // Final vertical segment to the target
          pathData += ` L ${toX} ${toY}`;
        }

        // Only update path if it's changed to prevent unnecessary re-renders
        if (pathRef.current !== pathData) {
          pathRef.current = pathData; // Update our path reference
          setPath(pathData);
        }

        // Update SVG dimensions (no state updates, using ref only)
        const minX = Math.min(fromX, toX) - 50;
        const maxX = Math.max(fromX, toX) + 50;
        const minY = Math.min(fromY, toY) - 20;
        const maxY = Math.max(fromY, toY) + 20;

        // Store dimensions in ref instead of state to avoid render loops
        dimensionsRef.current = {
          width: maxX - minX + 100,
          height: maxY - minY + 40,
        };

        // Clear animation frame reference
        animationFrame = null;
      });
    };

    // Calculate path after a short delay to ensure elements are rendered
    const timer = setTimeout(() => {
      calculatePath();

      // Use a debounced version for the resize handler
      const debounce = (fn: () => void, ms = 100) => {
        let timeoutId: ReturnType<typeof setTimeout>;
        return function () {
          clearTimeout(timeoutId);
          timeoutId = setTimeout(fn, ms);
        };
      };

      // Define resize listener once and store reference
      resizeListener = debounce(calculatePath, 200);

      // Add window resize listener
      window.addEventListener("resize", resizeListener);
    }, 100);

    return () => {
      clearTimeout(timer);
      if (resizeListener) {
        window.removeEventListener("resize", resizeListener);
      }
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [fromId, toId]); // Keep dependencies minimal to prevent render loops

  return (
    <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-0">
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          overflow: "visible",
          pointerEvents: "none",
        }}
      >
        <motion.path
          d={path}
          fill="none"
          className="stroke-green-300"
          strokeWidth={8}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.6 }}
          transition={{
            duration: 1.5,
            delay,
            ease: "easeInOut",
          }}
        />
      </svg>
    </div>
  );
}
