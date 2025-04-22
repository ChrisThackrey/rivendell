# Monte Carlo Visualizer Refactoring

Refactoring the large `MonteCarloVisualizer.tsx` component into smaller, more manageable hooks and components based on the agreed strategy.

## Completed Tasks

- [x] Create `components/monte-carlo/utils.ts` with helper functions.
- [x] Create `components/monte-carlo/hooks/useMonteCarloData.ts` hook.
- [x] Create `components/monte-carlo/hooks/useVisualizationState.ts` hook.
- [x] Create `components/monte-carlo/hooks/useCameraAndControls.ts` hook.
- [x] Create `MONTE_CARLO_REFACTOR.md` task list.
- [x] Create `components/monte-carlo/BatchSelectionSidebar.tsx` component.
- [x] Create `components/monte-carlo/DetailCard.tsx` component.
- [x] Create `components/monte-carlo/DetailsPanel.tsx` component.
- [x] Create `components/monte-carlo/ModelLegend.tsx` component.
- [x] Create `components/monte-carlo/scene/DynamicAxisLabels.tsx` (R3F) component.
- [x] Create `components/monte-carlo/scene/Points.tsx` (R3F) component.
- [x] Create `components/monte-carlo/scene/PointLabels.tsx` (R3F) component.
- [x] Create `components/monte-carlo/scene/ClusterCubes.tsx` (R3F) component.
- [x] Create `components/monte-carlo/scene/ConnectionLines.tsx` (R3F) component.
- [x] Create `components/monte-carlo/scene/Scene.tsx` (R3F - Canvas internals).
- [x] Create `components/monte-carlo/scene/WebGLContextLostManager.tsx` (R3F) component.
- [x] Create `components/monte-carlo/VisualizationCanvas.tsx` (R3F - Canvas setup + UI overlays).
- [x] Refactor main `components/monte-carlo-visualizer.tsx` to use new hooks and components.

## In Progress Tasks

- [ ] Remove unused code from the original `components/monte-carlo-visualizer.tsx`.
- [ ] Final checks (lint, typecheck).

## Future Tasks

- [ ] Add unit/integration tests for the new hooks and components.

## Implementation Plan

1.  ✅ **Isolate Logic:** Extract data fetching, state management, and camera control logic into custom hooks.
2.  ✅ **Isolate Utilities:** Move general helper functions to `utils.ts`.
3.  ✅ **Decompose UI:** Create separate components for distinct UI parts (Sidebar, Details Panel, Legend).
4.  ✅ **Decompose 3D Scene:** Create separate components for R3F elements and group them under a `SceneComponent`.
5.  ✅ **Create Canvas Wrapper:** Encapsulate the R3F `Canvas` setup, `SceneComponent`, and UI overlays.
6.  ✅ **Orchestrate:** Update the main `MonteCarloVisualizer` component to import and use the new hooks and components.
7.  ⏳ **Cleanup:** Remove the original code sections from `MonteCarloVisualizer`.

### Relevant Files

- `components/monte-carlo-visualizer.tsx` - ✅ Main orchestrator component (refactored).
- `components/monte-carlo/utils.ts` - ✅ Helper functions.
- `components/monte-carlo/hooks/useMonteCarloData.ts` - ✅ Data fetching hook.
- `components/monte-carlo/BatchSelectionSidebar.tsx` - ✅ UI for batch list.
- `components/monte-carlo/DetailsPanel.tsx` - ✅ UI container for detail cards.
- `components/monte-carlo/ModelLegend.tsx` - ✅ UI for model color legend.
- `components/monte-carlo/scene/DynamicAxisLabels.tsx` - ✅ R3F labels.
- `components/monte-carlo/scene/Points.tsx` - ✅ R3F points rendering.
- `components/monte-carlo/scene/PointLabels.tsx` - ✅ R3F point labels.
- `components/monte-carlo/scene/ClusterCubes.tsx` - ✅ R3F cluster cubes.
- `components/monte-carlo/scene/ConnectionLines.tsx` - ✅ R3F connection lines.
- `components/monte-carlo/scene/Scene.tsx` - ✅ R3F scene contents wrapper.
- `components/monte-carlo/scene/WebGLContextLostManager.tsx` - ✅ WebGL context handling.
- `components/monte-carlo/VisualizationCanvas.tsx` - ✅ R3F Canvas setup and UI overlays.
- `lib/monte-carlo-service.ts` - Existing service for data operations.
- `MONTE_CARLO_REFACTOR.md` - ✅ This task list file. 