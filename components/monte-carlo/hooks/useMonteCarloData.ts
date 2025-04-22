import { useState, useEffect, useCallback, useRef } from "react"
import {
  MonteCarloDataPoint,
  MonteCarloCluster,
  fetchAvailableBatchIds,
  fetchMonteCarloDataForBatch,
  generateClusters,
  generateClusterTitles,
  PointWithCluster,
  normalizeAndSpreadPoints,
  addJitterToPoints,
} from "@/lib/monte-carlo-service"

const DEBUG = process.env.NODE_ENV !== 'production'

export function useMonteCarloData(initialBatchId?: string | null) {
  const isMounted = useRef(true)
  const [data, setData] = useState<PointWithCluster[]>([])
  const [clusters, setClusters] = useState<MonteCarloCluster[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [allBatchIds, setAllBatchIds] = useState<string[]>([])
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(initialBatchId || null)
  const [isFetchingBatches, setIsFetchingBatches] = useState(false)

  // Effect to handle component mount/unmount for async operations
  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
    }
  }, [])

  // Fetch available batch IDs
  const fetchBatchIds = useCallback(async () => {
    if (DEBUG) console.debug("Fetching available batch IDs...")
    setIsFetchingBatches(true)
    try {
      const batchIds = await fetchAvailableBatchIds()
      if (!isMounted.current) return
      if (DEBUG) console.debug(`Fetched ${batchIds.length} batch IDs`)
      if (batchIds.length > 0) {
        const sortedBatchIds = [...batchIds].sort((a, b) => {
          const getTimestamp = (id: string) => {
            const match = id.match(/batch_(\d+)/)
            return match ? parseInt(match[1]) : 0
          }
          const timeA = getTimestamp(a)
          const timeB = getTimestamp(b)
          return timeB - timeA
        })
        setAllBatchIds(sortedBatchIds)
      } else {
        if (DEBUG) console.debug("No batch IDs found")
        setAllBatchIds([])
      }
    } catch (error) {
      console.warn("Error fetching batch IDs:", error)
      if (!isMounted.current) return
      setAllBatchIds([])
    } finally {
      if (isMounted.current) setIsFetchingBatches(false)
    }
  }, []) // No dependencies needed as it relies on isMounted ref

  // Fetch batch IDs on component mount
  useEffect(() => {
    fetchBatchIds()
  }, [fetchBatchIds])

  // Handler for changing the selected batch
  const handleBatchChange = useCallback(async (value: string) => {
    setSelectedBatchId(value)
    setIsLoading(true)
    setData([]) // Clear previous data immediately
    setClusters([])

    // Don't necessarily need to refetch all batch IDs here unless the list might change often
    // await fetchBatchIds(); // Optional: uncomment if needed

    try {
      if (!isMounted.current) return
      if (DEBUG) console.debug(`Loading data for batch ${value}...`)
      const { dataPoints } = await fetchMonteCarloDataForBatch(value)
      if (!isMounted.current) return

      if (dataPoints.length === 0) {
        if (DEBUG) console.debug(`No data found for batch ${value}`)
        // Data/Clusters already cleared, just stop loading
        if (isMounted.current) setIsLoading(false)
        return
      }

      if (DEBUG) console.debug(`Processing ${dataPoints.length} points...`)
      const spreadPoints = normalizeAndSpreadPoints(dataPoints)
      const processedPoints = addJitterToPoints(spreadPoints)

      if (DEBUG) console.debug(`Generating clusters for ${processedPoints.length} points...`)
      const generatedClusters = await generateClusters(processedPoints)
      if (!isMounted.current) return

      if (DEBUG) console.debug(`Assigning ${generatedClusters.length} clusters to data points...`)
      const dataWithClusters: PointWithCluster[] = processedPoints.map((point) => {
        const cluster = generatedClusters.find((c) => c.points.some((p) => p.id === point.id))
        return { ...point, cluster: cluster?.id }
      })

      // if (DEBUG) console.debug('Clusters assigned to data points.');

      // if (DEBUG) console.debug(`
    } catch (error) {
      console.warn("Error processing data:", error)
      if (isMounted.current) setIsLoading(false)
    }
  }, [])

  return {
    data,
    clusters,
    isLoading,
    allBatchIds,
    selectedBatchId,
    isFetchingBatches,
    handleBatchChange,
  }
}