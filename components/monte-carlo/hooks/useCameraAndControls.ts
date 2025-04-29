import { useState, useRef, useCallback, useEffect } from "react"
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib"
import * as THREE from "three"
import type { MonteCarloDataPoint } from "@/lib/monte-carlo-service"
// Alias MonteCarloDataPoint as PointWithCluster for hook usage
type PointWithCluster = MonteCarloDataPoint

const DEBUG = process.env.NODE_ENV !== 'production'

// Define camera state type
type CameraState = {
  position: [number, number, number];
  target: [number, number, number];
}

export function useCameraAndControls(
  initialPosition: [number, number, number] = [20, 20, 20],
  initialTarget: [number, number, number] = [0, 0, 0],
) {
  const controlsRef = useRef<OrbitControlsImpl>(null)
  const isCameraMovingRef = useRef<boolean>(false)
  const [lastCameraMovement, setLastCameraMovement] = useState(0)
  const [preventAutoDeselect, setPreventAutoDeselect] = useState(true) // Start true
  const [cameraState, setCameraState] = useState<CameraState>({
    position: initialPosition,
    target: initialTarget,
  })
  const invalidateRef = useRef<(() => void) | null>(null); // To store R3F invalidate

  // Helper to check if camera was moving recently
  const isCameraMovingRecently = useCallback(() => {
    return Date.now() - lastCameraMovement < 500 // 500ms debounce
  }, [lastCameraMovement])

  // Update camera state and movement tracking
  const handleCameraChange = useCallback(() => {
    if (controlsRef.current) {
      const camera = controlsRef.current.object
      const target = controlsRef.current.target
      const newState: CameraState = {
        position: [camera.position.x, camera.position.y, camera.position.z],
        target: [target.x, target.y, target.z],
      }
      setCameraState(newState) // Update state for potential re-renders if needed
      isCameraMovingRef.current = true
      setLastCameraMovement(Date.now())
      setPreventAutoDeselect(true) // Prevent deselection while moving

      if (invalidateRef.current) {
        invalidateRef.current() // Ensure visuals update during movement
      }
    }
  }, [])

  // Function to focus camera on a set of points
  const focusCameraOnAllPoints = useCallback((points: PointWithCluster[], zoomFactor = 1) => {
    if (!controlsRef.current || points.length === 0) return

    if (DEBUG) console.debug(`Focusing camera on ${points.length} points, zoomFactor: ${zoomFactor}`)

    const bounds = new THREE.Box3()
    points.forEach(point => bounds.expandByPoint(new THREE.Vector3(...point.position)))

    const center = new THREE.Vector3()
    bounds.getCenter(center)

    const size = new THREE.Vector3()
    bounds.getSize(size)
    const radius = size.length() / 2
    let distance = radius * 2 // Fallback distance

    const cam = controlsRef.current.object as THREE.PerspectiveCamera
    if (cam && cam.isPerspectiveCamera) {
      const fovVert = (cam.fov * Math.PI) / 180 / 2
      const aspect = cam.aspect
      const fovHorz = Math.atan(Math.tan(fovVert) * aspect)
      const distVert = radius / Math.sin(fovVert)
      const distHorz = radius / Math.sin(fovHorz)
      distance = Math.max(distVert, distHorz)
    }

    let marginFactor = 1.05 * zoomFactor
    if (points.length <= 5) marginFactor = 1.2 * zoomFactor
    else if (points.length <= 10) marginFactor = 1.15 * zoomFactor
    else if (points.length <= 20) marginFactor = 1.1 * zoomFactor

    const minDistance = (points.length <= 5 ? 8 : 20) * zoomFactor
    const finalDistance = Math.max(distance * marginFactor, minDistance)

    const cameraPositionVec = new THREE.Vector3()
    if (points.length <= 5) {
      // Closer angle for small selections
      cameraPositionVec.set(
        center.x + finalDistance * 0.6,
        center.y + finalDistance * 0.3,
        center.z + finalDistance * 0.7
      )
    } else {
      // Default view along Z axis
      cameraPositionVec.set(center.x, center.y, center.z + finalDistance)
    }

    const newTarget: [number, number, number] = [center.x, center.y, center.z]
    const newPosition: [number, number, number] = [cameraPositionVec.x, cameraPositionVec.y, cameraPositionVec.z]

    setCameraState({ position: newPosition, target: newTarget })

    // Create temporary vector for better control over camera position changes
    if (controlsRef.current && controlsRef.current.object) {
      const camera = controlsRef.current.object;
      // Update target
      controlsRef.current.target.set(...newTarget);
      
      // Update camera position 
      camera.position.set(...newPosition);
      
      // Update controls
      controlsRef.current.update();
      
      // Force re-render if invalidate function is available
      if (invalidateRef.current) {
        invalidateRef.current();
      }
    }

    // Keep selection persistent after focusing
    setPreventAutoDeselect(true)
    
    // Log action for debugging
    console.log("Camera focused on points, new target:", newTarget, "position:", newPosition);

  }, [controlsRef]) // Dependency on controlsRef ensures it's available

  // Effect to manage the camera movement flag and auto-deselection
  useEffect(() => {
    const interval = setInterval(() => {
      if (isCameraMovingRecently()) {
        // Still moving
        setPreventAutoDeselect(true)
        isCameraMovingRef.current = true
      } else if (isCameraMovingRef.current) {
        // Just stopped moving
        console.log("Camera movement stopped - resetting movement flag");
        isCameraMovingRef.current = false
        
        // Force immediate update after movement stops
        if (invalidateRef.current) {
          // Trigger two renders to ensure proper visual update
          invalidateRef.current()
          // Schedule another update after a small delay to ensure complete visual refresh
          setTimeout(() => {
            if (invalidateRef.current) {
              invalidateRef.current()
            }
          }, 50)
        }
        
        // Keep preventAutoDeselect true to preserve selections
        // Only reset the camera movement flag to re-enable interaction
      }
    }, 50) // Shorter interval for more responsive updates
    return () => clearInterval(interval)
  }, [isCameraMovingRecently, invalidateRef])


  return {
    controlsRef,
    cameraState,
    setCameraState, // Expose if external control needed
    handleCameraChange,
    focusCameraOnAllPoints,
    isCameraMovingRef, // For use in Points component hover logic
    isCameraMovingRecently, // For Scene component conditional rendering/updates
    preventAutoDeselect,
    setPreventAutoDeselect, // Allow external control if needed
    invalidateRef, // Allow parent component to set the invalidate function
  }
} 