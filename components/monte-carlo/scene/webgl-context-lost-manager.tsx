"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Button } from '@/components/ui/button'; // Assuming Button is used

export function WebGLContextLostManager() {
  const { gl, invalidate } = useThree();
  const [isContextLost, setIsContextLost] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);
  const maxAttempts = 5;
  const recoveryTimers = useRef<NodeJS.Timeout[]>([]); // Use NodeJS.Timeout for browser compatibility

  const getBackoffDelay = useCallback((attempt: number) => {
    return Math.min(1000 * Math.pow(2, attempt) + Math.random() * 1000, 10000);
  }, []);

  const clearRecoveryTimers = useCallback(() => {
    recoveryTimers.current.forEach(timerId => clearTimeout(timerId));
    recoveryTimers.current = [];
  }, []);

  useEffect(() => {
    if (!gl?.domElement) return;
    const canvas = gl.domElement;

    const handleContextLost = (event: Event) => {
      console.log("WebGL context lost detected");
      event.preventDefault(); // Important: prevent default browser handling
      setIsContextLost(true);
      setAttemptCount(0); // Reset attempt count on new context loss
      clearRecoveryTimers(); // Clear any existing timers
    };
    
    const handleContextRestored = () => {
      console.log("WebGL context restored");
      setIsContextLost(false);
      setAttemptCount(0); // Reset attempt count when context is restored
      clearRecoveryTimers();
      invalidate(); // Request a render once context is back
    };

    canvas.addEventListener("webglcontextlost", handleContextLost);
    canvas.addEventListener("webglcontextrestored", handleContextRestored);

    return () => {
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      canvas.removeEventListener("webglcontextrestored", handleContextRestored);
      clearRecoveryTimers();
    };
  }, [gl, invalidate, clearRecoveryTimers]);

  useEffect(() => {
     // ... recovery attempt logic ...
      if (!isContextLost || !gl) return;

      if (attemptCount >= maxAttempts) {
        console.error(`Failed to restore WebGL context after ${maxAttempts} attempts`);
        return;
      }

      const delay = getBackoffDelay(attemptCount);
      console.log(`Attempting WebGL context recovery (${attemptCount + 1}/${maxAttempts}) in ${Math.round(delay)}ms`);

      const timerId = setTimeout(() => {
        console.log(`Recovery attempt ${attemptCount + 1}`);
        try {
          const context = gl.getContext() as WebGLRenderingContext | WebGL2RenderingContext | null;
          if (context) {
            const extension = context.getExtension('WEBGL_lose_context');
            if (extension) {
              extension.restoreContext();
            } else { invalidate(); } // Fallback attempt
          } else { invalidate(); } // Fallback attempt if context is lost
        } catch (e) { console.error("Error during WebGL context restoration:", e); }
        setAttemptCount(prev => prev + 1);
      }, delay);

      recoveryTimers.current.push(timerId);
      return () => { clearTimeout(timerId); };
  }, [isContextLost, attemptCount, gl, invalidate, getBackoffDelay, maxAttempts]);


  if (isContextLost) {
    return (
      <Html center>
        <div className="bg-white/90 p-4 rounded-lg shadow-lg backdrop-blur-sm text-center max-w-md">
          {/* ... Context lost message ... */}
          {attemptCount >= maxAttempts && (
            <Button size="sm" className="mt-2" onClick={() => { setAttemptCount(0); invalidate(); }}>
              Try Again
            </Button>
          )}
        </div>
      </Html>
    );
  }

  return null;
} 