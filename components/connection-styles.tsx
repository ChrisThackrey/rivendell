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
        opacity: 0.001; /* Almost invisible but still detectable by the DOM */
      }

      /* Top connection point positioning */
      .connection-point-top {
        top: -40px; /* Position slightly higher above the card */
      }

      /* Bottom connection point positioning */
      .connection-point-bottom {
        bottom: 10px; /* Position slightly lower below the card */
      }

      /* Visual marker styling - purely decorative endpoint display */
      /* These are the VISUAL markers shown to the user */
      .endpoint-marker {
        pointer-events: none;
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
        width: 12px; /* Slightly larger than connection points */
        height: 12px; /* Slightly larger than connection points */
        border-radius: 50%;
        z-index: 15; /* Above connection points */
        border: 2px solid white;
        box-shadow: 0 0 4px rgba(0, 0, 0, 0.4);
        transition: transform 0.2s ease-in-out;
      }

      /* Top endpoint marker positioning */
      .endpoint-marker-top {
        top: -8px; /* Position visibly higher than the connection point */
        background-color: rgba(0, 0, 255, 0.7); /* Blue for top markers */
      }

      /* Bottom endpoint marker positioning */
      .endpoint-marker-bottom {
        bottom: -8px; /* Position visibly lower than the connection point */
        background-color: rgba(255, 0, 0, 0.7); /* Red for bottom markers */
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
