# Monte Carlo 3D Visualization Debug Findings

## Issue: Point Selection Not Working Properly

The point selection functionality in the Monte Carlo 3D visualization was not working correctly. Selected points were not being registered or maintaining their selection state during camera rotation.

## Root Causes

1. **Incorrect Raycasting Implementation**:
   - The raycasting implementation wasn't properly traversing the Three.js object hierarchy
   - The `drei` Instances component creates a complex hierarchy that requires proper traversal

2. **Event Handling Issues**:
   - Click events weren't being properly captured and processed
   - No global click handler to catch clicks throughout the scene

3. **Material Configuration**:
   - The meshBasicMaterial lacked proper configuration for reliable raycasting detection
   - Missing depth properties affected object detection

4. **Parent-Child Hierarchy Navigation**:
   - The code wasn't properly traversing up the parent-child hierarchy to find the correct object with userData

## Fixes Applied

1. **Enhanced Raycasting Logic**:
   - Implemented a robust traversal algorithm to find pointId in the object hierarchy
   - Added type safety with proper null checks for typechecking compliance

2. **Global Click Handler**:
   - Added a global scene click handler via useEffect to ensure clicks are captured
   - Properly calculated normalized mouse coordinates for accurate raycasting

3. **Improved Material Configuration**:
   - Set `transparent: false`, `depthWrite: true`, and `depthTest: true` for reliable raycasting
   - Maintained flat shading and bright colors while ensuring proper interaction

4. **Event Propagation Control**:
   - Added `e.stopPropagation()` to prevent duplicate handling of click events
   - Ensured proper targeting of the clicked instance

5. **Type Safety Improvements**:
   - Added proper TypeScript types for objects and userData
   - Fixed null handling in object traversal

## Technical Details

The fix involved two main components:

1. **Enhanced useFrame Hook**:
   - Improved the raycaster implementation to traverse the entire object hierarchy
   - Properly handled userData from nested objects

2. **Added Global Click Handler**:
   - Implemented a dedicated click handler for the entire canvas
   - Calculated proper normalized coordinates based on the click position
   - Re-implemented raycasting logic specifically for click detection

## Testing

The implementation was tested with Playwright to verify:
- Points can be selected by clicking
- Selected points maintain their visual state (color, size)
- Selection persists during camera rotation, panning, and zooming
- Points accurately respond to click interactions

## Conclusion

The Monte Carlo 3D visualization now provides a fully functional point selection experience that works consistently across different view angles and camera movements.