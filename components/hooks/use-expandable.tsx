"use client"

import { useState, useRef } from "react"
import { useMotionValue } from "framer-motion"

export function useExpandable(initialState = false) {
  const [isExpanded, setIsExpanded] = useState(initialState)
  const animatedHeight = useMotionValue(initialState ? 1 : 0)

  const toggleExpand = () => {
    setIsExpanded((prev) => {
      const newValue = !prev
      animatedHeight.set(newValue ? 1 : 0)
      return newValue
    })
  }

  return { isExpanded, toggleExpand, animatedHeight }
}

// New hook to help with connection line synchronization
export function useScrollSync(containerId: string) {
  const isScrolling = useRef(false);
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null);
  
  const startScrollSync = () => {
    if (typeof window === "undefined") return;
    
    // Get container element
    const container = document.getElementById(containerId);
    if (!container) return;
    
    // Function to handle scroll events
    const handleScroll = () => {
      if (!isScrolling.current) {
        isScrolling.current = true;
        container.setAttribute('data-scrolling', 'true');
        
        // Notify any connection lines that might need to update
        document.querySelectorAll('.solution-card').forEach(card => {
          card.setAttribute('data-container-scrolling', 'true');
        });
      }
      
      // Clear the timeout if it exists
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
      
      // Set a timeout to detect when scrolling stops
      scrollTimeout.current = setTimeout(() => {
        isScrolling.current = false;
        container.removeAttribute('data-scrolling');
        
        // Notify cards that scrolling has stopped
        document.querySelectorAll('.solution-card').forEach(card => {
          card.removeAttribute('data-container-scrolling');
          
          // Force a small layout change to trigger PathLine updates
          setTimeout(() => {
            card.setAttribute('data-scroll-sync', Date.now().toString());
            
            // Remove the attribute after a short delay
            setTimeout(() => {
              card.removeAttribute('data-scroll-sync');
            }, 50);
          }, 10);
        });
      }, 150);
    };
    
    // Add scroll listener to the container
    container.addEventListener('scroll', handleScroll, { passive: true });
    
    // Return cleanup function
    return () => {
      container.removeEventListener('scroll', handleScroll);
      
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
    };
  };
  
  return { startScrollSync };
} 
