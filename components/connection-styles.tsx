"use client";

import React from "react";

export default function ConnectionStyles() {
  return (
    <style jsx global>{`
      /* Special classes for connection lines to work properly */
      .solution-card {
        position: relative;
        z-index: 1;
        display: flex;
        flex-direction: column;
      }

      /* Ensure scrollable containers handle fixed elements properly */
      .pathway-container {
        position: relative;
        transform: translateZ(0);
        will-change: transform;
        overflow: visible;
        padding-bottom: 40px; /* Add some bottom padding for connection lines */
        padding-top: 20px; /* Add top padding as well for better spacing */
      }

      /* Container for lines and connecting elements */
      .lines-container {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 0;
        overflow: visible;
      }

      /* Prevent nested z-index issues */
      .solution-grid {
        position: relative;
        z-index: 2;
      }

      /* Step grid specific handling */
      .step-grid {
        position: relative;
        z-index: 1;
        margin-bottom: 100px; /* Increase margin between step grids for better line spacing */
      }

      /* Connection points styling - precise positioning */
      /* These are the ACTUAL connection points used for path calculation */
      .connection-point-top,
      .connection-point-bottom {
        pointer-events: none;
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
        width: 12px; /* Increased size for better visibility */
        height: 12px; /* Increased size for better visibility */
        border-radius: 50%;
        z-index: 10;
        /* Debugging opacity - reduce to 0.001 in production */
        opacity: 0.2; /* Increased opacity for easier debugging */
        box-shadow: 0 0 5px rgba(0, 0, 0, 0.5); /* Add shadow to make visible during development */
      }

      /* Top connection point positioning */
      .connection-point-top {
        top: 0; /* Position at the top of the card */
        /* Debugging color - remove in production */
        background-color: rgba(0, 0, 255, 0.5); /* Blue for debugging */
      }

      /* Bottom connection point positioning */
      .connection-point-bottom {
        bottom: 0; /* Position at the bottom of the card */
        /* Debugging color - remove in production */
        background-color: rgba(255, 0, 0, 0.5); /* Red for debugging */
      }

      /* Visual marker styling - purely decorative endpoint display */
      /* These are the VISUAL markers shown to the user */
      .endpoint-marker {
        pointer-events: none;
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
        width: 8px; /* Reduced from 12px to be less intrusive */
        height: 8px; /* Reduced from 12px to be less intrusive */
        border-radius: 50%;
        z-index: 15; /* Above connection points */
        border: 1px solid white; /* Thinner border */
        box-shadow: 0 0 3px rgba(0, 0, 0, 0.2); /* More subtle shadow */
        transition: transform 0.2s ease-in-out;
        opacity: 0.6; /* Make more subtle */
      }

      /* Top endpoint marker positioning */
      .endpoint-marker-top {
        top: 0; /* Position at top of card */
        background-color: rgba(0, 0, 255, 0.5); /* More subtle blue */
      }

      /* Bottom endpoint marker positioning */
      .endpoint-marker-bottom {
        bottom: 0; /* Position at bottom of card */
        background-color: rgba(255, 0, 0, 0.5); /* More subtle red */
      }

      /* Make markers subtly larger on hover to improve UX */
      .endpoint-marker:hover {
        transform: translateX(-50%) scale(1.2);
      }

      /* Add more space between step 1 and step 2 */
      [data-step-index="1"] {
        margin-bottom: 40px;
      }

      /* Specific spacing for Step 2 to improve line positioning */
      [data-step-index="2"] {
        margin-top: 80px; /* Increase margin for step 2 to accommodate translated lines */
      }

      /* Add more space for step 3 */
      [data-step-index="3"] {
        margin-top: 80px;
      }
    `}</style>
  );
}
