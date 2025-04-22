import { describe, it, expect } from 'vitest';
import * as THREE from 'three'; // Import THREE if needed for Color comparison
import { PointWithCluster } from '@/components/monte-carlo/hooks/use-monte-carlo-data'; // Adjust path
import {
  formatBatchId,
  findClosestPoints,
  getModelColor,
  getSelectionColor,
  isPointInSelectedCluster,
  getModelCardColor,
  normalizeAndSpreadPoints,
  addJitterToPoints
} from '@/components/monte-carlo/utils'; // Adjust path

// Mock PointWithCluster type for testing findClosestPoints etc.
const createMockPoint = (id: string, position: [number, number, number], model: string = 'test-model', cluster?: number): PointWithCluster => ({
  id,
  position,
  model,
  temperature: 0.5,
  runId: parseInt(id, 10),
  approach: `Approach ${id}`,
  solutionSummary: `Summary ${id}`,
  metrics: { executionTime: '10ms', complexity: 'O(n)', memoryUsage: '10MB', lineCount: 10, codeQuality: 80, convergenceScore: 90 },
  cluster,
  // Add other required fields if PointWithCluster definition changes
  batchId: 'batch_1678886400_test', // Example batchId
  ensemble_config_id: 'config-1', // Example config_id
});


describe('Monte Carlo Utils', () => {

  describe('formatBatchId', () => {
    it('should format timestamped batch IDs correctly', () => {
      // Assuming timestamp 1678886400 corresponds to a specific date/time
      // Note: The exact output depends on the locale of the testing environment.
      // Consider mocking toLocaleString or testing the pattern.
      const timestamp = 1678886400; // Example: March 15, 2023 12:00:00 PM GMT
      const date = new Date(timestamp * 1000);
      const expectedDateString = date.toLocaleString();
      expect(formatBatchId('batch_1678886400_abc123')).toBe(`${expectedDateString} (abc123)`);
    });

    it('should handle batch IDs without standard timestamp format', () => {
      expect(formatBatchId('my_custom_batch_id')).toBe('my custom batch id');
    });

     it('should truncate long non-timestamp IDs', () => {
       expect(formatBatchId('batch_a_very_very_long_batch_identifier_that_needs_truncation')).toBe('Batch a very very long batch i...');
     });

     it('should truncate long unique parts in timestamped IDs', () => {
        const timestamp = 1678886400;
        const date = new Date(timestamp * 1000);
        const expectedDateString = date.toLocaleString();
        expect(formatBatchId('batch_1678886400_a_very_long_unique_part_123456')).toBe(`${expectedDateString} (a_very_long_...`);
     });
  });

  describe('findClosestPoints', () => {
    const points = [
      createMockPoint('1', [0, 0, 0]),
      createMockPoint('2', [1, 0, 0]),
      createMockPoint('3', [0, 1, 0]),
      createMockPoint('4', [10, 10, 10]),
      createMockPoint('5', [0, 0, 1]),
    ];

    it('should find the specified number of closest points', () => {
      const closest = findClosestPoints(points[0], points, 2);
      expect(closest).toHaveLength(2);
      // Check IDs - closest should be 2 and 5 (distance 1)
      const closestIds = closest.map(p => p.id).sort();
      expect(closestIds).toEqual(['2', '5']);
    });

    it('should not include the source point itself', () => {
      const closest = findClosestPoints(points[0], points, 4);
      expect(closest.find(p => p.id === '1')).toBeUndefined();
    });

     it('should handle count greater than available points', () => {
       const closest = findClosestPoints(points[0], points, 10);
       expect(closest).toHaveLength(4); // Only 4 other points exist
     });
  });

   describe('getModelColor', () => {
      it('should return correct color for gpt-4o', () => {
        expect(getModelColor('gpt-4o').getHexString()).toEqual(new THREE.Color("#3b82f6").getHexString());
      });
       it('should return correct color for claude', () => {
        expect(getModelColor('claude-sonnet').getHexString()).toEqual(new THREE.Color("#8b5cf6").getHexString());
      });
       it('should return default color for unknown models', () => {
        expect(getModelColor('unknown-model').getHexString()).toEqual(new THREE.Color("#94a3b8").getHexString());
      });
      // Add more tests for other models (o1, o3)
   });

    describe('getSelectionColor', () => {
      it('should return correct color for selected point', () => {
          expect(getSelectionColor('point')).toBe("#f97316");
      });
       it('should return correct color for hover', () => {
          expect(getSelectionColor('hover')).toBe("#f97316");
      });
       it('should return correct color for cluster', () => {
          expect(getSelectionColor('cluster')).toBe("#4ade80");
      });
    });

     describe('isPointInSelectedCluster', () => {
        const pointInCluster1 = createMockPoint('p1', [0,0,0], 'm1', 1);
        const pointInCluster2 = createMockPoint('p2', [1,1,1], 'm2', 2);
        const pointNoCluster = createMockPoint('p3', [2,2,2], 'm3', undefined);

        it('should return true if point cluster is in selected list', () => {
           expect(isPointInSelectedCluster(pointInCluster1, [1, 3])).toBe(true);
        });
         it('should return false if point cluster is not in selected list', () => {
           expect(isPointInSelectedCluster(pointInCluster2, [1, 3])).toBe(false);
        });
         it('should return false if point has no cluster', () => {
           expect(isPointInSelectedCluster(pointNoCluster, [1, 3])).toBe(false);
        });
         it('should return false if selected list is empty', () => {
           expect(isPointInSelectedCluster(pointInCluster1, [])).toBe(false);
        });
     });

     // Add tests for getModelCardColor, normalizeAndSpreadPoints, addJitterToPoints if needed

}); 