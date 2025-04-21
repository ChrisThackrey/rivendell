"use client";

import React, { useEffect, useRef } from "react";

interface LinesContainerProps {
  children: React.ReactNode;
  className?: string;
}

export default function LinesContainer({
  children,
  className = "",
}: LinesContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Add class to mark container for path lines
    containerRef.current.classList.add("pathway-container");

    // Track scroll events
    const handleScroll = () => {
      if (containerRef.current) {
        // Add a data attribute to signal scrolling
        containerRef.current.setAttribute("data-scrolling", "true");

        // Remove the attribute after scrolling stops
        setTimeout(() => {
          if (containerRef.current) {
            containerRef.current.removeAttribute("data-scrolling");

            // Force a recalculation after scrolling by triggering a custom event
            const event = new CustomEvent("pathway-scroll-end", {
              bubbles: true,
            });
            containerRef.current.dispatchEvent(event);
          }
        }, 150);
      }
    };

    // Add resize observer to detect container size changes
    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current) {
        // Trigger path recalculation on resize
        const event = new CustomEvent("pathway-resize", {
          bubbles: true,
        });
        containerRef.current.dispatchEvent(event);
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // Add scroll listener
    window.addEventListener("scroll", handleScroll, { passive: true });

    // Also listen for internal DOM changes
    const mutationObserver = new MutationObserver(() => {
      if (containerRef.current) {
        containerRef.current.dispatchEvent(
          new CustomEvent("pathway-dom-change", { bubbles: true }),
        );
      }
    });

    // Observe mutations
    if (containerRef.current) {
      mutationObserver.observe(containerRef.current, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class", "style"],
      });
    }

    // Clean up
    return () => {
      window.removeEventListener("scroll", handleScroll);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-visible ${className}`}
      style={{ position: "relative" }}
    >
      {/* Container for lines */}
      <div className="lines-container absolute top-0 left-0 w-full h-full pointer-events-none z-0 overflow-visible">
        {/* Path lines will be rendered here by PathLine component */}
      </div>

      {/* Main content */}
      <div className="solution-grid relative z-10">{children}</div>
    </div>
  );
}
