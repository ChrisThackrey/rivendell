"use client";

import React, { useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';

export function DynamicAxisLabels() {
  const [labels, setLabels] = useState({
    x: { position: [7, 0.5, 0.5] as [number, number, number] },
    y: { position: [0.5, 7, 0.5] as [number, number, number] },
    z: { position: [0.5, 0.5, 7] as [number, number, number] },
  });

  useFrame(({ camera }) => {
    const cameraPosition = camera.position;
    const spherical = new THREE.Spherical().setFromVector3(cameraPosition);
    const phi = spherical.phi;
    const theta = spherical.theta;
    const xSign = Math.sin(theta) > 0 ? 1 : -1;
    const ySign = Math.cos(phi) < 0 ? 1 : -1;
    const zSign = Math.cos(theta) > 0 ? 1 : -1;

    setLabels({
      x: { position: [7 * xSign, 0.5, 0.5] },
      y: { position: [0.5, 7 * ySign, 0.5] },
      z: { position: [0.5, 0.5, 7 * zSign] },
    });
  });

  return (
    <>
      <Text position={labels.x.position} color="black" fontSize={1.5} fontWeight="bold" anchorX={labels.x.position[0] > 0 ? "left" : "right"} renderOrder={1000}>
        X: Complexity
      </Text>
      <Text position={labels.y.position} color="black" fontSize={1.5} fontWeight="bold" anchorY={labels.y.position[1] > 0 ? "top" : "bottom"} renderOrder={1000}>
        Y: Performance
      </Text>
      <Text position={labels.z.position} color="black" fontSize={1.5} fontWeight="bold" anchorX={labels.z.position[2] > 0 ? "left" : "right"} renderOrder={1000}>
        Z: Memory Usage
      </Text>
    </>
  );
} 