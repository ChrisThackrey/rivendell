import React, { useState } from "react"
import { useFrame } from "@react-three/fiber"
import { Text } from "@react-three/drei"
import * as THREE from "three"

export function DynamicAxisLabels() {
  const [labels, setLabels] = useState({
    x: { position: [7, 0.5, 0.5] as [number, number, number], visible: true },
    y: { position: [0.5, 7, 0.5] as [number, number, number], visible: true },
    z: { position: [0.5, 0.5, 7] as [number, number, number], visible: true },
  })

  useFrame(({ camera }) => {
    // Get camera position in spherical coordinates
    const cameraPosition = new THREE.Vector3().copy(camera.position)
    const spherical = new THREE.Spherical().setFromVector3(cameraPosition)

    // Determine which planes are facing the camera
    const phi = spherical.phi // vertical angle
    const theta = spherical.theta // horizontal angle

    // Calculate positions for labels based on camera angle
    // This ensures labels are always on the visible side of the axis
    const xSign = Math.sin(theta) > 0 ? 1 : -1
    const ySign = Math.cos(phi) < 0 ? 1 : -1
    const zSign = Math.cos(theta) > 0 ? 1 : -1

    // Position labels at the ends of the axes but slightly offset
    // Using a larger value (e.g., 7) suitable for a 50-unit axisHelper
    setLabels({
      x: {
        position: [51 * xSign, 1, 1] as [number, number, number], // Adjusted position for 50-unit axis
        visible: true,
      },
      y: {
        position: [1, 51 * ySign, 1] as [number, number, number], // Adjusted position for 50-unit axis
        visible: true,
      },
      z: {
        position: [1, 1, 51 * zSign] as [number, number, number], // Adjusted position for 50-unit axis
        visible: true,
      },
    })
  })

  return (
    <>
      <Text
        position={labels.x.position}
        color="black"
        fontSize={1.5} // Adjust size as needed
        fontWeight="bold"
        anchorX={labels.x.position[0] > 0 ? "left" : "right"}
        renderOrder={1000} // Ensure labels render on top
      >
        X: Complexity
      </Text>
      <Text
        position={labels.y.position}
        color="black"
        fontSize={1.5}
        fontWeight="bold"
        anchorY={labels.y.position[1] > 0 ? "top" : "bottom"}
        renderOrder={1000}
      >
        Y: Performance
      </Text>
      <Text
        position={labels.z.position}
        color="black"
        fontSize={1.5}
        fontWeight="bold"
        anchorX={labels.z.position[2] > 0 ? "left" : "right"} // Check z position for anchorX
        renderOrder={1000}
      >
        Z: Memory Usage
      </Text>
    </>
  )
} 